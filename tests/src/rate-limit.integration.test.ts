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
});
