import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { eq } from "drizzle-orm";
import { createApp } from "../../server/src/app";
import { db } from "../../server/src/db/client";
import { migrateDb } from "../../server/src/db/migrate";
import {
  barberProfiles,
  barberServices,
  barberWorkingHours,
  bookings,
  notifications,
  users,
} from "@findbarber/shared/schema";
import { weekdayFromCalendarDate } from "@findbarber/shared/dates";
import { giveAvatar, markEmailVerified } from "./auth-helpers";
import { moveBookingToPast } from "./booking-helpers";
import { notifyBookingEvent } from "../../server/src/modules/notification/service";
import { approveProfile } from "./approval-helpers";

const app = createApp();
const PASSWORD = "password123";

beforeAll(async () => {
  await migrateDb();
});

beforeEach(async () => {
  await db.delete(notifications);
  await db.delete(bookings);
  await db.delete(barberWorkingHours);
  await db.delete(barberServices);
  await db.delete(barberProfiles);
  await db.delete(users);
});

function futureDate(daysFromNow: number): string {
  const date = new Date();
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() + daysFromNow);
  return date.toISOString().slice(0, 10);
}

async function register(
  email: string,
  role: "CLIENT" | "BARBER",
): Promise<{ id: string; email: string }> {
  const res = await request(app)
    .post("/api/auth/register")
    .send({ email, password: PASSWORD, role });
  expect(res.status).toBe(201);
  await markEmailVerified(email);
  if (role === "BARBER") await giveAvatar(email);
  return res.body.user as { id: string; email: string };
}

async function login(email: string) {
  const agent = request.agent(app);
  const res = await agent
    .post("/api/auth/login")
    .send({ email, password: PASSWORD });
  expect(res.status).toBe(200);
  return { agent, csrf: res.body.csrfToken as string };
}

function profilePayload(overrides: Record<string, unknown> = {}) {
  return {
    displayName: "Barbier Notif",
    description: "Coupes soignées",
    address: "Rue du Test 1",
    city: "Genève",
    postalCode: "1201",
    countryCode: "CH",
    latitude: 46.2044,
    longitude: 6.1432,
    currency: "CHF",
    places: ["SALON"],
    timezone: "UTC",
    ...overrides,
  };
}

async function setupBookableBarber(email: string, date: string) {
  await register(email, "BARBER");
  const { agent, csrf } = await login(email);

  const profile = await agent
    .put("/api/barber/profile")
    .set("X-CSRF-Token", csrf)
    .send(profilePayload());
  expect(profile.status).toBe(200);
  const barberId = profile.body.profile.id as string;
  await approveProfile(barberId);

  const service = await agent
    .post("/api/barber/services")
    .set("X-CSRF-Token", csrf)
    .send({
      name: "Coupe classique",
      description: "Coupe + finitions",
      durationMinutes: 30,
      priceMinor: 2500,
    });
  expect(service.status).toBe(201);
  const serviceId = service.body.service.id as string;

  const weekday = weekdayFromCalendarDate(date);
  const hours = await agent
    .put("/api/barber/working-hours")
    .set("X-CSRF-Token", csrf)
    .send({ intervals: [{ weekday, startMinute: 540, endMinute: 1080 }] });
  expect(hours.status).toBe(200);

  return { agent, csrf, barberId, serviceId };
}

async function createBooking(
  client: { agent: request.SuperAgentTest; csrf: string },
  barberId: string,
  serviceId: string,
  date: string,
): Promise<{ id: string; status: string }> {
  const res = await client.agent
    .post("/api/bookings")
    .set("X-CSRF-Token", client.csrf)
    .send({ barberId, serviceId, date, startMinute: 540, place: "SALON" });
  expect(res.status).toBe(201);
  return res.body.booking as { id: string; status: string };
}

async function listFor(agent: request.SuperAgentTest) {
  const res = await agent.get("/api/notifications");
  expect(res.status).toBe(200);
  return res.body.notifications as {
    id: string;
    type: string;
    bookingId: string | null;
  }[];
}

async function unreadFor(agent: request.SuperAgentTest): Promise<number> {
  const res = await agent.get("/api/notifications/unread-count");
  expect(res.status).toBe(200);
  return res.body.count as number;
}

