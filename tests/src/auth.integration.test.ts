import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { eq } from "drizzle-orm";
import { createApp } from "../../server/src/app";
import { db } from "../../server/src/db/client";
import { migrateDb } from "../../server/src/db/migrate";
import { users } from "@findbarber/shared/schema";

const app = createApp();

beforeAll(async () => {
  await migrateDb();
});

beforeEach(async () => {
  await db.delete(users);
});

const PASSWORD = "password123";

describe("POST /api/auth/register", () => {
  it("registers a CLIENT", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({ email: "client@example.com", password: PASSWORD, role: "CLIENT" });

    expect(res.status).toBe(201);
    expect(res.body.user.email).toBe("client@example.com");
    expect(res.body.user.role).toBe("CLIENT");
    expect(res.body.user).not.toHaveProperty("passwordHash");
  });

  it("registers a BARBER", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({ email: "barber@example.com", password: PASSWORD, role: "BARBER" });

    expect(res.status).toBe(201);
    expect(res.body.user.role).toBe("BARBER");
  });

  it("refuses ADMIN registration with 403", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({ email: "admin@example.com", password: PASSWORD, role: "ADMIN" });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("ADMIN_REGISTRATION_FORBIDDEN");
  });

  it("normalizes the email (trim + lowercase)", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({
        email: "  Client@Example.COM  ",
        password: PASSWORD,
        role: "CLIENT",
      });

    expect(res.status).toBe(201);
    expect(res.body.user.email).toBe("client@example.com");
  });

  it("rejects an already used email with 409", async () => {
    await request(app)
      .post("/api/auth/register")
      .send({ email: "dup@example.com", password: PASSWORD, role: "CLIENT" });

    const res = await request(app)
      .post("/api/auth/register")
      .send({ email: "dup@example.com", password: PASSWORD, role: "CLIENT" });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("EMAIL_TAKEN");
  });

  it("rejects an invalid (too short) password with 400", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({ email: "short@example.com", password: "123", role: "CLIENT" });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("rejects a password exceeding 72 bytes (Unicode)", async () => {
    const longUnicodePassword = "é".repeat(37); // 74 bytes UTF-8
    const res = await request(app)
      .post("/api/auth/register")
      .send({
        email: "unicode@example.com",
        password: longUnicodePassword,
        role: "CLIENT",
      });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });
});

describe("POST /api/auth/login", () => {
  beforeEach(async () => {
    await request(app)
      .post("/api/auth/register")
      .send({ email: "login@example.com", password: PASSWORD, role: "CLIENT" });
  });

  it("logs in successfully and sets HttpOnly + CSRF cookies", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: " Login@Example.com ", password: PASSWORD });

    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe("login@example.com");
    expect(res.body.csrfToken).toBeTruthy();

    const cookies = (res.headers["set-cookie"] ?? []) as string[];
    const authCookie = cookies.find((c) => c.startsWith("auth_token="));
    expect(authCookie).toBeDefined();
    expect(authCookie).toContain("HttpOnly");
    expect(authCookie).toContain("SameSite=Lax");
    expect(authCookie).toContain("Max-Age=604800");
    expect(cookies.some((c) => c.startsWith("csrf_token="))).toBe(true);

    const token = (authCookie as string).slice("auth_token=".length).split(";")[0];
    const payload = jwt.decode(token) as jwt.JwtPayload | null;
    expect(payload).not.toBeNull();
    expect(payload?.exp).toBeTypeOf("number");
    expect(payload?.iat).toBeTypeOf("number");
    expect(Math.abs((payload?.exp ?? 0) - (payload?.iat ?? 0) - 604800)).toBeLessThanOrEqual(5);
  });

  it("rotates the CSRF token on each login", async () => {
    const first = await request(app)
      .post("/api/auth/login")
      .send({ email: "login@example.com", password: PASSWORD });
    const second = await request(app)
      .post("/api/auth/login")
      .send({ email: "login@example.com", password: PASSWORD });

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(first.body.csrfToken).toBeTruthy();
    expect(second.body.csrfToken).toBeTruthy();
    expect(first.body.csrfToken).not.toBe(second.body.csrfToken);
  });

  it("rejects an unknown email with 401", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "nobody@example.com", password: PASSWORD });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("INVALID_CREDENTIALS");
  });

  it("rejects a wrong password with 401", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "login@example.com", password: "wrong-password" });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("INVALID_CREDENTIALS");
  });

  it("rejects a suspended account with 403", async () => {
    await db
      .update(users)
      .set({ status: "SUSPENDED" })
      .where(eq(users.email, "login@example.com"));

    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "login@example.com", password: PASSWORD });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("ACCOUNT_SUSPENDED");
  });
});

