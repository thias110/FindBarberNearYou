import { randomUUID } from "node:crypto";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { createApp } from "../../server/src/app";
import { db } from "../../server/src/db/client";
import { migrateDb } from "../../server/src/db/migrate";
import {
  barberProfiles,
  barberServices,
  barberTimeOff,
  barberWorkingHours,
  bookings,
  reviews,
  users,
} from "@findbarber/shared/schema";
import type { BookingStatus } from "@findbarber/shared/constants";
import { suspendUser } from "../../server/src/modules/admin/service";

const app = createApp();
const PASSWORD = "password123";

beforeAll(async () => {
  await migrateDb();
});

beforeEach(async () => {
  // Nettoyage dans l'ordre des clés étrangères (avis → réservations → …).
  await db.delete(reviews);
  await db.delete(bookings);
  await db.delete(barberTimeOff);
  await db.delete(barberWorkingHours);
  await db.delete(barberServices);
  await db.delete(barberProfiles);
  await db.delete(users);
});

async function createUser(
  email: string,
  role: "CLIENT" | "BARBER" | "ADMIN",
): Promise<{ id: string }> {
  const passwordHash = await bcrypt.hash(PASSWORD, 12);
  const [row] = await db
    .insert(users)
    .values({ id: randomUUID(), email, passwordHash, role, status: "ACTIVE" })
    .returning({ id: users.id });
  return row;
}

async function login(email: string) {
  const agent = request.agent(app);
  const res = await agent
    .post("/api/auth/login")
    .send({ email, password: PASSWORD });
  expect(res.status).toBe(200);
  return { agent, csrf: res.body.csrfToken as string };
}

async function seedBarber(email: string, timezone = "UTC") {
  const { id: userId } = await createUser(email, "BARBER");
  const profileId = randomUUID();
  await db.insert(barberProfiles).values({
    id: profileId,
    userId,
    displayName: "Barbier Suspension",
    description: "Coupes soignées",
    city: "Genève",
    countryCode: "CH",
    latitude: 46.2044,
    longitude: 6.1432,
    currency: "CHF",
    timezone,
  });
  const serviceId = randomUUID();
  await db.insert(barberServices).values({
    id: serviceId,
    barberProfileId: profileId,
    name: "Coupe classique",
    description: null,
    durationMinutes: 30,
    priceMinor: 2500,
  });
  return { userId, profileId, serviceId };
}

async function insertBooking(input: {
  barberProfileId: string;
  serviceId: string;
  clientUserId: string;
  startAt: Date;
  status: BookingStatus;
}): Promise<string> {
  const [row] = await db
    .insert(bookings)
    .values({
      id: randomUUID(),
      clientUserId: input.clientUserId,
      barberProfileId: input.barberProfileId,
      serviceId: input.serviceId,
      startAt: input.startAt,
      endAt: new Date(input.startAt.getTime() + 30 * 60_000),
      servicePlace: "SALON",
      status: input.status,
      barberDisplayName: "Barbier Suspension",
      serviceName: "Coupe classique",
      serviceDescription: null,
      durationMinutes: 30,
      priceMinor: 2500,
      currency: "CHF",
    })
    .returning({ id: bookings.id });
  return row.id;
}

describe("compte suspendu — login et session existante", () => {
  it("refuse le login d'un compte SUSPENDED", async () => {
    await createUser("suspended@example.com", "CLIENT");
    await db
      .update(users)
      .set({ status: "SUSPENDED" })
      .where(eq(users.email, "suspended@example.com"));

    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "suspended@example.com", password: PASSWORD });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("ACCOUNT_SUSPENDED");
  });

  it("refuse une session déjà émise après suspension (relecture DB)", async () => {
    await createUser("later@example.com", "CLIENT");
    const { agent } = await login("later@example.com");

    const before = await agent.get("/api/auth/me");
    expect(before.status).toBe(200);

    await db
      .update(users)
      .set({ status: "SUSPENDED" })
      .where(eq(users.email, "later@example.com"));

    const me = await agent.get("/api/auth/me");
    expect(me.status).toBe(403);
    expect(me.body.error.code).toBe("ACCOUNT_SUSPENDED");

    const bookingsRes = await agent.get("/api/bookings");
    expect(bookingsRes.status).toBe(403);
    expect(bookingsRes.body.error.code).toBe("ACCOUNT_SUSPENDED");
  });
});