describe("création des notifications sur les transitions", () => {
  it("BOOKING_REQUESTED : notifie le BARBER à la création", async () => {
    const date = futureDate(7);
    const { agent: barber, barberId, serviceId } = await setupBookableBarber(
      "req-barber@example.com",
      date,
    );
    await register("req-client@example.com", "CLIENT");
    const client = await login("req-client@example.com");

    const booking = await createBooking(client, barberId, serviceId, date);

    const list = await listFor(barber);
    expect(list).toHaveLength(1);
    expect(list[0].type).toBe("BOOKING_REQUESTED");
    expect(list[0].bookingId).toBe(booking.id);
    expect(await unreadFor(barber)).toBe(1);
  });

  it("BOOKING_CONFIRMED : notifie le CLIENT à la confirmation", async () => {
    const date = futureDate(7);
    const { agent: barber, csrf: barberCsrf, barberId, serviceId } =
      await setupBookableBarber("conf-barber@example.com", date);
    await register("conf-client@example.com", "CLIENT");
    const client = await login("conf-client@example.com");

    const booking = await createBooking(client, barberId, serviceId, date);
    const confirmed = await barber
      .post(`/api/bookings/${booking.id}/confirm`)
      .set("X-CSRF-Token", barberCsrf);
    expect(confirmed.status).toBe(200);

    const list = await listFor(client.agent);
    expect(
      list.some(
        (n) => n.type === "BOOKING_CONFIRMED" && n.bookingId === booking.id,
      ),
    ).toBe(true);
  });

  it("BOOKING_COMPLETED : notifie le CLIENT à la terminaison", async () => {
    const date = futureDate(7);
    const { agent: barber, csrf: barberCsrf, barberId, serviceId } =
      await setupBookableBarber("done-barber@example.com", date);
    await register("done-client@example.com", "CLIENT");
    const client = await login("done-client@example.com");

    const booking = await createBooking(client, barberId, serviceId, date);
    await barber
      .post(`/api/bookings/${booking.id}/confirm`)
      .set("X-CSRF-Token", barberCsrf);
    await moveBookingToPast(booking.id);
    const completed = await barber
      .post(`/api/bookings/${booking.id}/complete`)
      .set("X-CSRF-Token", barberCsrf);
    expect(completed.status).toBe(200);

    const list = await listFor(client.agent);
    expect(
      list.some(
        (n) => n.type === "BOOKING_COMPLETED" && n.bookingId === booking.id,
      ),
    ).toBe(true);
  });

  it("BOOKING_CANCELLED_BY_CLIENT : notifie le BARBER", async () => {
    const date = futureDate(7);
    const { agent: barber, barberId, serviceId } = await setupBookableBarber(
      "cancel-barber@example.com",
      date,
    );
    await register("cancel-client@example.com", "CLIENT");
    const client = await login("cancel-client@example.com");

    const booking = await createBooking(client, barberId, serviceId, date);
    const cancelled = await client.agent
      .post(`/api/bookings/${booking.id}/cancel`)
      .set("X-CSRF-Token", client.csrf);
    expect(cancelled.status).toBe(200);

    const list = await listFor(barber);
    expect(
      list.some(
        (n) =>
          n.type === "BOOKING_CANCELLED_BY_CLIENT" &&
          n.bookingId === booking.id,
      ),
    ).toBe(true);
  });

  it("BOOKING_CANCELLED_BY_BARBER : notifie le CLIENT", async () => {
    const date = futureDate(7);
    const { agent: barber, csrf: barberCsrf, barberId, serviceId } =
      await setupBookableBarber("barber-cancel@example.com", date);
    await register("barber-cancel-client@example.com", "CLIENT");
    const client = await login("barber-cancel-client@example.com");

    const booking = await createBooking(client, barberId, serviceId, date);
    const cancelled = await barber
      .post(`/api/bookings/${booking.id}/cancel`)
      .set("X-CSRF-Token", barberCsrf);
    expect(cancelled.status).toBe(200);

    const list = await listFor(client.agent);
    expect(
      list.some(
        (n) =>
          n.type === "BOOKING_CANCELLED_BY_BARBER" &&
          n.bookingId === booking.id,
      ),
    ).toBe(true);
  });

  it("BOOKING_CANCELLED_BY_ADMIN : notifie le CLIENT lors d'une suspension", async () => {
    const date = futureDate(7);
    const { barberId, serviceId } = await setupBookableBarber(
      "susp-barber@example.com",
      date,
    );
    const [barberUser] = await db
      .select()
      .from(users)
      .where(eq(users.email, "susp-barber@example.com"))
      .limit(1);

    await register("susp-client@example.com", "CLIENT");
    const client = await login("susp-client@example.com");
    const booking = await createBooking(client, barberId, serviceId, date);

    const passwordHash = await bcrypt.hash(PASSWORD, 12);
    await db.insert(users).values({
      id: randomUUID(),
      email: "susp-admin@example.com",
      passwordHash,
      role: "ADMIN",
      status: "ACTIVE",
      emailVerifiedAt: new Date(),
    });
    const admin = await login("susp-admin@example.com");

    const suspended = await admin.agent
      .post(`/api/admin/users/${barberUser.id}/suspend`)
      .set("X-CSRF-Token", admin.csrf);
    expect(suspended.status).toBe(200);

    const list = await listFor(client.agent);
    expect(
      list.some(
        (n) =>
          n.type === "BOOKING_CANCELLED_BY_ADMIN" &&
          n.bookingId === booking.id,
      ),
    ).toBe(true);
  });
});

