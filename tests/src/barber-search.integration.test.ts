import { randomUUID } from "node:crypto";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
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
  bookings,
  reviews,
  users,
} from "@findbarber/shared/schema";
import type { BookingStatus } from "@findbarber/shared/constants";
import { TEST_AVATAR_PATH, giveAvatar, markEmailVerified } from "./auth-helpers";
import { approveProfile } from "./approval-helpers";

const app = createApp();
const PASSWORD = "password123";

beforeAll(async () => {
  await migrateDb();
});

beforeEach(async () => {
  // Ordre des FK : avis -> réservations -> tags -> services -> profils -> users.
  await db.delete(reviews);
  await db.delete(bookings);
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
    places: ["SALON"],
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
  await markEmailVerified(email);
  await giveAvatar(email);
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
  if (res.status === 200) await approveProfile(res.body.profile.id as string);
  return res;
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
    expect(item).not.toHaveProperty("postalCode");
    expect(item).not.toHaveProperty("createdAt");
    // Champs publics ajoutés par l'issue #48 (liste blanche complète).
    expect(Object.keys(item).sort()).toEqual(
      [
        "activeServiceCount",
        "audiences",
        "averageRating",
        "certified",
        "avatarPath",
        "city",
        "countryCode",
        "currency",
        "displayName",
        "id",
        "latitude",
        "longitude",
        "places",
        "reviewCount",
        "startingPriceMinor",
        "techniques",
      ].sort(),
    );
    // Photo de profil obligatoire à la création (issue #44) : avatar de test.
    expect(item.avatarPath).toBe(`/uploads/${TEST_AVATAR_PATH}`);
    expect(item.averageRating).toBeNull();
    expect(item.reviewCount).toBe(0);
    expect(item.startingPriceMinor).toBeNull();
    expect(item.currency).toBe("CHF");
    // Coordonnées publiques approximatives (lot 8) : arrondies à deux décimales.
    expect(item.latitude).toBe(46.2);
    expect(item.longitude).toBe(6.14);
    expect(item.places).toEqual(["SALON"]);
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

  it("exposes approximate public coordinates with filters and across pages", async () => {
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
    expect(byName.Alpha).toEqual({ latitude: 46.2, longitude: 6.14 });
    expect(byName.Beta).toEqual({ latitude: 46.52, longitude: 6.63 });

    // Filtre ville : la position renvoyée reste celle du profil correspondant.
    const filtered = await request(app).get("/api/barbers").query({ city: "Lausanne" });
    expect(filtered.body.barbers).toHaveLength(1);
    expect(filtered.body.barbers[0].latitude).toBe(46.52);
    expect(filtered.body.barbers[0].longitude).toBe(6.63);

    // Pagination : chaque page porte les coordonnées de ses propres profils.
    const page1 = await request(app).get("/api/barbers").query({ page: 1, pageSize: 1 });
    expect(page1.body.barbers[0].displayName).toBe("Alpha");
    expect(page1.body.barbers[0].latitude).toBe(46.2);
    expect(page1.body.pagination).toMatchObject({ page: 1, total: 2, totalPages: 2 });

    const page2 = await request(app).get("/api/barbers").query({ page: 2, pageSize: 1 });
    expect(page2.body.barbers[0].displayName).toBe("Beta");
    expect(page2.body.barbers[0].longitude).toBe(6.63);
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

// --- Agrégats publics de la recherche (issue #48) ---

async function createClientUser(email: string): Promise<string> {
  const res = await request(app)
    .post("/api/auth/register")
    .send({ email, password: PASSWORD, role: "CLIENT" });
  expect(res.status).toBe(201);
  return res.body.user.id as string;
}

// Réservation insérée directement (statut arbitraire) + avis éventuel.
async function insertBookingWithReview(input: {
  clientUserId: string;
  barberProfileId: string;
  serviceId: string;
  status: BookingStatus;
  rating?: number;
  hidden?: boolean;
  dayOffset: number;
}) {
  const startAt = new Date(Date.UTC(2025, 0, 1 + input.dayOffset, 10));
  const [booking] = await db
    .insert(bookings)
    .values({
      id: randomUUID(),
      clientUserId: input.clientUserId,
      barberProfileId: input.barberProfileId,
      serviceId: input.serviceId,
      startAt,
      endAt: new Date(startAt.getTime() + 30 * 60_000),
      servicePlace: "SALON",
      status: input.status,
      barberDisplayName: "Barbier",
      serviceName: "Coupe classique",
      serviceDescription: null,
      durationMinutes: 30,
      priceMinor: 2500,
      currency: "CHF",
    })
    .returning({ id: bookings.id });
  if (input.rating !== undefined) {
    await db.insert(reviews).values({
      id: randomUUID(),
      bookingId: booking.id,
      rating: input.rating,
      comment: null,
      hiddenAt: input.hidden ? new Date() : null,
    });
  }
}

describe("GET /api/barbers — photo, note, prix et devise (issue #48)", () => {
  it("exposes avatar, currency and the starting price of ACTIVE services only", async () => {
    const x = await setupBarber("price@example.com", {
      displayName: "Price Barber",
      // Devise déduite du pays (issue #39) : un profil en France est en EUR.
      countryCode: "FR",
      currency: undefined,
    });
    await addService(x.agent, x.csrf, { name: "Coupe", priceMinor: 3000 });
    const cheap = await addService(x.agent, x.csrf, { name: "Barbe", priceMinor: 1000 });
    await addService(x.agent, x.csrf, { name: "Dégradé", priceMinor: 2000 });
    // Le service le moins cher est désactivé : il ne compte plus.
    await x.agent
      .patch(`/api/barber/services/${cheap.id}`)
      .set("X-CSRF-Token", x.csrf)
      .send({ isActive: false });
    const [owner] = await db.select().from(users).where(eq(users.email, "price@example.com"));
    await db
      .update(users)
      .set({ avatarPath: "avatars/abc.webp" })
      .where(eq(users.id, owner.id));

    const res = await request(app).get("/api/barbers");
    expect(res.status).toBe(200);
    const item = res.body.barbers[0];
    expect(item.startingPriceMinor).toBe(2000);
    expect(item.currency).toBe("EUR");
    expect(item.avatarPath).toBe("/uploads/avatars/abc.webp");
  });

  it("averages only visible reviews of COMPLETED bookings", async () => {
    const x = await setupBarber("rated@example.com", { displayName: "Rated Barber" });
    const svc = await addService(x.agent, x.csrf);
    const clientId = await createClientUser("client-rating@example.com");
    const base = { clientUserId: clientId, barberProfileId: x.profileId, serviceId: svc.id };

    await insertBookingWithReview({ ...base, status: "COMPLETED", rating: 5, dayOffset: 0 });
    await insertBookingWithReview({ ...base, status: "COMPLETED", rating: 4, dayOffset: 1 });
    await insertBookingWithReview({ ...base, status: "COMPLETED", rating: 4, dayOffset: 2 });
    // Masqué par l'admin : exclu.
    await insertBookingWithReview({
      ...base,
      status: "COMPLETED",
      rating: 1,
      hidden: true,
      dayOffset: 3,
    });
    // Réservation non terminée (incohérence de données) : exclue.
    await insertBookingWithReview({ ...base, status: "CANCELLED", rating: 1, dayOffset: 4 });
    // Réservation terminée sans avis : sans effet.
    await insertBookingWithReview({ ...base, status: "COMPLETED", dayOffset: 5 });

    const other = await setupBarber("unrated@example.com", { displayName: "Zeta Unrated" });
    expect(other.profileId).toBeTruthy();

    const res = await request(app).get("/api/barbers");
    const byName = Object.fromEntries(
      res.body.barbers.map((b: { displayName: string }) => [b.displayName, b]),
    );
    expect(byName["Rated Barber"].reviewCount).toBe(3);
    expect(byName["Rated Barber"].averageRating).toBe(4.33);
    expect(byName["Zeta Unrated"].reviewCount).toBe(0);
    expect(byName["Zeta Unrated"].averageRating).toBeNull();
  });

  it("runs a constant number of SQL queries whatever the number of results", async () => {
    async function countSelects(): Promise<number> {
      const spy = vi.spyOn(db, "select");
      try {
        const res = await request(app).get("/api/barbers").query({ pageSize: 50 });
        expect(res.status).toBe(200);
        return spy.mock.calls.length;
      } finally {
        spy.mockRestore();
      }
    }

    const first = await setupBarber("n1@example.com", { displayName: "N1" });
    await addService(first.agent, first.csrf);
    const withOne = await countSelects();

    for (let i = 2; i <= 6; i += 1) {
      const b = await setupBarber(`n${i}@example.com`, { displayName: `N${i}` });
      await addService(b.agent, b.csrf);
    }
    const withSix = await countSelects();

    expect(withSix).toBe(withOne);
  });
});

// --- Filtres prix, note et zone (issues #52 et #50) ---

describe("GET /api/barbers — filtres prix, note et zone (issues #50 et #52)", () => {
  function names(res: request.Response): string[] {
    return res.body.barbers.map((b: { displayName: string }) => b.displayName);
  }

  it("filters by max price in a given currency, on ACTIVE services only", async () => {
    const cheap = await setupBarber("cheap@example.com", { displayName: "Alpha Cheap" });
    await addService(cheap.agent, cheap.csrf, { priceMinor: 2000 });
    await addService(cheap.agent, cheap.csrf, { name: "Cher", priceMinor: 9000 });

    const pricey = await setupBarber("pricey@example.com", { displayName: "Beta Pricey" });
    await addService(pricey.agent, pricey.csrf, { priceMinor: 6000 });
    // Service bon marché mais désactivé : ne compte pas.
    const off = await addService(pricey.agent, pricey.csrf, { name: "Off", priceMinor: 500 });
    await pricey.agent
      .patch(`/api/barber/services/${off.id}`)
      .set("X-CSRF-Token", pricey.csrf)
      .send({ isActive: false });

    // Devise déduite du pays (issue #39) : un profil français est en EUR.
    const euro = await setupBarber("euro@example.com", {
      displayName: "Gamma Euro",
      countryCode: "FR",
      city: "Annemasse",
      postalCode: "74100",
      currency: "EUR",
    });
    await addService(euro.agent, euro.csrf, { priceMinor: 1000 });

    const chf30 = await request(app).get("/api/barbers").query({ maxPrice: 30, currency: "CHF" });
    expect(chf30.status).toBe(200);
    expect(names(chf30)).toEqual(["Alpha Cheap"]);

    const chf60 = await request(app).get("/api/barbers").query({ maxPrice: 60, currency: "chf" });
    expect(names(chf60)).toEqual(["Alpha Cheap", "Beta Pricey"]);

    const eur = await request(app).get("/api/barbers").query({ maxPrice: 30, currency: "EUR" });
    expect(names(eur)).toEqual(["Gamma Euro"]);
  });

  it("filters by minimum rating using visible reviews of completed bookings", async () => {
    const good = await setupBarber("good@example.com", { displayName: "Alpha Good" });
    const goodSvc = await addService(good.agent, good.csrf);
    const avg = await setupBarber("avg@example.com", { displayName: "Beta Average" });
    const avgSvc = await addService(avg.agent, avg.csrf);
    await setupBarber("none@example.com", { displayName: "Gamma None" });
    const clientId = await createClientUser("client-filter@example.com");

    await insertBookingWithReview({
      clientUserId: clientId,
      barberProfileId: good.profileId,
      serviceId: goodSvc.id,
      status: "COMPLETED",
      rating: 5,
      dayOffset: 0,
    });
    // Note basse masquée : ne fait pas baisser la moyenne.
    await insertBookingWithReview({
      clientUserId: clientId,
      barberProfileId: good.profileId,
      serviceId: goodSvc.id,
      status: "COMPLETED",
      rating: 1,
      hidden: true,
      dayOffset: 1,
    });
    await insertBookingWithReview({
      clientUserId: clientId,
      barberProfileId: avg.profileId,
      serviceId: avgSvc.id,
      status: "COMPLETED",
      rating: 3,
      dayOffset: 2,
    });

    const min4 = await request(app).get("/api/barbers").query({ minRating: 4 });
    expect(min4.status).toBe(200);
    expect(names(min4)).toEqual(["Alpha Good"]);
    const min3 = await request(app).get("/api/barbers").query({ minRating: 3 });
    expect(names(min3)).toEqual(["Alpha Good", "Beta Average"]);
  });

  it("limits results to a zone, across countries, using approximate coordinates", async () => {
    await setupBarber("geneve@example.com", {
      displayName: "Alpha Genève",
      latitude: 46.2044,
      longitude: 6.1432,
    });
    // Annemasse (France), à côté de Genève : même zone, autre pays.
    await setupBarber("annemasse@example.com", {
      displayName: "Beta Annemasse",
      countryCode: "FR",
      city: "Annemasse",
      postalCode: "74100",
      currency: "EUR",
      latitude: 46.1934,
      longitude: 6.2342,
    });
    await setupBarber("zurich@example.com", {
      displayName: "Gamma Zurich",
      city: "Zurich",
      latitude: 47.3769,
      longitude: 8.5417,
    });

    const zone = await request(app)
      .get("/api/barbers")
      .query({ minLat: 46.1, maxLat: 46.3, minLng: 6.0, maxLng: 6.3 });
    expect(zone.status).toBe(200);
    expect(names(zone)).toEqual(["Alpha Genève", "Beta Annemasse"]);
    expect(zone.body.pagination.total).toBe(2);

    // La borne exacte de la position approximative (46.20, 6.14) correspond,
    // une zone au millième autour du point exact (46.2044) ne le révèle pas.
    const approx = await request(app)
      .get("/api/barbers")
      .query({ minLat: 46.2, maxLat: 46.2, minLng: 6.14, maxLng: 6.14 });
    expect(names(approx)).toEqual(["Alpha Genève"]);
    const exact = await request(app)
      .get("/api/barbers")
      .query({ minLat: 46.204, maxLat: 46.205, minLng: 6.143, maxLng: 6.144 });
    expect(names(exact)).toEqual([]);
  });

  it("rejects invalid filter values with a 400", async () => {
    const bad: Record<string, string | number>[] = [
      { maxPrice: 30 },
      { maxPrice: 0, currency: "CHF" },
      { maxPrice: "abc", currency: "CHF" },
      { maxPrice: 10.5, currency: "CHF" },
      { currency: "GBP" },
      { minRating: 0 },
      { minRating: 6 },
      { minRating: 3.5 },
      { minLat: 46 },
      { minLat: 47, maxLat: 46, minLng: 6, maxLng: 7 },
      { minLat: 46, maxLat: 47, minLng: 7, maxLng: 6 },
      { minLat: -91, maxLat: 47, minLng: 6, maxLng: 7 },
      { minLat: 46, maxLat: 47, minLng: 6, maxLng: 181 },
      { minLat: "nord", maxLat: 47, minLng: 6, maxLng: 7 },
    ];
    for (const query of bad) {
      const res = await request(app).get("/api/barbers").query(query);
      expect(res.status, JSON.stringify(query)).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    }
  });
});
