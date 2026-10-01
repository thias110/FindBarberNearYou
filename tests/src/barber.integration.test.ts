import { randomUUID } from "node:crypto";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { eq } from "drizzle-orm";
import { createApp } from "../../server/src/app";
import { db } from "../../server/src/db/client";
import { migrateDb } from "../../server/src/db/migrate";
import { barberProfiles, barberServices, users } from "@findbarber/shared/schema";
import { classifyIanaTimeZone } from "@findbarber/shared/timezones";

const app = createApp();
const PASSWORD = "password123";

beforeAll(async () => {
  await migrateDb();
});

beforeEach(async () => {
  // Nettoyage dans l'ordre des clés étrangères (services -> profils -> users).
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
  const res = await agent
    .put("/api/barber/profile")
    .set("X-CSRF-Token", csrf)
    .send(profilePayload(overrides));
  return res;
}

describe("PUT /api/barber/profile", () => {
  it("creates then updates a profile, preserving id and createdAt", async () => {
    await registerBarber("profile@example.com");
    const { agent, csrf } = await login("profile@example.com");

    const created = await createProfile(agent, csrf);
    expect(created.status).toBe(200);
    expect(created.body.profile.displayName).toBe("Barbier Test");
    expect(created.body.profile.countryCode).toBe("CH");
    expect(created.body.profile.currency).toBe("CHF");

    const id = created.body.profile.id as string;
    const createdAt = created.body.profile.createdAt as string;

    const updated = await createProfile(agent, csrf, {
      displayName: "Barbier Deux",
      city: "Lausanne",
    });
    expect(updated.status).toBe(200);
    expect(updated.body.profile.id).toBe(id);
    expect(updated.body.profile.createdAt).toBe(createdAt);
    expect(updated.body.profile.displayName).toBe("Barbier Deux");
    expect(updated.body.profile.city).toBe("Lausanne");
  });

  it("keeps a single profile per user (idempotent PUT)", async () => {
    const user = await registerBarber("unique@example.com");
    const { agent, csrf } = await login("unique@example.com");

    await createProfile(agent, csrf);
    await createProfile(agent, csrf, { city: "Berne" });

    const rows = await db
      .select()
      .from(barberProfiles)
      .where(eq(barberProfiles.userId, user.id));
    expect(rows).toHaveLength(1);
    expect(rows[0].city).toBe("Berne");
  });

  it("enforces profile uniqueness at the database level", async () => {
    const user = await registerBarber("unique-db@example.com");
    const base = {
      userId: user.id,
      displayName: "Barbier",
      description: "Description",
      address: "Rue 1",
      city: "Genève",
      postalCode: null as string | null,
      countryCode: "CH",
      latitude: 46.2,
      longitude: 6.14,
      currency: "CHF" as const,
    };
    await db.insert(barberProfiles).values({ id: randomUUID(), ...base });
    await expect(
      db.insert(barberProfiles).values({ id: randomUUID(), ...base }),
    ).rejects.toThrow();
  });

  it("rejects a currency change with 409 and does not apply partial updates", async () => {
    await registerBarber("currency@example.com");
    const { agent, csrf } = await login("currency@example.com");

    await createProfile(agent, csrf, { currency: "CHF" });

    const res = await createProfile(agent, csrf, {
      currency: "EUR",
      displayName: "Nouveau Nom",
    });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("CURRENCY_CHANGE_FORBIDDEN");

    const rows = await db.select().from(barberProfiles);
    expect(rows).toHaveLength(1);
    expect(rows[0].currency).toBe("CHF");
    expect(rows[0].displayName).toBe("Barbier Test");
  });

  it("handles simultaneous creates with different currencies without 500 or two profiles", async () => {
    await registerBarber("concurrent@example.com");
    const first = await login("concurrent@example.com");
    const second = await login("concurrent@example.com");

    const [a, b] = await Promise.all([
      first.agent
        .put("/api/barber/profile")
        .set("X-CSRF-Token", first.csrf)
        .send(profilePayload({ currency: "CHF" })),
      second.agent
        .put("/api/barber/profile")
        .set("X-CSRF-Token", second.csrf)
        .send(profilePayload({ currency: "EUR" })),
    ]);

    expect([a.status, b.status].sort()).toEqual([200, 409]);

    const rows = await db.select().from(barberProfiles);
    expect(rows).toHaveLength(1);
    expect(["CHF", "EUR"]).toContain(rows[0].currency);
  });

  it("accepts CHF, EUR and USD profiles", async () => {
    for (const currency of ["CHF", "EUR", "USD"]) {
      await registerBarber(`${currency.toLowerCase()}@example.com`);
      const { agent, csrf } = await login(`${currency.toLowerCase()}@example.com`);
      const res = await createProfile(agent, csrf, { currency });
      expect(res.status).toBe(200);
      expect(res.body.profile.currency).toBe(currency);
    }
  });

  it("rejects an unknown currency", async () => {
    await registerBarber("unknown-currency@example.com");
    const { agent, csrf } = await login("unknown-currency@example.com");
    const res = await createProfile(agent, csrf, { currency: "GBP" });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("validates country codes against a known list", async () => {
    await registerBarber("country@example.com");
    const { agent, csrf } = await login("country@example.com");

    const invalid = await createProfile(agent, csrf, { countryCode: "XX" });
    expect(invalid.status).toBe(400);
    expect(invalid.body.error.code).toBe("VALIDATION_ERROR");

    const valid = await createProfile(agent, csrf, { countryCode: "fr" });
    expect(valid.status).toBe(200);
    expect(valid.body.profile.countryCode).toBe("FR");
  });

  it("keeps the postal code optional and preserves leading zeros", async () => {
    await registerBarber("postal@example.com");
    const { agent, csrf } = await login("postal@example.com");

    const withoutPostal = await createProfile(agent, csrf);
    expect(withoutPostal.status).toBe(200);
    expect(withoutPostal.body.profile.postalCode).toBe("1201");

    const withLeadingZero = await createProfile(agent, csrf, {
      postalCode: "01234",
    });
    expect(withLeadingZero.body.profile.postalCode).toBe("01234");

    const emptyPostal = await createProfile(agent, csrf, { postalCode: null });
    expect(emptyPostal.body.profile.postalCode).toBeNull();
  });

  it("rejects invalid coordinates", async () => {
    await registerBarber("coords@example.com");
    const { agent, csrf } = await login("coords@example.com");

    const badLat = await createProfile(agent, csrf, { latitude: 95 });
    expect(badLat.status).toBe(400);

    const badLng = await createProfile(agent, csrf, { longitude: 181 });
    expect(badLng.status).toBe(400);
  });

  it("handles the timezone field across create, update and clear", async () => {
    await registerBarber("tz@example.com");
    const { agent, csrf } = await login("tz@example.com");

    // Création avec fuseau.
    const created = await createProfile(agent, csrf, {
      timezone: "Europe/Zurich",
    });
    expect(created.status).toBe(200);
    expect(created.body.profile.timezone).toBe("Europe/Zurich");

    // GET le renvoie.
    const read = await agent.get("/api/barber/profile");
    expect(read.body.profile.timezone).toBe("Europe/Zurich");

    // PUT sans le champ → valeur conservée (aucun effacement).
    const kept = await createProfile(agent, csrf, { city: "Berne" });
    expect(kept.status).toBe(200);
    expect(kept.body.profile.timezone).toBe("Europe/Zurich");

    // Casse corrigée via la liste canonique.
    const recased = await createProfile(agent, csrf, {
      timezone: "europe/zurich",
    });
    expect(recased.status).toBe(200);
    expect(recased.body.profile.timezone).toBe("Europe/Zurich");

    // Effacement explicite par null.
    const cleared = await createProfile(agent, csrf, { timezone: null });
    expect(cleared.status).toBe(200);
    expect(cleared.body.profile.timezone).toBeNull();
    const readCleared = await agent.get("/api/barber/profile");
    expect(readCleared.body.profile.timezone).toBeNull();

    // Effacement explicite par chaîne vide.
    await createProfile(agent, csrf, { timezone: "Europe/Zurich" });
    const clearedEmpty = await createProfile(agent, csrf, { timezone: "" });
    expect(clearedEmpty.status).toBe(200);
    expect(clearedEmpty.body.profile.timezone).toBeNull();
  });

  it("rejects invalid timezone values without touching the profile", async () => {
    await registerBarber("tz-invalid@example.com");
    const { agent, csrf } = await login("tz-invalid@example.com");
    await createProfile(agent, csrf, { timezone: "Europe/Zurich" });

    const invalidValues = [
      "+01:00",
      "+23",
      "-2359",
      "CET",
      "Mars/Olympus",
      "Etc/GMT+1",
      `Europe/${"x".repeat(58)}`,
    ];
    for (const value of invalidValues) {
      const res = await createProfile(agent, csrf, {
        timezone: value,
        displayName: "Nouveau Nom",
      });
      expect(res.status, value).toBe(400);
      expect(res.body.error.code, value).toBe("VALIDATION_ERROR");
    }

    // Aucune écriture partielle : ni le fuseau ni le reste du payload.
    const read = await agent.get("/api/barber/profile");
    expect(read.body.profile.timezone).toBe("Europe/Zurich");
    expect(read.body.profile.displayName).toBe("Barbier Test");
  });

  it("accepts UTC and keeps a slash alias recognized by Intl as typed", async () => {
    await registerBarber("tz-alias@example.com");
    const { agent, csrf } = await login("tz-alias@example.com");

    const utc = await createProfile(agent, csrf, { timezone: "utc" });
    expect(utc.status).toBe(200);
    expect(utc.body.profile.timezone).toBe("UTC");

    // L'acceptation de « US/Eastern » dépend de l'ICU (alias du backward
    // tzdata, stable en pratique) : l'assertion n'épingle aucune version.
    // Si l'ICU le reconnaît, la valeur est conservée telle quelle, jamais
    // remplacée par resolvedOptions().timeZone.
    const aliasAccepted =
      classifyIanaTimeZone("US/Eastern").kind === "valid";
    const alias = await createProfile(agent, csrf, { timezone: "US/Eastern" });
    if (aliasAccepted) {
      expect(alias.status).toBe(200);
      expect(alias.body.profile.timezone).toBe("US/Eastern");
    } else {
      expect(alias.status).toBe(400);
    }
  });

  it("rejects unauthorized fields in the profile body", async () => {
    await registerBarber("strict-profile@example.com");
    const { agent, csrf } = await login("strict-profile@example.com");

    const res = await createProfile(agent, csrf, { userId: "someone-else" });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });
});

describe("barber services", () => {
  async function setupBarber(email: string) {
    await registerBarber(email);
    const { agent, csrf } = await login(email);
    await createProfile(agent, csrf);
    return { agent, csrf };
  }

  it("creates, edits, disables and reactivates a service", async () => {
    const { agent, csrf } = await setupBarber("services@example.com");

    const created = await agent
      .post("/api/barber/services")
      .set("X-CSRF-Token", csrf)
      .send(servicePayload());
    expect(created.status).toBe(201);
    expect(created.body.service.name).toBe("Coupe classique");
    expect(created.body.service.isActive).toBe(true);
    const serviceId = created.body.service.id as string;

    const edited = await agent
      .patch(`/api/barber/services/${serviceId}`)
      .set("X-CSRF-Token", csrf)
      .send({ name: "Coupe premium", durationMinutes: 45 });
    expect(edited.status).toBe(200);
    expect(edited.body.service.name).toBe("Coupe premium");
    expect(edited.body.service.durationMinutes).toBe(45);

    const disabled = await agent
      .patch(`/api/barber/services/${serviceId}`)
      .set("X-CSRF-Token", csrf)
      .send({ isActive: false });
    expect(disabled.status).toBe(200);
    expect(disabled.body.service.isActive).toBe(false);

    const reactivated = await agent
      .patch(`/api/barber/services/${serviceId}`)
      .set("X-CSRF-Token", csrf)
      .send({ isActive: true });
    expect(reactivated.body.service.isActive).toBe(true);
  });

  it("clears a service description with null", async () => {
    const { agent, csrf } = await setupBarber("description@example.com");
    const created = await agent
      .post("/api/barber/services")
      .set("X-CSRF-Token", csrf)
      .send(servicePayload({ description: "À garder" }));
    const serviceId = created.body.service.id as string;

    const cleared = await agent
      .patch(`/api/barber/services/${serviceId}`)
      .set("X-CSRF-Token", csrf)
      .send({ description: null });
    expect(cleared.status).toBe(200);
    expect(cleared.body.service.description).toBeNull();
  });

  it("refuses an empty PATCH", async () => {
    const { agent, csrf } = await setupBarber("empty-patch@example.com");
    const created = await agent
      .post("/api/barber/services")
      .set("X-CSRF-Token", csrf)
      .send(servicePayload());
    const serviceId = created.body.service.id as string;

    const res = await agent
      .patch(`/api/barber/services/${serviceId}`)
      .set("X-CSRF-Token", csrf)
      .send({});
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("rejects out-of-range durations and prices", async () => {
    const { agent, csrf } = await setupBarber("range@example.com");

    const zeroDuration = await agent
      .post("/api/barber/services")
      .set("X-CSRF-Token", csrf)
      .send(servicePayload({ durationMinutes: 0 }));
    expect(zeroDuration.status).toBe(400);

    const negativePrice = await agent
      .post("/api/barber/services")
      .set("X-CSRF-Token", csrf)
      .send(servicePayload({ priceMinor: -1 }));
    expect(negativePrice.status).toBe(400);

    const tooLong = await agent
      .post("/api/barber/services")
      .set("X-CSRF-Token", csrf)
      .send(servicePayload({ durationMinutes: 481 }));
    expect(tooLong.status).toBe(400);

    const tooExpensive = await agent
      .post("/api/barber/services")
      .set("X-CSRF-Token", csrf)
      .send(servicePayload({ priceMinor: 1_000_001 }));
    expect(tooExpensive.status).toBe(400);
  });

  it("rejects unauthorized fields in the service body", async () => {
    const { agent, csrf } = await setupBarber("strict-service@example.com");

    const create = await agent
      .post("/api/barber/services")
      .set("X-CSRF-Token", csrf)
      .send({ ...servicePayload(), barberProfileId: "evil" });
    expect(create.status).toBe(400);
    expect(create.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("isolates services between two barbers", async () => {
    const a = await setupBarber("barber-a@example.com");
    const created = await a.agent
      .post("/api/barber/services")
      .set("X-CSRF-Token", a.csrf)
      .send(servicePayload({ name: "Service de A" }));
    const serviceA = created.body.service.id as string;

    const b = await setupBarber("barber-b@example.com");

    const patch = await b.agent
      .patch(`/api/barber/services/${serviceA}`)
      .set("X-CSRF-Token", b.csrf)
      .send({ name: "Piraté" });
    expect(patch.status).toBe(404);
    expect(patch.body.error.code).toBe("SERVICE_NOT_FOUND");

    const listB = await b.agent.get("/api/barber/services");
    expect(listB.status).toBe(200);
    expect(listB.body.services).toHaveLength(0);
  });
});

describe("DB constraints on barber_services", () => {
  async function insertProfileDirectly(email: string) {
    const user = await registerBarber(email);
    const [profile] = await db
      .insert(barberProfiles)
      .values({
        id: randomUUID(),
        userId: user.id,
        displayName: "Barbier",
        description: "Description",
        address: "Rue 1",
        city: "Genève",
        postalCode: null,
        countryCode: "CH",
        latitude: 46.2,
        longitude: 6.14,
        currency: "CHF",
      })
      .returning();
    return profile;
  }

  function serviceRow(profileId: string, overrides: Record<string, unknown> = {}) {
    return {
      id: randomUUID(),
      barberProfileId: profileId,
      name: "Service",
      description: null,
      durationMinutes: 30,
      priceMinor: 1000,
      isActive: true,
      ...overrides,
    };
  }

  it("rejects durations outside 1..480 and accepts boundaries", async () => {
    const profile = await insertProfileDirectly("db-duration@example.com");
    await expect(
      db.insert(barberServices).values(
        serviceRow(profile.id, { durationMinutes: 0 }),
      ),
    ).rejects.toThrow();
    await expect(
      db.insert(barberServices).values(
        serviceRow(profile.id, { durationMinutes: 481 }),
      ),
    ).rejects.toThrow();
    await expect(
      db.insert(barberServices).values(
        serviceRow(profile.id, { durationMinutes: 1 }),
      ),
    ).resolves.toBeDefined();
    await expect(
      db.insert(barberServices).values(
        serviceRow(profile.id, { durationMinutes: 480 }),
      ),
    ).resolves.toBeDefined();
  });

  it("rejects prices outside 0..1000000 and accepts boundaries", async () => {
    const profile = await insertProfileDirectly("db-price@example.com");
    await expect(
      db.insert(barberServices).values(
        serviceRow(profile.id, { priceMinor: -1 }),
      ),
    ).rejects.toThrow();
    await expect(
      db.insert(barberServices).values(
        serviceRow(profile.id, { priceMinor: 1000001 }),
      ),
    ).rejects.toThrow();
    await expect(
      db.insert(barberServices).values(
        serviceRow(profile.id, { priceMinor: 0 }),
      ),
    ).resolves.toBeDefined();
    await expect(
      db.insert(barberServices).values(
        serviceRow(profile.id, { priceMinor: 1000000 }),
      ),
    ).resolves.toBeDefined();
  });
});

describe("access control", () => {
  it("returns 401 for private routes without authentication", async () => {
    expect((await request(app).get("/api/barber/profile")).status).toBe(401);
    expect((await request(app).put("/api/barber/profile")).status).toBe(401);
    expect((await request(app).get("/api/barber/services")).status).toBe(401);
    expect((await request(app).post("/api/barber/services")).status).toBe(401);
  });

  it("returns 403 for a CLIENT on barber routes", async () => {
    await request(app)
      .post("/api/auth/register")
      .send({ email: "client@example.com", password: PASSWORD, role: "CLIENT" });
    const { agent } = await login("client@example.com");

    const res = await agent.get("/api/barber/profile");
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("FORBIDDEN");
  });

  it("requires CSRF on mutations", async () => {
    await registerBarber("csrf-barber@example.com");
    const { agent, csrf } = await login("csrf-barber@example.com");

    const noCsrf = await agent.put("/api/barber/profile").send(profilePayload());
    expect(noCsrf.status).toBe(403);
    expect(noCsrf.body.error.code).toBe("CSRF_INVALID");

    const wrongCsrf = await agent
      .put("/api/barber/profile")
      .set("X-CSRF-Token", "wrong")
      .send(profilePayload());
    expect(wrongCsrf.status).toBe(403);
    expect(wrongCsrf.body.error.code).toBe("CSRF_INVALID");

    const created = await createProfile(agent, csrf);
    const serviceRes = await agent
      .post("/api/barber/services")
      .send(servicePayload());
    expect(serviceRes.status).toBe(403);
    expect(serviceRes.body.error.code).toBe("CSRF_INVALID");
    expect(created.status).toBe(200);
  });
});

describe("public profile", () => {
  async function setupPublicBarber(email: string) {
    const user = await registerBarber(email);
    const { agent, csrf } = await login(email);
    const profile = await createProfile(agent, csrf);
    await agent
      .post("/api/barber/services")
      .set("X-CSRF-Token", csrf)
      .send(servicePayload({ name: "Actif" }));
    await agent
      .post("/api/barber/services")
      .set("X-CSRF-Token", csrf)
      .send(servicePayload({ name: "Inactif" }));
    const inactiveId = (
      await agent.get("/api/barber/services")
    ).body.services.find((s: { name: string }) => s.name === "Inactif").id as string;
    await agent
      .patch(`/api/barber/services/${inactiveId}`)
      .set("X-CSRF-Token", csrf)
      .send({ isActive: false });

    return { user, profileId: profile.body.profile.id as string };
  }

  it("exposes only active services and a whitelist of fields", async () => {
    const { profileId } = await setupPublicBarber("public@example.com");

    const res = await request(app).get(`/api/barbers/${profileId}`);
    expect(res.status).toBe(200);
    expect(res.body.profile.displayName).toBe("Barbier Test");
    expect(res.body.profile).not.toHaveProperty("email");
    expect(res.body.profile).not.toHaveProperty("userId");
    expect(res.body.profile).not.toHaveProperty("passwordHash");
    expect(res.body.profile).not.toHaveProperty("updatedAt");

    expect(res.body.services).toHaveLength(1);
    expect(res.body.services[0].name).toBe("Actif");
    expect(res.body.services[0]).not.toHaveProperty("barberProfileId");
    expect(res.body.services[0]).not.toHaveProperty("isActive");
  });

  it("returns 404 for a suspended account", async () => {
    const { user, profileId } = await setupPublicBarber("suspended@example.com");
    await db.update(users).set({ status: "SUSPENDED" }).where(eq(users.id, user.id));

    const res = await request(app).get(`/api/barbers/${profileId}`);
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("BARBER_PROFILE_NOT_FOUND");
  });

  it("returns 404 when the owner loses the BARBER role", async () => {
    const { user, profileId } = await setupPublicBarber("role-loss@example.com");
    await db.update(users).set({ role: "CLIENT" }).where(eq(users.id, user.id));

    const res = await request(app).get(`/api/barbers/${profileId}`);
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("BARBER_PROFILE_NOT_FOUND");
  });
});
