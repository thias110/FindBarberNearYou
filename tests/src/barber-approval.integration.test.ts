// Approbation des nouveaux profils barber (issue #40) : un profil neuf est
// invisible du public (recherche, profil, créneaux, avis, photos) et non
// réservable tant que l'ADMIN ne l'a pas approuvé ; seul l'ADMIN approuve,
// l'action est tracée, et le barber voit son statut.
import request from "supertest";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../server/src/app";
import { db } from "../../server/src/db/client";
import { migrateDb } from "../../server/src/db/migrate";
import { auditLogs } from "@findbarber/shared/schema";
import {
  createUser,
  futureDate,
  login,
  resetBookingTables,
  type Session,
} from "./booking-api-helpers";

const app = createApp();
const BARBER = "pending-barber@example.com";

beforeAll(async () => {
  await migrateDb();
});

beforeEach(async () => {
  await db.delete(auditLogs);
  await resetBookingTables();
});

// Profil créé par le barber lui-même, comme en production : jamais approuvé.
async function newBarber(): Promise<{ pro: Session; profileId: string; serviceId: string }> {
  await createUser(BARBER, "BARBER");
  const pro = await login(app, BARBER);
  const profile = await pro.agent
    .put("/api/barber/profile")
    .set("X-CSRF-Token", pro.csrf)
    .send({
      displayName: "Barbier En Attente",
      description: "Nouveau barber",
      address: "Rue du Test 1",
      city: "Genève",
      postalCode: "1201",
      countryCode: "CH",
      latitude: 46.2044,
      longitude: 6.1432,
      currency: "CHF",
      places: ["SALON"],
      timezone: "UTC",
    });
  expect(profile.status).toBe(200);
  const service = await pro.agent
    .post("/api/barber/services")
    .set("X-CSRF-Token", pro.csrf)
    .send({
      name: "Coupe",
      description: null,
      durationMinutes: 30,
      priceMinor: 3000,
      audiences: [],
      techniques: [],
    });
  expect(service.status).toBe(201);
  return {
    pro,
    profileId: profile.body.profile.id as string,
    serviceId: service.body.service.id as string,
  };
}

async function searchIds(): Promise<string[]> {
  const res = await request(app).get("/api/barbers");
  expect(res.status).toBe(200);
  return (res.body.barbers as { id: string }[]).map((b) => b.id);
}

describe("profil barber en attente d'approbation", () => {
  it("est invisible du public et non réservable", async () => {
    const { profileId, serviceId } = await newBarber();

    expect(await searchIds()).not.toContain(profileId);
    for (const path of [
      `/api/barbers/${profileId}`,
      `/api/barbers/${profileId}/reviews`,
      `/api/barbers/${profileId}/photos`,
      `/api/barbers/${profileId}/slots?serviceId=${serviceId}&date=${futureDate(3)}&place=SALON`,
    ]) {
      expect((await request(app).get(path)).status, path).toBe(404);
    }

    await createUser("client@example.com", "CLIENT");
    const client = await login(app, "client@example.com");
    const booking = await client.agent
      .post("/api/bookings")
      .set("X-CSRF-Token", client.csrf)
      .send({
        barberId: profileId,
        serviceId,
        date: futureDate(3),
        startMinute: 600,
        place: "SALON",
      });
    expect(booking.status).toBe(404);
  });

  it("le barber voit que son profil attend une validation", async () => {
    const { pro } = await newBarber();
    const own = await pro.agent.get("/api/barber/profile");
    expect(own.body.profile.approved).toBe(false);
  });
});

describe("approbation par l'ADMIN", () => {
  it("rend le profil visible immédiatement et trace l'action", async () => {
    const { pro, profileId } = await newBarber();
    const adminId = await createUser("admin@example.com", "ADMIN");
    const admin = await login(app, "admin@example.com");

    const pending = await admin.agent.get("/api/admin/users?pendingApproval=true");
    expect(pending.status).toBe(200);
    expect(pending.body.users).toHaveLength(1);
    expect(pending.body.users[0]).toMatchObject({
      email: BARBER,
      barberProfileId: profileId,
      barberPendingApproval: true,
    });
    const metrics = await admin.agent.get("/api/admin/metrics");
    expect(metrics.body.barbers.pendingApproval).toBe(1);

    const approved = await admin.agent
      .post(`/api/admin/barbers/${profileId}/approve`)
      .set("X-CSRF-Token", admin.csrf);
    expect(approved.status).toBe(200);
    expect(approved.body.user.barberPendingApproval).toBe(false);

    expect(await searchIds()).toContain(profileId);
    expect((await request(app).get(`/api/barbers/${profileId}`)).status).toBe(200);
    expect((await pro.agent.get("/api/barber/profile")).body.profile.approved).toBe(true);
    expect(
      (await admin.agent.get("/api/admin/users?pendingApproval=true")).body.users,
    ).toHaveLength(0);

    const [entry] = await db.select().from(auditLogs);
    expect(entry).toMatchObject({
      action: "BARBER_APPROVED",
      actorUserId: adminId,
      actorRole: "ADMIN",
      targetType: "BARBER_PROFILE",
      targetId: profileId,
    });

    const again = await admin.agent
      .post(`/api/admin/barbers/${profileId}/approve`)
      .set("X-CSRF-Token", admin.csrf);
    expect(again.status).toBe(409);
    expect(again.body.error.code).toBe("BARBER_ALREADY_APPROVED");
  });

  it("refuse l'approbation au barber lui-même, au client et aux anonymes", async () => {
    const { pro, profileId } = await newBarber();
    const self = await pro.agent
      .post(`/api/admin/barbers/${profileId}/approve`)
      .set("X-CSRF-Token", pro.csrf);
    expect(self.status).toBe(403);

    await createUser("client@example.com", "CLIENT");
    const client = await login(app, "client@example.com");
    const byClient = await client.agent
      .post(`/api/admin/barbers/${profileId}/approve`)
      .set("X-CSRF-Token", client.csrf);
    expect(byClient.status).toBe(403);

    expect(
      (await request(app).post(`/api/admin/barbers/${profileId}/approve`)).status,
    ).toBe(401);
    expect(await searchIds()).not.toContain(profileId);
    expect(await db.select().from(auditLogs)).toHaveLength(0);
  });

  it("renvoie 404 pour un profil inconnu", async () => {
    await createUser("admin@example.com", "ADMIN");
    const admin = await login(app, "admin@example.com");
    const res = await admin.agent
      .post("/api/admin/barbers/00000000-0000-4000-8000-000000000000/approve")
      .set("X-CSRF-Token", admin.csrf);
    expect(res.status).toBe(404);
  });
});
