import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { eq } from "drizzle-orm";
import { createApp } from "../../server/src/app";
import { db } from "../../server/src/db/client";
import { migrateDb } from "../../server/src/db/migrate";
import {
  barberProfiles,
  barberServiceAudiences,
  barberServices,
  barberServiceTechniques,
  users,
} from "@findbarber/shared/schema";

const app = createApp();
const PASSWORD = "password123";

beforeAll(async () => {
  await migrateDb();
});

beforeEach(async () => {
  // Ordre des FK : tags -> services -> profils -> users.
  await db.delete(barberServiceAudiences);
  await db.delete(barberServiceTechniques);
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
    ...overrides,
  };
}

function servicePayload(overrides: Record<string, unknown> = {}) {
  return {
    name: "Coupe classique",
    description: null,
    durationMinutes: 30,
    priceMinor: 2500,
    audiences: [],
    techniques: [],
    ...overrides,
  };
}

async function registerBarber(email: string) {
  const res = await request(app)
    .post("/api/auth/register")
    .send({ email, password: PASSWORD, role: "BARBER" });
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

async function createProfile(
  agent: request.SuperAgentTest,
  csrf: string,
  overrides: Record<string, unknown> = {},
) {
  return agent
    .put("/api/barber/profile")
    .set("X-CSRF-Token", csrf)
    .send(profilePayload(overrides));
}

async function setupBarber(
  email: string,
  overrides: Record<string, unknown> = {},
) {
  await registerBarber(email);
  const { agent, csrf } = await login(email);
  const profile = await createProfile(agent, csrf, overrides);
  expect(profile.status).toBe(200);
  return {
    agent,
    csrf,
    profileId: profile.body.profile.id as string,
  };
}

async function addService(
  agent: request.SuperAgentTest,
  csrf: string,
  overrides: Record<string, unknown> = {},
) {
  const res = await agent
    .post("/api/barber/services")
    .set("X-CSRF-Token", csrf)
    .send(servicePayload(overrides));
  expect(res.status).toBe(201);
  return res.body.service as {
    id: string;
    name: string;
    audiences: string[];
    techniques: string[];
    isActive: boolean;
  };
}

describe("GET /api/barbers", () => {
  it("works without authentication and exposes only whitelisted fields", async () => {
    const { profileId } = await setupBarber("noauth@example.com", {
      displayName: "Alpha Barber",
      city: "Genève",
    });

    const res = await request(app).get("/api/barbers");
    expect(res.status).toBe(200);
    expect(res.body.barbers).toHaveLength(1);

    const item = res.body.barbers[0] as Record<string, unknown>;
    expect(item.id).toBe(profileId);
    expect(item.displayName).toBe("Alpha Barber");
    expect(item.city).toBe("Genève");
    expect(item.countryCode).toBe("CH");
    expect(item.activeServiceCount).toBe(0);
    expect(item).not.toHaveProperty("email");
    expect(item).not.toHaveProperty("userId");
    expect(item).not.toHaveProperty("passwordHash");
    expect(item).not.toHaveProperty("address");
    expect(item).not.toHaveProperty("currency");
    expect(item).not.toHaveProperty("createdAt");
    // Coordonnées publiques du commerce (lot 4) : exposées explicitement et exactes.
    expect(item.latitude).toBe(46.2044);
    expect(item.longitude).toBe(6.1432);
  });

  it("filters by q and city, case-insensitively, trimming spaces", async () => {
    await setupBarber("a@example.com", { displayName: "Barbier Alpha", city: "Genève" });
    await setupBarber("b@example.com", { displayName: "Beta Coiffure", city: "Lausanne" });

    const byName = await request(app).get("/api/barbers").query({ q: "alpha" });
    expect(byName.body.barbers.map((b: { displayName: string }) => b.displayName)).toEqual([
      "Barbier Alpha",
    ]);

    const byCity = await request(app).get("/api/barbers").query({ city: "  genève  " });
    expect(byCity.body.barbers.map((b: { displayName: string }) => b.displayName)).toEqual([
      "Barbier Alpha",
    ]);
  });

  it("treats % and _ as literal characters, not wildcards", async () => {
    await setupBarber("pct@example.com", { displayName: "100% Nature" });
    await setupBarber("under@example.com", { displayName: "A_B Barber" });
    await setupBarber("normal@example.com", { displayName: "Normal Barber" });

    const byPct = await request(app).get("/api/barbers").query({ q: "%" });
    expect(byPct.body.barbers.map((b: { displayName: string }) => b.displayName)).toEqual([
      "100% Nature",
    ]);

    const byUnderscore = await request(app).get("/api/barbers").query({ q: "_" });
    expect(
      byUnderscore.body.barbers.map((b: { displayName: string }) => b.displayName),
    ).toEqual(["A_B Barber"]);
  });

  it("rejects invalid, repeated and unknown parameters", async () => {
    expect((await request(app).get("/api/barbers?audience=XYZ")).status).toBe(400);
    expect((await request(app).get("/api/barbers?technique=XYZ")).status).toBe(400);
    expect((await request(app).get("/api/barbers?countryCode=XX")).status).toBe(400);
    expect((await request(app).get("/api/barbers?page=0")).status).toBe(400);
    expect((await request(app).get("/api/barbers?page=abc")).status).toBe(400);
    expect((await request(app).get("/api/barbers?pageSize=51")).status).toBe(400);
    expect((await request(app).get("/api/barbers?page=")).status).toBe(400);
    expect((await request(app).get("/api/barbers?pageSize=")).status).toBe(400);
    expect((await request(app).get("/api/barbers?q=a&q=b")).status).toBe(400);
    expect((await request(app).get("/api/barbers?page=1&page=2")).status).toBe(400);
    expect((await request(app).get("/api/barbers?foo=bar")).status).toBe(400);

    // Une valeur vide sur un filtre énuméré est ignorée (pas une erreur).
    expect((await request(app).get("/api/barbers?audience=")).status).toBe(200);
  });

  it("excludes suspended and non-BARBER owners", async () => {
    await setupBarber("suspended@example.com", { displayName: "Suspended Barber" });
    const [user] = await db.select().from(users).where(eq(users.email, "suspended@example.com"));
    await db.update(users).set({ status: "SUSPENDED" }).where(eq(users.id, user.id));
    expect((await request(app).get("/api/barbers")).body.barbers).toHaveLength(0);

    // Réactive puis perte du rôle BARBER.
    await db.update(users).set({ status: "ACTIVE", role: "CLIENT" }).where(eq(users.id, user.id));
    expect((await request(app).get("/api/barbers")).body.barbers).toHaveLength(0);
  });

  it("requires audience and technique to match the same active service", async () => {
    const x = await setupBarber("x@example.com", { displayName: "Barber X" });
    await addService(x.agent, x.csrf, { audiences: ["FEMME"], techniques: [] });
    await addService(x.agent, x.csrf, { audiences: [], techniques: ["COUPE"] });

    const y = await setupBarber("y@example.com", { displayName: "Barber Y" });
    await addService(y.agent, y.csrf, { audiences: ["FEMME"], techniques: ["COUPE"] });

    const res = await request(app)
      .get("/api/barbers")
      .query({ audience: "FEMME", technique: "COUPE" });
    expect(res.body.barbers.map((b: { displayName: string }) => b.displayName)).toEqual([
      "Barber Y",
    ]);
  });

  it("never matches a disabled service, but keeps the profile visible without filters", async () => {
    const x = await setupBarber("disabled@example.com", { displayName: "Disabled Barber" });
    const svc = await addService(x.agent, x.csrf, {
      audiences: ["FEMME"],
      techniques: ["COUPE"],
    });
    await x.agent
      .patch(`/api/barber/services/${svc.id}`)
      .set("X-CSRF-Token", x.csrf)
      .send({ isActive: false });

    const byAudience = await request(app).get("/api/barbers").query({ audience: "FEMME" });
    expect(byAudience.body.barbers).toHaveLength(0);

    const noFilter = await request(app).get("/api/barbers");
    expect(noFilter.body.barbers).toHaveLength(1);
    expect(noFilter.body.barbers[0].activeServiceCount).toBe(0);
  });

  it("returns a barber once even when multiple services match", async () => {
    const x = await setupBarber("dup@example.com", { displayName: "Dup Barber" });
    await addService(x.agent, x.csrf, { audiences: ["FEMME"], name: "Service 1" });
    await addService(x.agent, x.csrf, { audiences: ["FEMME"], name: "Service 2" });

    const res = await request(app).get("/api/barbers").query({ audience: "FEMME" });
    expect(res.body.barbers).toHaveLength(1);
    expect(res.body.barbers[0].activeServiceCount).toBe(2);
  });

  it("paginates stably and computes a correct total", async () => {
    await setupBarber("p1@example.com", { displayName: "Alpha" });
    await setupBarber("p2@example.com", { displayName: "beta" });
    await setupBarber("p3@example.com", { displayName: "Charlie" });

    const page1 = await request(app).get("/api/barbers").query({ page: 1, pageSize: 2 });
    expect(page1.body.barbers.map((b: { displayName: string }) => b.displayName)).toEqual([
      "Alpha",
      "beta",
    ]);
    expect(page1.body.pagination).toMatchObject({
      page: 1,
      pageSize: 2,
      total: 3,
      totalPages: 2,
    });

    const page2 = await request(app).get("/api/barbers").query({ page: 2, pageSize: 2 });
    expect(page2.body.barbers.map((b: { displayName: string }) => b.displayName)).toEqual([
      "Charlie",
    ]);
  });

  it("keeps legacy uncategorized services visible but excluded from category filters", async () => {
    const x = await setupBarber("legacy@example.com", { displayName: "Legacy Barber" });
    await addService(x.agent, x.csrf, {
      name: "Ancien service",
      audiences: [],
      techniques: [],
    });

    const noFilter = await request(app).get("/api/barbers");
    expect(noFilter.body.barbers).toHaveLength(1);
    expect(noFilter.body.barbers[0].activeServiceCount).toBe(1);
    expect(noFilter.body.barbers[0].audiences).toEqual([]);
    expect(noFilter.body.barbers[0].techniques).toEqual([]);

    const byAudience = await request(app).get("/api/barbers").query({ audience: "FEMME" });
    expect(byAudience.body.barbers).toHaveLength(0);
  });

  it("exposes exact public coordinates with filters and across pages", async () => {
    await setupBarber("coord-a@example.com", {
      displayName: "Alpha",
      city: "Genève",
      latitude: 46.2044,
      longitude: 6.1432,
    });
    await setupBarber("coord-b@example.com", {
      displayName: "Beta",
      city: "Lausanne",
      latitude: 46.5197,
      longitude: 6.6323,
    });

    const all = await request(app).get("/api/barbers");
    const byName = Object.fromEntries(
      all.body.barbers.map((b: { displayName: string; latitude: number; longitude: number }) => [
        b.displayName,
        { latitude: b.latitude, longitude: b.longitude },
      ]),
    );
    expect(byName.Alpha).toEqual({ latitude: 46.2044, longitude: 6.1432 });
    expect(byName.Beta).toEqual({ latitude: 46.5197, longitude: 6.6323 });

    // Filtre ville : la coordonnée renvoyée reste celle du profil correspondant.
    const filtered = await request(app).get("/api/barbers").query({ city: "Lausanne" });
    expect(filtered.body.barbers).toHaveLength(1);
    expect(filtered.body.barbers[0].latitude).toBe(46.5197);
    expect(filtered.body.barbers[0].longitude).toBe(6.6323);

    // Pagination : chaque page porte les coordonnées de ses propres profils.
    const page1 = await request(app).get("/api/barbers").query({ page: 1, pageSize: 1 });
    expect(page1.body.barbers[0].displayName).toBe("Alpha");
    expect(page1.body.barbers[0].latitude).toBe(46.2044);
    expect(page1.body.pagination).toMatchObject({ page: 1, total: 2, totalPages: 2 });

    const page2 = await request(app).get("/api/barbers").query({ page: 2, pageSize: 1 });
    expect(page2.body.barbers[0].displayName).toBe("Beta");
    expect(page2.body.barbers[0].longitude).toBe(6.6323);
  });
});

describe("service categories lifecycle", () => {
  it("creates, preserves on partial PATCH, clears and replaces selections", async () => {
    const { agent, csrf } = await setupBarber("tags@example.com");
    const created = await addService(agent, csrf, {
      audiences: ["FEMME", "HOMME"],
      techniques: ["COUPE", "DEGRADE"],
    });
    expect(created.audiences).toEqual(["FEMME", "HOMME"]);
    expect(created.techniques).toEqual(["COUPE", "DEGRADE"]);

    // PATCH ne touchant que le prix : les catégories sont conservées.
    const priceOnly = await agent
      .patch(`/api/barber/services/${created.id}`)
      .set("X-CSRF-Token", csrf)
      .send({ priceMinor: 3000 });
    expect(priceOnly.status).toBe(200);
    expect(priceOnly.body.service.priceMinor).toBe(3000);
    expect(priceOnly.body.service.audiences).toEqual(["FEMME", "HOMME"]);
    expect(priceOnly.body.service.techniques).toEqual(["COUPE", "DEGRADE"]);

    // Tableau vide explicite → suppression des publics (les techniques restent).
    const cleared = await agent
      .patch(`/api/barber/services/${created.id}`)
      .set("X-CSRF-Token", csrf)
      .send({ audiences: [] });
    expect(cleared.status).toBe(200);
    expect(cleared.body.service.audiences).toEqual([]);
    expect(cleared.body.service.techniques).toEqual(["COUPE", "DEGRADE"]);

    // Tableau renseigné → remplacement.
    const replaced = await agent
      .patch(`/api/barber/services/${created.id}`)
      .set("X-CSRF-Token", csrf)
      .send({ audiences: ["ENFANT"] });
    expect(replaced.status).toBe(200);
    expect(replaced.body.service.audiences).toEqual(["ENFANT"]);
    expect(replaced.body.service.techniques).toEqual(["COUPE", "DEGRADE"]);
  });

  it("rejects unknown categories and refuses another barber's service", async () => {
    const a = await setupBarber("owner@example.com", { displayName: "Owner Barber" });
    const created = await addService(a.agent, a.csrf);

    const badCreate = await a.agent
      .post("/api/barber/services")
      .set("X-CSRF-Token", a.csrf)
      .send(servicePayload({ audiences: ["XYZ"] }));
    expect(badCreate.status).toBe(400);
    expect(badCreate.body.error.code).toBe("VALIDATION_ERROR");

    const badTechnique = await a.agent
      .patch(`/api/barber/services/${created.id}`)
      .set("X-CSRF-Token", a.csrf)
      .send({ techniques: ["UNKNOWN"] });
    expect(badTechnique.status).toBe(400);

    const b = await setupBarber("other@example.com", { displayName: "Other Barber" });
    const denied = await b.agent
      .patch(`/api/barber/services/${created.id}`)
      .set("X-CSRF-Token", b.csrf)
      .send({ audiences: ["FEMME"] });
    expect(denied.status).toBe(404);
    expect(denied.body.error.code).toBe("SERVICE_NOT_FOUND");
  });

  it("enforces uniqueness and enum validity at the database level", async () => {
    const { agent, csrf } = await setupBarber("db-tags@example.com");
    const svc = await addService(agent, csrf, { audiences: ["FEMME"] });

    await expect(
      db.insert(barberServiceAudiences).values({ serviceId: svc.id, audience: "FEMME" }),
    ).rejects.toThrow();

    await expect(
      db.insert(barberServiceAudiences).values({ serviceId: svc.id, audience: "XYZ" as never }),
    ).rejects.toThrow();

    await expect(
      db.insert(barberServiceAudiences).values({ serviceId: svc.id, audience: "HOMME" }),
    ).resolves.toBeDefined();
  });
});
