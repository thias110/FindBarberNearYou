import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../../server/src/app";
import { db } from "../../server/src/db/client";
import { migrateDb } from "../../server/src/db/migrate";
import { users } from "@findbarber/shared/schema";

const PASSWORD = "password123";

beforeAll(async () => {
  await migrateDb();
});

beforeEach(async () => {
  await db.delete(users);
});

describe("login rate limiting", () => {
  it("retourne 429 après dépassement du quota login", async () => {
    const app = createApp({
      rateLimits: { login: { windowMs: 60_000, limit: 3 } },
    });

    for (let i = 0; i < 3; i += 1) {
      const res = await request(app)
        .post("/api/auth/login")
        .send({ email: `login-rl-${i}@example.com`, password: PASSWORD });
      // Mauvais identifiants = 401, mais la tentative est bien comptée.
      expect(res.status).toBe(401);
    }

    const blocked = await request(app)
      .post("/api/auth/login")
      .send({ email: "login-rl-3@example.com", password: PASSWORD });
    expect(blocked.status).toBe(429);
    expect(blocked.body.error.code).toBe("RATE_LIMITED");
  });
});

describe("indépendance des buckets login / register", () => {
  it("ne partage pas le quota login avec l'inscription", async () => {
    const app = createApp({
      rateLimits: {
        login: { windowMs: 60_000, limit: 2 },
        register: { windowMs: 60_000, limit: 2 },
      },
    });

    for (let i = 0; i < 2; i += 1) {
      const res = await request(app)
        .post("/api/auth/login")
        .send({ email: `ind-login-${i}@example.com`, password: PASSWORD });
      expect(res.status).toBe(401);
    }

    const blockedLogin = await request(app)
      .post("/api/auth/login")
      .send({ email: "ind-login-x@example.com", password: PASSWORD });
    expect(blockedLogin.status).toBe(429);

    // L'inscription a son propre bucket : elle n'est pas bloquée.
    const register = await request(app)
      .post("/api/auth/register")
      .send({
        email: "ind-register@example.com",
        password: PASSWORD,
        role: "CLIENT",
      });
    expect(register.status).toBe(201);
  });
});

describe("mutation rate limiting", () => {
  it("limite uniquement les méthodes mutantes", async () => {
    const app = createApp({
      rateLimits: { mutation: { windowMs: 60_000, limit: 3 } },
    });

    for (let i = 0; i < 3; i += 1) {
      const res = await request(app).post("/api/bookings").send({});
      // Non authentifié → 401, mais la mutation est comptée.
      expect(res.status).toBe(401);
    }

    // Les GET sous le même préfixe ne sont ni comptés ni bloqués.
    const get = await request(app).get("/api/bookings");
    expect(get.status).toBe(401);

    const blocked = await request(app).post("/api/bookings").send({});
    expect(blocked.status).toBe(429);
    expect(blocked.body.error.code).toBe("RATE_LIMITED");
  });

  it("compte les mutations de notifications dans le même bucket", async () => {
    const app = createApp({
      rateLimits: { mutation: { windowMs: 60_000, limit: 2 } },
    });

    for (let i = 0; i < 2; i += 1) {
      const res = await request(app).post("/api/notifications/read-all");
      expect(res.status).toBe(401);
    }

    const blocked = await request(app).post("/api/notifications/read-all");
    expect(blocked.status).toBe(429);
    expect(blocked.body.error.code).toBe("RATE_LIMITED");
  });
});

// Audit de sécurité (lot 2) : limites qui ne dépendent pas de l'IP.
describe("login : limite par compte, quelle que soit l'IP", () => {
  it("bloque un même email après N échecs, sans toucher les autres comptes", async () => {
    const app = createApp({ rateLimits: { loginAccount: { windowMs: 60_000, limit: 2 } } });
    for (let i = 0; i < 2; i += 1) {
      const res = await request(app)
        .post("/api/auth/login")
        // La casse et les espaces ne contournent pas la limite.
        .send({ email: i === 0 ? "cible@example.com" : " CIBLE@example.com ", password: "faux" });
      expect(res.status).toBe(401);
    }
    const blocked = await request(app)
      .post("/api/auth/login")
      .send({ email: "cible@example.com", password: PASSWORD });
    expect(blocked.status).toBe(429);

    const other = await request(app)
      .post("/api/auth/login")
      .send({ email: "autre@example.com", password: PASSWORD });
    expect(other.status).toBe(401);
  });
});

describe("réservation express : limite par barber", () => {
  it("bloque les demandes express vers un même barber au-delà du quota", async () => {
    const app = createApp({ rateLimits: { expressBarber: { windowMs: 60_000, limit: 2 } } });
    const body = (barberId: string) => ({
      barberId,
      serviceId: "00000000-0000-0000-0000-000000000000",
      date: "2030-01-10",
      startMinute: 600,
      place: "SALON",
      email: "robot@example.com",
      name: "Robot",
      website: "piege",
    });
    for (let i = 0; i < 2; i += 1) {
      const res = await request(app).post("/api/bookings/express").send(body("11111111-1111-4111-8111-111111111111"));
      expect(res.status).toBe(201);
    }
    expect((await request(app).post("/api/bookings/express").send(body("11111111-1111-4111-8111-111111111111"))).status).toBe(429);
    expect((await request(app).post("/api/bookings/express").send(body("22222222-2222-4222-8222-222222222222"))).status).toBe(201);
  });
});

describe("routes publiques des barbers : limite de lecture", () => {
  it("retourne 429 au-delà du quota de lecture", async () => {
    const app = createApp({ rateLimits: { publicRead: { windowMs: 60_000, limit: 2 } } });
    for (let i = 0; i < 2; i += 1) {
      expect((await request(app).get("/api/barbers/inconnu")).status).not.toBe(429);
    }
    expect((await request(app).get("/api/barbers/inconnu")).status).toBe(429);
  });
});
