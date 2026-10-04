import { randomUUID } from "node:crypto";
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
  reviews,
  users,
} from "@findbarber/shared/schema";
import type { BookingStatus } from "@findbarber/shared/constants";

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

function profilePayload(overrides: Record<string, unknown> = {}) {
  return {
    displayName: "Barbier Stats",
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

async function seedBarber(email: string, timezone = "UTC") {
  await register(email, "BARBER");
  const { agent, csrf } = await login(email);

  const profile = await agent
    .put("/api/barber/profile")
    .set("X-CSRF-Token", csrf)
    .send(profilePayload({ timezone }));
  expect(profile.status).toBe(200);
  const barberId = profile.body.profile.id as string;

  const service = await agent
    .post("/api/barber/services")
    .set("X-CSRF-Token", csrf)
    .send({
      name: "Coupe classique",
      description: null,
      durationMinutes: 30,
      priceMinor: 2500,
    });
  expect(service.status).toBe(201);

  return {
    agent,
    csrf,
    barberId,
    serviceId: service.body.service.id as string,
  };
}

interface SeedBooking {
  barberProfileId: string;
  serviceId: string;
  clientUserId: string;
  startAt: string;
  status: BookingStatus;
  priceMinor: number;
  serviceName?: string;
  cancelledBy?: "CLIENT" | "BARBER" | null;
  createdAt?: string;
}

async function insertBooking(input: SeedBooking): Promise<string> {
  const start = new Date(input.startAt);
  const [row] = await db
    .insert(bookings)
    .values({
      id: randomUUID(),
      clientUserId: input.clientUserId,
      barberProfileId: input.barberProfileId,
      serviceId: input.serviceId,
      startAt: start,
      endAt: new Date(start.getTime() + 30 * 60_000),
      servicePlace: "SALON",
      status: input.status,
      barberDisplayName: "Barbier Stats",
      serviceName: input.serviceName ?? "Coupe classique",
      serviceDescription: null,
      durationMinutes: 30,
      priceMinor: input.priceMinor,
      currency: "CHF",
      cancelledBy: input.cancelledBy ?? null,
      cancelledAt: input.cancelledBy ? start : null,
      createdAt: input.createdAt ? new Date(input.createdAt) : start,
    })
    .returning({ id: bookings.id });
  return row.id;
}

describe("GET /api/barber/stats — accès", () => {
  it("refuse sans authentification (401)", async () => {
    const res = await request(app).get("/api/barber/stats");
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHORIZED");
  });

  it("refuse CLIENT et ADMIN (403)", async () => {
    await register("client@example.com", "CLIENT");
    const { agent } = await login("client@example.com");

    const asClient = await agent.get("/api/barber/stats");
    expect(asClient.status).toBe(403);

    await db
      .update(users)
      .set({ role: "ADMIN" })
      .where(eq(users.email, "client@example.com"));
    const asAdmin = await agent.get("/api/barber/stats");
    expect(asAdmin.status).toBe(403);
  });

  it("renvoie 404 quand le BARBER n'a pas de profil", async () => {
    await register("noprofile@example.com", "BARBER");
    const { agent } = await login("noprofile@example.com");
    const res = await agent.get("/api/barber/stats");
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("BARBER_PROFILE_NOT_FOUND");
  });

  it("renvoie 409 quand le profil n'a pas de fuseau", async () => {
    await register("notz@example.com", "BARBER");
    const { agent, csrf } = await login("notz@example.com");
    const profile = await agent
      .put("/api/barber/profile")
      .set("X-CSRF-Token", csrf)
      .send(profilePayload({ timezone: null }));
    expect(profile.status).toBe(200);

    const res = await agent.get("/api/barber/stats");
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("BARBER_TIMEZONE_MISSING");
  });

  it("rejette les périodes invalides (400)", async () => {
    const { agent } = await seedBarber("valid@example.com");
    const cases = [
      "/api/barber/stats?range=year",
      "/api/barber/stats?range=custom",
      "/api/barber/stats?range=custom&from=2026-02-01",
      "/api/barber/stats?range=custom&from=2026-03-01&to=2026-02-01",
      "/api/barber/stats?range=custom&from=2025-01-01&to=2026-01-02",
      "/api/barber/stats?range=30d&from=2026-02-01",
    ];
    for (const path of cases) {
      const res = await agent.get(path);
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    }
  });
});

describe("GET /api/barber/stats — calculs", () => {
  it("isole les barbers et ne somme que les COMPLETED", async () => {
    const barberA = await seedBarber("a@example.com", "UTC");
    const barberB = await seedBarber("b@example.com", "UTC");
    const client = await register("client@example.com", "CLIENT");
    const now = new Date().toISOString();

    await insertBooking({
      barberProfileId: barberA.barberId,
      serviceId: barberA.serviceId,
      clientUserId: client.id,
      startAt: now,
      status: "COMPLETED",
      priceMinor: 3000,
    });
    await insertBooking({
      barberProfileId: barberA.barberId,
      serviceId: barberA.serviceId,
      clientUserId: client.id,
      startAt: now,
      status: "COMPLETED",
      priceMinor: 2000,
    });
    await insertBooking({
      barberProfileId: barberA.barberId,
      serviceId: barberA.serviceId,
      clientUserId: client.id,
      startAt: now,
      status: "CANCELLED",
      priceMinor: 9999,
      cancelledBy: "CLIENT",
    });
    await insertBooking({
      barberProfileId: barberB.barberId,
      serviceId: barberB.serviceId,
      clientUserId: client.id,
      startAt: now,
      status: "COMPLETED",
      priceMinor: 1000,
    });

    const resA = await barberA.agent.get("/api/barber/stats");
    expect(resA.status).toBe(200);
    expect(resA.body.totals.bookings).toBe(3);
    expect(resA.body.totals.revenueMinor).toBe(5000);
    expect(resA.body.totals.completed).toBe(2);
    expect(resA.body.totals.cancelled).toBe(1);

    const resB = await barberB.agent.get("/api/barber/stats");
    expect(resB.status).toBe(200);
    expect(resB.body.totals.bookings).toBe(1);
    expect(resB.body.totals.revenueMinor).toBe(1000);
  });

  it("agrège dans le fuseau du barber (jour et heure locaux)", async () => {
    const utc = await seedBarber("utc@example.com", "UTC");
    const ny = await seedBarber("ny@example.com", "America/New_York");
    const client = await register("client@example.com", "CLIENT");
    const startAt = "2026-02-01T02:00:00.000Z";

    await insertBooking({
      barberProfileId: utc.barberId,
      serviceId: utc.serviceId,
      clientUserId: client.id,
      startAt,
      status: "COMPLETED",
      priceMinor: 1000,
    });
    await insertBooking({
      barberProfileId: ny.barberId,
      serviceId: ny.serviceId,
      clientUserId: client.id,
      startAt,
      status: "COMPLETED",
      priceMinor: 1000,
    });

    const query = "?range=custom&from=2026-01-31&to=2026-02-02";
    const utcRes = await utc.agent.get(`/api/barber/stats${query}`);
    const nyRes = await ny.agent.get(`/api/barber/stats${query}`);
    expect(utcRes.status).toBe(200);
    expect(nyRes.status).toBe(200);

    // Même instant : 02:00 UTC pour l'un, 21:00 la veille pour New York.
    expect(
      utcRes.body.appointmentsByMonth.find((b: { key: string }) => b.key === "2026-02")
        ?.count,
    ).toBe(1);
    expect(
      nyRes.body.appointmentsByMonth.find((b: { key: string }) => b.key === "2026-01")
        ?.count,
    ).toBe(1);
    expect(
      utcRes.body.busiestHours.find((b: { key: string }) => b.key === "2")?.count,
    ).toBe(1);
    expect(
      nyRes.body.busiestHours.find((b: { key: string }) => b.key === "21")?.count,
    ).toBe(1);
  });

  it("expose la note moyenne globale même hors période", async () => {
    const barber = await seedBarber("rating@example.com", "UTC");
    const client = await register("rating-client@example.com", "CLIENT");

    const bookingId = await insertBooking({
      barberProfileId: barber.barberId,
      serviceId: barber.serviceId,
      clientUserId: client.id,
      startAt: "2025-06-01T10:00:00.000Z",
      status: "COMPLETED",
      priceMinor: 2500,
    });
    await db.insert(reviews).values({
      id: randomUUID(),
      bookingId,
      rating: 5,
      comment: null,
    });

    const res = await barber.agent.get("/api/barber/stats?range=7d");
    expect(res.status).toBe(200);
    // La réservation est hors période, mais la note est globale.
    expect(res.body.totals.bookings).toBe(0);
    expect(res.body.rating.totalReviews).toBe(1);
    expect(res.body.rating.averageRating).toBe(5);
  });
});