describe("garde-fous de suspension admin", () => {
  it("interdit l'auto-suspension", async () => {
    const admin = await createUser("admin@example.com", "ADMIN");
    const { agent, csrf } = await login("admin@example.com");

    const res = await agent
      .post(`/api/admin/users/${admin.id}/suspend`)
      .set("X-CSRF-Token", csrf);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("SELF_SUSPENSION_FORBIDDEN");
  });

  it("protège le dernier ADMIN actif", async () => {
    const admin = await createUser("solo@example.com", "ADMIN");
    await expect(
      suspendUser("non-admin-actor-id", admin.id),
    ).rejects.toMatchObject({ code: "LAST_ACTIVE_ADMIN_FORBIDDEN" });
  });

  it("refuse CLIENT et BARBER sur les endpoints admin (lecture et mutation)", async () => {
    await createUser("client@example.com", "CLIENT");
    await createUser("barber@example.com", "BARBER");
    const client = await login("client@example.com");
    const barber = await login("barber@example.com");

    for (const { agent, csrf } of [client, barber]) {
      const metrics = await agent.get("/api/admin/metrics");
      expect(metrics.status).toBe(403);
      expect(metrics.body.error.code).toBe("FORBIDDEN");

      const suspend = await agent
        .post("/api/admin/users/someone/suspend")
        .set("X-CSRF-Token", csrf);
      expect(suspend.status).toBe(403);
      expect(suspend.body.error.code).toBe("FORBIDDEN");
    }
  });
});

