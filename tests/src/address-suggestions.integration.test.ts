// Autocomplétion d'adresse du profil barber (issue #45) : BARBER uniquement,
// saisie validée, géocodage côté serveur (faux géocodeur injecté en test).
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { createApp } from "../../server/src/app";
import { db } from "../../server/src/db/client";
import { migrateDb } from "../../server/src/db/migrate";
import { barberProfiles, users } from "@findbarber/shared/schema";
import { setGeocoder } from "../../server/src/lib/geocoding";
import { markEmailVerified } from "./auth-helpers";

const PASSWORD = "password123";

beforeAll(async () => {
  await migrateDb();
});

beforeEach(async () => {
  await db.delete(barberProfiles);
  await db.delete(users);
});

afterEach(() => {
  setGeocoder(null);
});

async function login(app: ReturnType<typeof createApp>, email: string, role: "BARBER" | "CLIENT") {
  const res = await request(app)
    .post("/api/auth/register")
    .send({ email, password: PASSWORD, role });
  expect(res.status).toBe(201);
  await markEmailVerified(email);
  const agent = request.agent(app);
  expect((await agent.post("/api/auth/login").send({ email, password: PASSWORD })).status).toBe(200);
  return agent;
}

function fakeGeocoder() {
  const suggest = vi.fn().mockResolvedValue([
    { label: "Rue du Rhône 1, 1204 Genève", latitude: 46.2034, longitude: 6.1466 },
  ]);
  setGeocoder({
    geocode: vi.fn(),
    suggest,
  });
  return suggest;
}

describe("GET /api/barber/address-suggestions (issue #45)", () => {
  it("returns suggestions for a barber, restricted to the requested country", async () => {
    const app = createApp();
    const suggest = fakeGeocoder();
    const agent = await login(app, "pro@example.com", "BARBER");
    const res = await agent
      .get("/api/barber/address-suggestions")
      .query({ q: "  Rue du Rhône 1 ", countryCode: "ch" });
    expect(res.status).toBe(200);
    expect(res.body.suggestions).toEqual([
      { label: "Rue du Rhône 1, 1204 Genève", latitude: 46.2034, longitude: 6.1466 },
    ]);
    expect(suggest).toHaveBeenCalledWith("Rue du Rhône 1", { countryCode: "CH", limit: 5 });
  });

  it("validates the query (too short, unknown country, extra params)", async () => {
    const app = createApp();
    const suggest = fakeGeocoder();
    const agent = await login(app, "pro@example.com", "BARBER");
    for (const query of [{ q: "ab" }, { q: "Genève", countryCode: "XX" }, { q: "Genève", foo: "1" }]) {
      const res = await agent.get("/api/barber/address-suggestions").query(query);
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    }
    expect(suggest).not.toHaveBeenCalled();
  });

  it("is reserved to authenticated barbers", async () => {
    const app = createApp();
    fakeGeocoder();
    expect(
      (await request(app).get("/api/barber/address-suggestions").query({ q: "Genève" })).status,
    ).toBe(401);
    const client = await login(app, "client@example.com", "CLIENT");
    expect(
      (await client.get("/api/barber/address-suggestions").query({ q: "Genève" })).status,
    ).toBe(403);
  });

  it("answers 503 when geocoding is unavailable", async () => {
    const app = createApp();
    setGeocoder({ geocode: vi.fn() });
    const agent = await login(app, "pro@example.com", "BARBER");
    const res = await agent.get("/api/barber/address-suggestions").query({ q: "Genève" });
    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe("GEOCODING_UNAVAILABLE");
  });

  it("is rate limited", async () => {
    const app = createApp({ rateLimits: { geocode: { windowMs: 60_000, limit: 2 } } });
    fakeGeocoder();
    const agent = await login(app, "pro@example.com", "BARBER");
    const statuses: number[] = [];
    for (let i = 0; i < 3; i++) {
      statuses.push(
        (await agent.get("/api/barber/address-suggestions").query({ q: "Genève" })).status,
      );
    }
    expect(statuses).toEqual([200, 200, 429]);
  });
});
