import { randomUUID } from "node:crypto";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../../server/src/app";
import { db } from "../../server/src/db/client";
import { migrateDb } from "../../server/src/db/migrate";
import {
  barberProfiles,
  barberServiceAudiences,
  barberServices,
  barberServiceTechniques,
  bookings,
  reviews,
  users,
} from "@findbarber/shared/schema";
import {
  DEFAULT_POPULAR_TECHNIQUES,
  type BookingStatus,
  type Technique,
} from "@findbarber/shared/constants";
import { markEmailVerified } from "./auth-helpers";

// Prestations populaires (issue #47) : classement des techniques les plus
// réservées, calculé côté serveur, complété par la liste par défaut.

const app = createApp();
const PASSWORD = "password123";

beforeAll(async () => {
  await migrateDb();
});

beforeEach(async () => {
  await db.delete(reviews);
  await db.delete(bookings);
  await db.delete(barberServiceAudiences);
  await db.delete(barberServiceTechniques);
  await db.delete(barberServices);
  await db.delete(barberProfiles);
  await db.delete(users);
});

async function register(email: string, role: "BARBER" | "CLIENT") {
  const res = await request(app)
    .post("/api/auth/register")
    .send({ email, password: PASSWORD, role });
  expect(res.status).toBe(201);
  await markEmailVerified(email);
  return res.body.user.id as string;
}

async function setupBarberWithServices(
  email: string,
  services: Technique[][],
): Promise<{ profileId: string; serviceIds: string[] }> {
  await register(email, "BARBER");
  const agent = request.agent(app);
  const login = await agent.post("/api/auth/login").send({ email, password: PASSWORD });
  expect(login.status).toBe(200);
  const csrf = login.body.csrfToken as string;
  const profile = await agent
    .put("/api/barber/profile")
    .set("X-CSRF-Token", csrf)
    .send({
      displayName: "Barbier Populaire",
      description: "Coupes",
      address: "Rue du Test 1",
      city: "Genève",
      postalCode: "1201",
      countryCode: "CH",
      latitude: 46.2,
      longitude: 6.14,
      currency: "CHF",
      places: ["SALON"],
    });
  expect(profile.status).toBe(200);
  const serviceIds: string[] = [];
  for (const [index, techniques] of services.entries()) {
    const res = await agent
      .post("/api/barber/services")
      .set("X-CSRF-Token", csrf)
      .send({
        name: `Service ${index}`,
        description: null,
        durationMinutes: 30,
        priceMinor: 2500,
        audiences: [],
        techniques,
      });
    expect(res.status).toBe(201);
    serviceIds.push(res.body.service.id as string);
  }
  return { profileId: profile.body.profile.id as string, serviceIds };
}

let dayOffset = 0;

async function book(
  clientUserId: string,
  barberProfileId: string,
  serviceId: string,
  status: BookingStatus,
  times = 1,
) {
  for (let i = 0; i < times; i += 1) {
    dayOffset += 1;
    const startAt = new Date(Date.UTC(2025, 0, 1, 10) + dayOffset * 86_400_000);
    await db.insert(bookings).values({
      id: randomUUID(),
      clientUserId,
      barberProfileId,
      serviceId,
      startAt,
      endAt: new Date(startAt.getTime() + 30 * 60_000),
      servicePlace: "SALON",
      status,
      barberDisplayName: "Barbier Populaire",
      serviceName: "Service",
      serviceDescription: null,
      durationMinutes: 30,
      priceMinor: 2500,
      currency: "CHF",
    });
  }
}

describe("GET /api/barbers/popular-techniques", () => {
  it("returns the default list when there is no booking", async () => {
    const res = await request(app).get("/api/barbers/popular-techniques");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ techniques: [...DEFAULT_POPULAR_TECHNIQUES] });
  });

  it("ranks techniques by confirmed and completed bookings only", async () => {
    const { profileId, serviceIds } = await setupBarberWithServices("pop@example.com", [
      ["LOCKS"],
      ["TAPER", "BARBE"],
      ["COLORATION"],
    ]);
    const [locks, taperBarbe, coloration] = serviceIds;
    const clientId = await register("client-pop@example.com", "CLIENT");

    await book(clientId, profileId, locks, "COMPLETED", 2);
    await book(clientId, profileId, locks, "CONFIRMED", 1);
    await book(clientId, profileId, taperBarbe, "COMPLETED", 2);
    // Statuts exclus : même nombreux, ils ne comptent pas.
    for (const status of ["CANCELLED", "DECLINED", "EXPIRED", "NO_SHOW", "PENDING"] as const) {
      await book(clientId, profileId, coloration, status, 2);
    }

    const res = await request(app).get("/api/barbers/popular-techniques");
    expect(res.status).toBe(200);
    // LOCKS (3), puis TAPER et BARBE (2, ex æquo départagés par l'ordre du
    // catalogue TECHNIQUES), complété par la liste par défaut sans doublon.
    expect(res.body.techniques).toEqual(["LOCKS", "TAPER", "BARBE", "COUPE", "DEGRADE"]);
    // Agrégat seul : aucune donnée de réservation individuelle.
    expect(Object.keys(res.body)).toEqual(["techniques"]);
  });

  it("rejects unknown query parameters", async () => {
    const res = await request(app).get("/api/barbers/popular-techniques?foo=bar");
    expect(res.status).toBe(400);
  });
});