describe("GET /api/auth/me", () => {
  it("returns 401 when not authenticated", async () => {
    const res = await request(app).get("/api/auth/me");

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHORIZED");
  });

  it("returns the current user when authenticated", async () => {
    await request(app)
      .post("/api/auth/register")
      .send({ email: "me@example.com", password: PASSWORD, role: "CLIENT" });

    const agent = request.agent(app);
    await agent
      .post("/api/auth/login")
      .send({ email: "me@example.com", password: PASSWORD });

    const res = await agent.get("/api/auth/me");

    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe("me@example.com");
  });

  it("returns 403 when the account is suspended", async () => {
    await request(app)
      .post("/api/auth/register")
      .send({ email: "suspend@example.com", password: PASSWORD, role: "CLIENT" });

    const agent = request.agent(app);
    await agent
      .post("/api/auth/login")
      .send({ email: "suspend@example.com", password: PASSWORD });

    await db
      .update(users)
      .set({ status: "SUSPENDED" })
      .where(eq(users.email, "suspend@example.com"));

    const res = await agent.get("/api/auth/me");

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("ACCOUNT_SUSPENDED");
  });
});

describe("POST /api/auth/logout", () => {
  it("logs out and invalidates the session", async () => {
    await request(app)
      .post("/api/auth/register")
      .send({ email: "out@example.com", password: PASSWORD, role: "CLIENT" });

    const agent = request.agent(app);
    const loginRes = await agent
      .post("/api/auth/login")
      .send({ email: "out@example.com", password: PASSWORD });
    const csrf = loginRes.body.csrfToken as string;

    const res = await agent.post("/api/auth/logout").set("X-CSRF-Token", csrf);
    expect(res.status).toBe(204);

    const setCookies = (res.headers["set-cookie"] ?? []) as string[];
    expect(setCookies.find((c) => c.startsWith("auth_token=;"))).toBeDefined();
    expect(setCookies.find((c) => c.startsWith("csrf_token=;"))).toBeDefined();

    const me = await agent.get("/api/auth/me");
    expect(me.status).toBe(401);
  });

  it("refuses logout without a CSRF token (403)", async () => {
    await request(app)
      .post("/api/auth/register")
      .send({ email: "csrf@example.com", password: PASSWORD, role: "CLIENT" });

    const agent = request.agent(app);
    await agent
      .post("/api/auth/login")
      .send({ email: "csrf@example.com", password: PASSWORD });

    const res = await agent.post("/api/auth/logout");

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("CSRF_INVALID");
  });

  it("refuses logout with an incorrect CSRF token (403)", async () => {
    await request(app)
      .post("/api/auth/register")
      .send({ email: "csrf2@example.com", password: PASSWORD, role: "CLIENT" });

    const agent = request.agent(app);
    await agent
      .post("/api/auth/login")
      .send({ email: "csrf2@example.com", password: PASSWORD });

    const res = await agent.post("/api/auth/logout").set("X-CSRF-Token", "wrong-token");

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("CSRF_INVALID");
  });
});

describe("role-based access control", () => {
  it("returns 401 for a protected route without authentication", async () => {
    const res = await request(app).get("/api/admin/status");

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHORIZED");
  });

  it("returns 403 when an authenticated user lacks the required role", async () => {
    await request(app)
      .post("/api/auth/register")
      .send({ email: "client-role@example.com", password: PASSWORD, role: "CLIENT" });

    const agent = request.agent(app);
    await agent
      .post("/api/auth/login")
      .send({ email: "client-role@example.com", password: PASSWORD });

    const res = await agent.get("/api/admin/status");

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("FORBIDDEN");
  });

  it("allows an ADMIN to access an admin-only route", async () => {
    const passwordHash = await bcrypt.hash(PASSWORD, 12);
    await db.insert(users).values({
      id: "admin-id",
      email: "boss@example.com",
      passwordHash,
      role: "ADMIN",
      status: "ACTIVE",
    });

    const agent = request.agent(app);
    await agent
      .post("/api/auth/login")
      .send({ email: "boss@example.com", password: PASSWORD });

    const res = await agent.get("/api/admin/status");

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  it("uses the current DB role (role changes take effect immediately)", async () => {
    await request(app)
      .post("/api/auth/register")
      .send({ email: "role-change@example.com", password: PASSWORD, role: "CLIENT" });

    const agent = request.agent(app);
    await agent
      .post("/api/auth/login")
      .send({ email: "role-change@example.com", password: PASSWORD });

    await db
      .update(users)
      .set({ role: "ADMIN" })
      .where(eq(users.email, "role-change@example.com"));

    const res = await agent.get("/api/admin/status");

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });
});

describe("auth rate limiting", () => {
  it("returns 429 after exceeding the limit on /api/auth/register", async () => {
    const limitedApp = createApp({ authRateLimit: { windowMs: 60_000, limit: 3 } });

    for (let i = 0; i < 3; i += 1) {
      const res = await request(limitedApp)
        .post("/api/auth/register")
        .send({ email: `rl-${i}@example.com`, password: PASSWORD, role: "CLIENT" });
      expect(res.status).toBe(201);
    }

    const blocked = await request(limitedApp)
      .post("/api/auth/register")
      .send({ email: "rl-3@example.com", password: PASSWORD, role: "CLIENT" });

    expect(blocked.status).toBe(429);
    expect(blocked.body.error.code).toBe("RATE_LIMITED");
  });
});