describe("suspension d'un barber — cycle de vie des bookings", () => {
  it("annule uniquement les futures PENDING/CONFIRMED (cancelled_by=ADMIN)", async () => {
    await createUser("admin@example.com", "ADMIN");
    const barber = await seedBarber("barber@example.com", "UTC");
    const client = await createUser("client@example.com", "CLIENT");

    const future = new Date(Date.now() + 24 * 3_600_000);
    const past = new Date(Date.now() - 24 * 3_600_000);

    await insertBooking({
      barberProfileId: barber.profileId,
      serviceId: barber.serviceId,
      clientUserId: client.id,
      startAt: future,
      status: "PENDING",
    });
    await insertBooking({
      barberProfileId: barber.profileId,
      serviceId: barber.serviceId,
      clientUserId: client.id,
      startAt: future,
      status: "CONFIRMED",
    });
    await insertBooking({
      barberProfileId: barber.profileId,
      serviceId: barber.serviceId,
      clientUserId: client.id,
      startAt: future,
      status: "COMPLETED",
    });
    await insertBooking({
      barberProfileId: barber.profileId,
      serviceId: barber.serviceId,
      clientUserId: client.id,
      startAt: past,
      status: "CONFIRMED",
    });
    await insertBooking({
      barberProfileId: barber.profileId,
      serviceId: barber.serviceId,
      clientUserId: client.id,
      startAt: past,
      status: "COMPLETED",
    });

    const { agent, csrf } = await login("admin@example.com");
    const res = await agent
      .post(`/api/admin/users/${barber.userId}/suspend`)
      .set("X-CSRF-Token", csrf);
    expect(res.status).toBe(200);

    const rows = await db
      .select()
      .from(bookings)
      .where(eq(bookings.barberProfileId, barber.profileId));

    const cancelled = rows.filter((row) => row.status === "CANCELLED");
    expect(cancelled).toHaveLength(2);
    for (const row of cancelled) {
      expect(row.cancelledBy).toBe("ADMIN");
      expect(row.startAt.getTime()).toBeGreaterThanOrEqual(
        future.getTime() - 1000,
      );
    }

    // Les réservations passées et les COMPLETED restent intactes.
    expect(
      rows.filter(
        (row) =>
          row.status === "CONFIRMED" && row.startAt.getTime() < future.getTime(),
      ),
    ).toHaveLength(1);
    expect(rows.filter((row) => row.status === "COMPLETED")).toHaveLength(2);
  });

  it("distingue cancelled_by=ADMIN d'une annulation par le barber", async () => {
    await createUser("admin@example.com", "ADMIN");
    const barber = await seedBarber("barber@example.com", "UTC");
    const client = await createUser("client@example.com", "CLIENT");

    const future = new Date(Date.now() + 24 * 3_600_000);
    const selfCancelId = await insertBooking({
      barberProfileId: barber.profileId,
      serviceId: barber.serviceId,
      clientUserId: client.id,
      startAt: future,
      status: "PENDING",
    });
    const adminCancelId = await insertBooking({
      barberProfileId: barber.profileId,
      serviceId: barber.serviceId,
      clientUserId: client.id,
      startAt: future,
      status: "CONFIRMED",
    });

    const barberSession = await login("barber@example.com");
    const cancel = await barberSession.agent
      .post(`/api/bookings/${selfCancelId}/cancel`)
      .set("X-CSRF-Token", barberSession.csrf);
    expect(cancel.status).toBe(200);

    const { agent, csrf } = await login("admin@example.com");
    const suspend = await agent
      .post(`/api/admin/users/${barber.userId}/suspend`)
      .set("X-CSRF-Token", csrf);
    expect(suspend.status).toBe(200);

    const rows = await db
      .select()
      .from(bookings)
      .where(eq(bookings.barberProfileId, barber.profileId));
    const byId = new Map(rows.map((row) => [row.id, row]));
    expect(byId.get(selfCancelId)?.cancelledBy).toBe("BARBER");
    expect(byId.get(selfCancelId)?.status).toBe("CANCELLED");
    expect(byId.get(adminCancelId)?.cancelledBy).toBe("ADMIN");
    expect(byId.get(adminCancelId)?.status).toBe("CANCELLED");
  });

  it("la réactivation ne restaure pas les bookings annulés", async () => {
    await createUser("admin@example.com", "ADMIN");
    const barber = await seedBarber("barber@example.com", "UTC");
    const client = await createUser("client@example.com", "CLIENT");

    const future = new Date(Date.now() + 24 * 3_600_000);
    const bookingId = await insertBooking({
      barberProfileId: barber.profileId,
      serviceId: barber.serviceId,
      clientUserId: client.id,
      startAt: future,
      status: "PENDING",
    });

    // Le barber est connecté AVANT la suspension : sa session doit être
    // refusée pendant la suspension puis refonctionner après réactivation.
    const barberSession = await login("barber@example.com");

    const { agent, csrf } = await login("admin@example.com");
    const suspend = await agent
      .post(`/api/admin/users/${barber.userId}/suspend`)
      .set("X-CSRF-Token", csrf);
    expect(suspend.status).toBe(200);

    const during = await barberSession.agent.get("/api/bookings");
    expect(during.status).toBe(403);
    expect(during.body.error.code).toBe("ACCOUNT_SUSPENDED");

    const reactivate = await agent
      .post(`/api/admin/users/${barber.userId}/reactivate`)
      .set("X-CSRF-Token", csrf);
    expect(reactivate.status).toBe(200);

    const after = await barberSession.agent.get("/api/bookings");
    expect(after.status).toBe(200);
    const cancelledBooking = after.body.bookings.find(
      (b: { id: string }) => b.id === bookingId,
    );
    expect(cancelledBooking.status).toBe("CANCELLED");
    expect(cancelledBooking.cancelledBy).toBe("ADMIN");

    // Impossible de re-confirmer une réservation annulée par l'administration.
    const confirm = await barberSession.agent
      .post(`/api/bookings/${bookingId}/confirm`)
      .set("X-CSRF-Token", barberSession.csrf);
    expect(confirm.status).toBe(409);
    expect(confirm.body.error.code).toBe("INVALID_STATUS_TRANSITION");

    const [row] = await db
      .select()
      .from(bookings)
      .where(eq(bookings.id, bookingId));
    expect(row.status).toBe("CANCELLED");
    expect(row.cancelledBy).toBe("ADMIN");
  });
});