describe("dédoublonnage", () => {
  it("ne crée pas de doublon pour un même événement (rejeu)", async () => {
    const date = futureDate(7);
    const { barberId, serviceId } = await setupBookableBarber(
      "dedup-barber@example.com",
      date,
    );
    await register("dedup-client@example.com", "CLIENT");
    const client = await login("dedup-client@example.com");
    const booking = await createBooking(client, barberId, serviceId, date);

    const [barberUser] = await db
      .select()
      .from(users)
      .where(eq(users.email, "dedup-barber@example.com"))
      .limit(1);
    const [clientUser] = await db
      .select()
      .from(users)
      .where(eq(users.email, "dedup-client@example.com"))
      .limit(1);

    // Rejeu du même événement (mêmes destinataire, type et booking) : no-op.
    await notifyBookingEvent(db, {
      recipientUserId: barberUser.id,
      actorUserId: clientUser.id,
      bookingId: booking.id,
      type: "BOOKING_REQUESTED",
    });

    const barber = await login("dedup-barber@example.com");
    const list = await listFor(barber.agent);
    const matching = list.filter(
      (n) => n.type === "BOOKING_REQUESTED" && n.bookingId === booking.id,
    );
    expect(matching).toHaveLength(1);
  });
});

describe("lecture scopée et autorisation", () => {
  it("scope la liste au user connecté et ne fuit pas l'existence (404)", async () => {
    const a = await register("scope-a@example.com", "CLIENT");
    await register("scope-b@example.com", "CLIENT");
    await db.insert(notifications).values({
      id: randomUUID(),
      userId: a.id,
      type: "BOOKING_REQUESTED",
      bookingId: null,
    });

    const aAuth = await login("scope-a@example.com");
    const bAuth = await login("scope-b@example.com");

    const aList = await listFor(aAuth.agent);
    expect(aList).toHaveLength(1);

    const bList = await listFor(bAuth.agent);
    expect(bList).toHaveLength(0);

    // B tente de marquer la notification de A → 404 (pas de fuite d'existence).
    const res = await bAuth.agent
      .post(`/api/notifications/${aList[0].id}/read`)
      .set("X-CSRF-Token", bAuth.csrf);
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOTIFICATION_NOT_FOUND");
  });

  it("retourne 401 sans authentification", async () => {
    expect((await request(app).get("/api/notifications")).status).toBe(401);
    expect(
      (await request(app).get("/api/notifications/unread-count")).status,
    ).toBe(401);
    expect(
      (await request(app).post("/api/notifications/x/read")).status,
    ).toBe(401);
    expect(
      (await request(app).post("/api/notifications/read-all")).status,
    ).toBe(401);
  });
});

describe("unread-count, mark-read et read-all", () => {
  it("mark-read et read-all sont idempotents", async () => {
    const a = await register("read-a@example.com", "CLIENT");
    await db.insert(notifications).values([
      { id: randomUUID(), userId: a.id, type: "BOOKING_CONFIRMED", bookingId: null },
      { id: randomUUID(), userId: a.id, type: "BOOKING_COMPLETED", bookingId: null },
    ]);

    const aAuth = await login("read-a@example.com");
    expect(await unreadFor(aAuth.agent)).toBe(2);

    const list = await listFor(aAuth.agent);
    const firstId = list[0].id;

    let res = await aAuth.agent
      .post(`/api/notifications/${firstId}/read`)
      .set("X-CSRF-Token", aAuth.csrf);
    expect(res.status).toBe(204);
    expect(await unreadFor(aAuth.agent)).toBe(1);

    // Re-marquer la même notification : idempotent.
    res = await aAuth.agent
      .post(`/api/notifications/${firstId}/read`)
      .set("X-CSRF-Token", aAuth.csrf);
    expect(res.status).toBe(204);
    expect(await unreadFor(aAuth.agent)).toBe(1);

    // read-all → 0, puis read-all idempotent.
    res = await aAuth.agent
      .post("/api/notifications/read-all")
      .set("X-CSRF-Token", aAuth.csrf);
    expect(res.status).toBe(204);
    expect(await unreadFor(aAuth.agent)).toBe(0);

    res = await aAuth.agent
      .post("/api/notifications/read-all")
      .set("X-CSRF-Token", aAuth.csrf);
    expect(res.status).toBe(204);
    expect(await unreadFor(aAuth.agent)).toBe(0);
  });
});
