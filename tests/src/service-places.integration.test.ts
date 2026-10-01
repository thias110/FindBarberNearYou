import { randomUUID } from "node:crypto";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../../server/src/app";
import { db } from "../../server/src/db/client";
import { migrateDb } from "../../server/src/db/migrate";
import {
  barberProfilePlaces,
  barberProfiles,
  barberServices,
  barberTimeOff,
  barberWorkingHours,
  users,
} from "@findbarber/shared/schema";

const app = createApp();
const PASSWORD = "password123";

beforeAll(async () => {
  await migrateDb();
});

beforeEach(async () => {
  await db.delete(barberProfilePlaces);
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

async function setupBarber(
  email: string,
  overrides: Record<string, unknown> = {},
) {
  await registerBarber(email);
  const { agent, csrf } = await login(email);
  const created = await agent
    .put("/api/barber/profile")
    .set("X-CSRF-Token", csrf)
    .send(profilePayload(overrides));
  return { agent, csrf, created };
}

async function updateProfile(
  agent: request.SuperAgentTest,
  csrf: string,
  overrides: Record<string, unknown>,
) {
  return agent
    .put("/api/barber/profile")
    .set("X-CSRF-Token", csrf)
    .send(profilePayload(overrides));
}

describe("service places — profil et confidentialité", () => {
  it("creates a SALON profile: address privée exacte, rayon null", async () => {
    const { agent, created } = await setupBarber("salon@example.com");
    expect(created.status).toBe(200);
    expect(created.body.profile.places).toEqual(["SALON"]);
    expect(created.body.profile.address).toBe("Rue du Test 1");
    expect(created.body.profile.travelRadiusKm).toBeNull();

    const own = await agent.get("/api/barber/profile");
    expect(own.body.profile.address).toBe("Rue du Test 1");
    expect(own.body.profile.latitude).toBe(46.2044);
  });

  it("creates a mobile-only profile without an address", async () => {
    const { created } = await setupBarber("mobile@example.com", {
      places: ["AT_CLIENT"],
      address: null,
      travelRadiusKm: 8,
    });
    expect(created.status).toBe(200);
    expect(created.body.profile.address).toBeNull();
    expect(created.body.profile.places).toEqual(["AT_CLIENT"]);
    expect(created.body.profile.travelRadiusKm).toBe(8);

    const publicRes = await request(app).get(
      `/api/barbers/${created.body.profile.id as string}`,
    );
    expect(publicRes.status).toBe(200);
    expect(publicRes.body.profile).not.toHaveProperty("address");
    expect(publicRes.body.profile.places).toEqual(["AT_CLIENT"]);
    expect(publicRes.body.profile.latitude).toBe(46.2);
    expect(publicRes.body.profile.longitude).toBe(6.14);
  });

  it("replaces places and clears the radius when leaving AT_CLIENT", async () => {
    const { agent, csrf } = await setupBarber("switch@example.com", {
      places: ["AT_CLIENT"],
      address: null,
      travelRadiusKm: 12,
    });

    const updated = await updateProfile(agent, csrf, {
      places: ["SALON"],
      address: "Rue 9",
      travelRadiusKm: null,
    });
    expect(updated.status).toBe(200);
    expect(updated.body.profile.places).toEqual(["SALON"]);
    expect(updated.body.profile.address).toBe("Rue 9");
    expect(updated.body.profile.travelRadiusKm).toBeNull();

    const rows = await db.select().from(barberProfilePlaces);
    expect(rows.map((row) => row.place)).toEqual(["SALON"]);
  });

  it("rejects an address-less SALON/AT_PROVIDER and a radius outside AT_CLIENT", async () => {
    const { agent, csrf } = await setupBarber("rules@example.com");

    const noAddress = await updateProfile(agent, csrf, {
      places: ["SALON"],
      address: null,
      travelRadiusKm: null,
    });
    expect(noAddress.status).toBe(400);
    expect(noAddress.body.error.code).toBe("VALIDATION_ERROR");

    const mobileNoRadius = await updateProfile(agent, csrf, {
      places: ["AT_CLIENT"],
      address: null,
      travelRadiusKm: null,
    });
    expect(mobileNoRadius.status).toBe(400);

    const radiusForSalon = await updateProfile(agent, csrf, {
      places: ["SALON"],
      address: "Rue 1",
      travelRadiusKm: 10,
    });
    expect(radiusForSalon.status).toBe(400);

    const emptyPlaces = await updateProfile(agent, csrf, { places: [] });
    expect(emptyPlaces.status).toBe(400);
  });

  it("keeps the exact address and coordinates out of public responses", async () => {
    const { agent, created } = await setupBarber("secret@example.com", {
      address: "12 Rue Secrète",
      latitude: 46.20449,
      longitude: 6.14321,
    });
    expect(created.status).toBe(200);
    const barberId = created.body.profile.id as string;

    const publicProfile = await request(app).get(`/api/barbers/${barberId}`);
    expect(publicProfile.status).toBe(200);
    expect(publicProfile.body.profile).not.toHaveProperty("address");
    expect(JSON.stringify(publicProfile.body)).not.toContain("12 Rue Secrète");
    expect(publicProfile.body.profile.latitude).toBe(46.2);
    expect(publicProfile.body.profile.longitude).toBe(6.14);

    const search = await request(app).get("/api/barbers");
    expect(JSON.stringify(search.body)).not.toContain("12 Rue Secrète");
    expect(search.body.barbers[0].latitude).toBe(46.2);
    expect(search.body.barbers[0].longitude).toBe(6.14);

    // Le propriétaire conserve l'adresse exacte dans sa réponse privée.
    const own = await agent.get("/api/barber/profile");
    expect(own.body.profile.address).toBe("12 Rue Secrète");
  });

  it("rounds negative coordinates and preserves geographic bounds publicly", async () => {
    const { agent, created } = await setupBarber("south@example.com", {
      latitude: -33.8688,
      longitude: 151.2093,
    });
    expect(created.status).toBe(200);
    const barberId = created.body.profile.id as string;

    const publicRes = await request(app).get(`/api/barbers/${barberId}`);
    expect(publicRes.body.profile.latitude).toBe(-33.87);
    expect(publicRes.body.profile.longitude).toBe(151.21);

    // Valeur stockée/privée inchangée (jamais réécrite).
    const own = await agent.get("/api/barber/profile");
    expect(own.body.profile.latitude).toBe(-33.8688);
    expect(own.body.profile.longitude).toBe(151.2093);

    // Bornes géographiques acceptées et conservées par l'arrondi.
    const { created: bounds } = await setupBarber("bounds@example.com", {
      latitude: 90,
      longitude: -180,
    });
    const boundsPublic = await request(app).get(
      `/api/barbers/${bounds.body.profile.id as string}`,
    );
    expect(boundsPublic.body.profile.latitude).toBe(90);
    expect(boundsPublic.body.profile.longitude).toBe(-180);
  });
});

describe("service places — recherche et compatibilité", () => {
  it("filters by place and keeps historical profiles without places", async () => {
    await setupBarber("a-place@example.com", { displayName: "Alpha" });
    await setupBarber("b-place@example.com", {
      displayName: "Beta",
      places: ["AT_CLIENT"],
      address: null,
      travelRadiusKm: 15,
    });

    // Profil historique : inséré directement, sans lieu déclaré.
    const legacyUser = await registerBarber("legacy-place@example.com");
    await db.insert(barberProfiles).values({
      id: randomUUID(),
      userId: legacyUser.id,
      displayName: "Legacy",
      description: "Profil historique",
      address: null,
      city: "Genève",
      postalCode: null,
      countryCode: "CH",
      latitude: 46.2,
      longitude: 6.14,
      currency: "CHF",
      timezone: null,
      travelRadiusKm: null,
    });
    expect(
      await db.select().from(barberProfilePlaces),
    ).toHaveLength(2);

    const all = await request(app).get("/api/barbers");
    expect(all.body.barbers).toHaveLength(3);

    const salon = await request(app).get("/api/barbers").query({ place: "SALON" });
    expect(salon.body.barbers.map((b: { displayName: string }) => b.displayName)).toEqual([
      "Alpha",
    ]);

    const mobile = await request(app)
      .get("/api/barbers")
      .query({ place: "AT_CLIENT" });
    expect(mobile.body.barbers.map((b: { displayName: string }) => b.displayName)).toEqual([
      "Beta",
    ]);

    const legacyPublic = await request(app).get("/api/barbers");
    const legacy = legacyPublic.body.barbers.find(
      (b: { displayName: string }) => b.displayName === "Legacy",
    );
    expect(legacy.places).toEqual([]);
  });

  it("rejects an unknown place filter", async () => {
    const res = await request(app).get("/api/barbers").query({ place: "HOME" });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });
});

describe("service places — accès", () => {
  it("requires authentication, BARBER role and CSRF", async () => {
    expect((await request(app).get("/api/barber/profile")).status).toBe(401);
    expect(
      (await request(app).put("/api/barber/profile").send(profilePayload())).status,
    ).toBe(401);

    await request(app)
      .post("/api/auth/register")
      .send({ email: "client-place@example.com", password: PASSWORD, role: "CLIENT" });
    const client = await login("client-place@example.com");
    expect((await client.agent.get("/api/barber/profile")).status).toBe(403);
    expect(
      (
        await client.agent
          .put("/api/barber/profile")
          .set("X-CSRF-Token", client.csrf)
          .send(profilePayload())
      ).status,
    ).toBe(403);

    await registerBarber("csrf-place@example.com");
    const barber = await login("csrf-place@example.com");
    const noCsrf = await barber.agent
      .put("/api/barber/profile")
      .send(profilePayload());
    expect(noCsrf.status).toBe(403);
    expect(noCsrf.body.error.code).toBe("CSRF_INVALID");
  });
});
