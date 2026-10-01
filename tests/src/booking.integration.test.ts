import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
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
  users,
} from "@findbarber/shared/schema";
import { weekdayFromCalendarDate } from "@findbarber/shared/dates";

const app = createApp();
const PASSWORD = "password123";

beforeAll(async () => {
  await migrateDb();
});

beforeEach(async () => {
  // Nettoyage dans l'ordre des clés étrangères
  // (réservations → indispos → horaires → services → profils → users).
  await db.delete(bookings);
  await db.delete(barberTimeOff);
  await db.delete(barberWorkingHours);
  await db.delete(barberServices);
  await db.delete(barberProfiles);
  await db.delete(users);
});

function profilePayload(overrides: Record<string, unknown> = {}) {
  return {
    displayName: "Barbier Test",
    description: "Coupes et barbes soignées",
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

async function register(email: string, role: "CLIENT" | "BARBER") {
  const res = await request(app)
    .post("/api/auth/register")
    .send({ email, password: PASSWORD, role });
  expect(res.status).toBe(201);
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

function futureDate(daysFromNow: number): string {
  const date = new Date();
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() + daysFromNow);
  return date.toISOString().slice(0, 10);
}

interface BookableBarber {
  agent: request.SuperAgentTest;
  csrf: string;
  barberId: string;
  serviceId: string;
}

async function setupBookableBarber(
  email: string,
  date: string,
  overrides: Record<string, unknown> = {},
): Promise<BookableBarber> {
  await register(email, "BARBER");
  const { agent, csrf } = await login(email);

  const profile = await agent
    .put("/api/barber/profile")
    .set("X-CSRF-Token", csrf)
    .send(profilePayload(overrides));
  expect(profile.status).toBe(200);
  const barberId = profile.body.profile.id as string;

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

describe("GET /api/barbers/:barberId/slots", () => {
  it("returns public UTC slots on the service-duration grid", async () => {
    const date = futureDate(7);
    const { barberId, serviceId } = await setupBookableBarber(
      "slots@example.com",
      date,
    );

    const res = await request(app)
      .get(`/api/barbers/${barberId}/slots`)
      .query({ serviceId, date, place: "SALON" });
    expect(res.status).toBe(200);
    const starts = res.body.slots.map(
      (slot: { startMinute: number }) => slot.startMinute,
    );
    expect(starts).toContain(540);
    expect(starts).toContain(570);
    expect(starts).not.toContain(555); // pas de pas fixe de 15 minutes
    expect(res.body.slots[0]).toHaveProperty("startAt");
    expect(res.body.slots[0]).toHaveProperty("endAt");
  });

  it("rejects invalid query parameters", async () => {
    const date = futureDate(7);
    const { barberId, serviceId } = await setupBookableBarber(
      "slots-invalid@example.com",
      date,
    );

    const unknown = await request(app)
      .get(`/api/barbers/${barberId}/slots`)
      .query({ serviceId, date, place: "SALON", stepMinutes: 15 });
    expect(unknown.status).toBe(400);
    expect(unknown.body.error.code).toBe("VALIDATION_ERROR");

    const badDate = await request(app)
      .get(`/api/barbers/${barberId}/slots`)
      .query({ serviceId, date: "2026-02-30", place: "SALON" });
    expect(badDate.status).toBe(400);
  });

  it("returns 404 for an unknown barber", async () => {
    const res = await request(app)
      .get("/api/barbers/missing/slots")
      .query({ serviceId: "s", date: futureDate(7), place: "SALON" });
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("BARBER_NOT_FOUND");
  });

  it("returns 409 when the barber has no timezone", async () => {
    const date = futureDate(7);
    const { barberId, serviceId } = await setupBookableBarber(
      "slots-notz@example.com",
      date,
      { timezone: null },
    );

    const res = await request(app)
      .get(`/api/barbers/${barberId}/slots`)
      .query({ serviceId, date, place: "SALON" });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("BARBER_TIMEZONE_MISSING");
  });

  it("returns 409 when the place is not offered", async () => {
    const date = futureDate(7);
    const { barberId, serviceId } = await setupBookableBarber(
      "slots-place@example.com",
      date,
    );

    const res = await request(app)
      .get(`/api/barbers/${barberId}/slots`)
      .query({ serviceId, date, place: "AT_CLIENT" });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("PLACE_NOT_OFFERED");
  });

  it("returns 404 when the service does not belong to the barber", async () => {
    const date = futureDate(7);
    await setupBookableBarber("slots-owner@example.com", date);
    const other = await setupBookableBarber("slots-other@example.com", date);

    const res = await request(app)
      .get(`/api/barbers/${other.barberId}/slots`)
      .query({ serviceId: "unknown-service", date, place: "SALON" });
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("SERVICE_NOT_FOUND");
  });
});

describe("booking lifecycle", () => {
  it("creates a PENDING booking with snapshots, then barber confirms, then client cancels", async () => {
    const date = futureDate(7);
    const { agent: barberAgent, csrf: barberCsrf, barberId, serviceId } =
      await setupBookableBarber("lifecycle@example.com", date);

    await register("lifecycle-client@example.com", "CLIENT");
    const client = await login("lifecycle-client@example.com");

    const created = await client.agent
      .post("/api/bookings")
      .set("X-CSRF-Token", client.csrf)
      .send({ barberId, serviceId, date, startMinute: 540, place: "SALON" });
    expect(created.status).toBe(201);
    const booking = created.body.booking;
    expect(booking.status).toBe("PENDING");
    expect(booking.barberId).toBe(barberId);
    expect(booking.serviceId).toBe(serviceId);
    expect(booking.barberDisplayName).toBe("Barbier Test");
    expect(booking.serviceName).toBe("Coupe classique");
    expect(booking.serviceDescription).toBe("Coupe + finitions");
    expect(booking.durationMinutes).toBe(30);
    expect(booking.priceMinor).toBe(2500);
    expect(booking.currency).toBe("CHF");
    expect(booking.servicePlace).toBe("SALON");
    expect(booking.startAt).toBeTruthy();
    expect(booking.endAt).toBeTruthy();
    expect(booking.cancelledBy).toBeNull();
    expect(booking.cancelledAt).toBeNull();

    // Snapshots figés en base (pas seulement dans la réponse).
    const [row] = await db.select().from(bookings).where(eq(bookings.id, booking.id));
    expect(row.barberDisplayName).toBe("Barbier Test");
    expect(row.serviceDescription).toBe("Coupe + finitions");
    expect(row.status).toBe("PENDING");

    const confirmed = await barberAgent
      .post(`/api/bookings/${booking.id}/confirm`)
      .set("X-CSRF-Token", barberCsrf);
    expect(confirmed.status).toBe(200);
    expect(confirmed.body.booking.status).toBe("CONFIRMED");

    const cancelled = await client.agent
      .post(`/api/bookings/${booking.id}/cancel`)
      .set("X-CSRF-Token", client.csrf);
    expect(cancelled.status).toBe(200);
    expect(cancelled.body.booking.status).toBe("CANCELLED");
    expect(cancelled.body.booking.cancelledBy).toBe("CLIENT");
    expect(cancelled.body.booking.cancelledAt).toBeTruthy();
  });

  it("prevents two clients from booking the same slot", async () => {
    const date = futureDate(7);
    const { barberId, serviceId } = await setupBookableBarber(
      "double@example.com",
      date,
    );

    await register("double-a@example.com", "CLIENT");
    await register("double-b@example.com", "CLIENT");
    const clientA = await login("double-a@example.com");
    const clientB = await login("double-b@example.com");

    const first = await clientA.agent
      .post("/api/bookings")
      .set("X-CSRF-Token", clientA.csrf)
      .send({ barberId, serviceId, date, startMinute: 540, place: "SALON" });
    expect(first.status).toBe(201);

    const second = await clientB.agent
      .post("/api/bookings")
      .set("X-CSRF-Token", clientB.csrf)
      .send({ barberId, serviceId, date, startMinute: 540, place: "SALON" });
    expect(second.status).toBe(409);
    expect(second.body.error.code).toBe("SLOT_UNAVAILABLE");
  });
});

describe("booking access control and validation", () => {
  it("rejects unauthenticated creation and non-CLIENT roles", async () => {
    const date = futureDate(7);
    const { barberId, serviceId } = await setupBookableBarber(
      "roles@example.com",
      date,
    );

    const payload = { barberId, serviceId, date, startMinute: 540, place: "SALON" };

    const anon = await request(app).post("/api/bookings").send(payload);
    expect(anon.status).toBe(401);

    const barber = await login("roles@example.com");
    const forbidden = await barber.agent
      .post("/api/bookings")
      .set("X-CSRF-Token", barber.csrf)
      .send(payload);
    expect(forbidden.status).toBe(403);
  });

  it("requires CSRF and rejects unknown fields", async () => {
    const date = futureDate(7);
    const { barberId, serviceId } = await setupBookableBarber(
      "csrf@example.com",
      date,
    );
    await register("csrf-client@example.com", "CLIENT");
    const client = await login("csrf-client@example.com");

    const noCsrf = await client.agent
      .post("/api/bookings")
      .send({ barberId, serviceId, date, startMinute: 540, place: "SALON" });
    expect(noCsrf.status).toBe(403);

    const unknown = await client.agent
      .post("/api/bookings")
      .set("X-CSRF-Token", client.csrf)
      .send({
        barberId,
        serviceId,
        date,
        startMinute: 540,
        place: "SALON",
        startAt: "2026-01-01T00:00:00Z",
      });
    expect(unknown.status).toBe(400);
    expect(unknown.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("rejects a forged off-grid start minute (server recomputes)", async () => {
    const date = futureDate(7);
    const { barberId, serviceId } = await setupBookableBarber(
      "forged@example.com",
      date,
    );
    await register("forged-client@example.com", "CLIENT");
    const client = await login("forged-client@example.com");

    const res = await client.agent
      .post("/api/bookings")
      .set("X-CSRF-Token", client.csrf)
      .send({ barberId, serviceId, date, startMinute: 545, place: "SALON" });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("SLOT_UNAVAILABLE");
  });

  it("returns 404 for an unknown service on create", async () => {
    const date = futureDate(7);
    const { barberId } = await setupBookableBarber("missing-service@example.com", date);
    await register("missing-service-client@example.com", "CLIENT");
    const client = await login("missing-service-client@example.com");

    const res = await client.agent
      .post("/api/bookings")
      .set("X-CSRF-Token", client.csrf)
      .send({ barberId, serviceId: "unknown", date, startMinute: 540, place: "SALON" });
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("SERVICE_NOT_FOUND");
  });
});

describe("booking confirm / cancel rules", () => {
  it("lets the barber confirm only once and only PENDING bookings", async () => {
    const date = futureDate(7);
    const { agent, csrf, barberId, serviceId } = await setupBookableBarber(
      "confirm@example.com",
      date,
    );
    await register("confirm-client@example.com", "CLIENT");
    const client = await login("confirm-client@example.com");

    const created = await client.agent
      .post("/api/bookings")
      .set("X-CSRF-Token", client.csrf)
      .send({ barberId, serviceId, date, startMinute: 540, place: "SALON" });
    const id = created.body.booking.id;

    const confirmed = await agent
      .post(`/api/bookings/${id}/confirm`)
      .set("X-CSRF-Token", csrf);
    expect(confirmed.status).toBe(200);

    const again = await agent
      .post(`/api/bookings/${id}/confirm`)
      .set("X-CSRF-Token", csrf);
    expect(again.status).toBe(409);
    expect(again.body.error.code).toBe("INVALID_STATUS_TRANSITION");
  });

  it("denies a CLIENT from confirming", async () => {
    const date = futureDate(7);
    const { barberId, serviceId } = await setupBookableBarber(
      "confirm-role@example.com",
      date,
    );
    await register("confirm-role-client@example.com", "CLIENT");
    const client = await login("confirm-role-client@example.com");

    const created = await client.agent
      .post("/api/bookings")
      .set("X-CSRF-Token", client.csrf)
      .send({ barberId, serviceId, date, startMinute: 540, place: "SALON" });

    const res = await client.agent
      .post(`/api/bookings/${created.body.booking.id}/confirm`)
      .set("X-CSRF-Token", client.csrf);
    expect(res.status).toBe(403);
  });

  it("blocks a client cancellation less than 2 hours before start, but allows the barber", async () => {
    const date = futureDate(7);
    const { agent: barberAgent, csrf: barberCsrf, barberId, serviceId } =
      await setupBookableBarber("cancel-deadline@example.com", date);
    await register("cancel-deadline-client@example.com", "CLIENT");
    const client = await login("cancel-deadline-client@example.com");

    const created = await client.agent
      .post("/api/bookings")
      .set("X-CSRF-Token", client.csrf)
      .send({ barberId, serviceId, date, startMinute: 540, place: "SALON" });
    const id = created.body.booking.id;

    // Déplace la réservation 1 h dans le futur : le client dépasse le délai de 2 h.
    const now = new Date();
    await db
      .update(bookings)
      .set({
        startAt: new Date(now.getTime() + 60 * 60_000),
        endAt: new Date(now.getTime() + 90 * 60_000),
      })
      .where(eq(bookings.id, id));

    const tooLate = await client.agent
      .post(`/api/bookings/${id}/cancel`)
      .set("X-CSRF-Token", client.csrf);
    expect(tooLate.status).toBe(409);
    expect(tooLate.body.error.code).toBe("CANCELLATION_TOO_LATE");

    const barberCancelled = await barberAgent
      .post(`/api/bookings/${id}/cancel`)
      .set("X-CSRF-Token", barberCsrf);
    expect(barberCancelled.status).toBe(200);
    expect(barberCancelled.body.booking.status).toBe("CANCELLED");
    expect(barberCancelled.body.booking.cancelledBy).toBe("BARBER");
  });

  it("returns 404 when the booking belongs to another barber or client", async () => {
    const date = futureDate(7);
    const { barberId, serviceId } = await setupBookableBarber(
      "isolate-barber@example.com",
      date,
    );
    await register("isolate-client@example.com", "CLIENT");
    const client = await login("isolate-client@example.com");

    const created = await client.agent
      .post("/api/bookings")
      .set("X-CSRF-Token", client.csrf)
      .send({ barberId, serviceId, date, startMinute: 540, place: "SALON" });
    const id = created.body.booking.id;

    await register("other-barber@example.com", "BARBER");
    const other = await login("other-barber@example.com");
    await other.agent
      .put("/api/barber/profile")
      .set("X-CSRF-Token", other.csrf)
      .send(profilePayload());

    const confirm = await other.agent
      .post(`/api/bookings/${id}/confirm`)
      .set("X-CSRF-Token", other.csrf);
    expect(confirm.status).toBe(404);

    await register("other-client@example.com", "CLIENT");
    const otherClient = await login("other-client@example.com");
    const cancel = await otherClient.agent
      .post(`/api/bookings/${id}/cancel`)
      .set("X-CSRF-Token", otherClient.csrf);
    expect(cancel.status).toBe(404);
  });
});

describe("booking list", () => {
  it("lists the client's own bookings and the barber's profile bookings", async () => {
    const date = futureDate(7);
    const { agent: barberAgent, barberId, serviceId } =
      await setupBookableBarber("list@example.com", date);
    await register("list-client@example.com", "CLIENT");
    const client = await login("list-client@example.com");

    const created = await client.agent
      .post("/api/bookings")
      .set("X-CSRF-Token", client.csrf)
      .send({ barberId, serviceId, date, startMinute: 540, place: "SALON" });
    expect(created.status).toBe(201);

    const clientList = await client.agent.get("/api/bookings");
    expect(clientList.status).toBe(200);
    expect(clientList.body.bookings).toHaveLength(1);
    expect(clientList.body.bookings[0].id).toBe(created.body.booking.id);

    const barberList = await barberAgent.get("/api/bookings");
    expect(barberList.status).toBe(200);
    expect(barberList.body.bookings).toHaveLength(1);
    expect(barberList.body.bookings[0].barberId).toBe(barberId);
  });

  it("isolates bookings between clients", async () => {
    const date = futureDate(7);
    const { barberId, serviceId } = await setupBookableBarber(
      "list-isolate@example.com",
      date,
    );
    await register("list-a@example.com", "CLIENT");
    await register("list-b@example.com", "CLIENT");
    const clientA = await login("list-a@example.com");
    const clientB = await login("list-b@example.com");

    await clientA.agent
      .post("/api/bookings")
      .set("X-CSRF-Token", clientA.csrf)
      .send({ barberId, serviceId, date, startMinute: 540, place: "SALON" });

    const listA = await clientA.agent.get("/api/bookings");
    expect(listA.body.bookings).toHaveLength(1);
    const listB = await clientB.agent.get("/api/bookings");
    expect(listB.body.bookings).toHaveLength(0);
  });
});
