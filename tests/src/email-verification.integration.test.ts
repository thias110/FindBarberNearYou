import { randomBytes } from "node:crypto";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { eq } from "drizzle-orm";
import { createApp } from "../../server/src/app";
import { db } from "../../server/src/db/client";
import { migrateDb } from "../../server/src/db/migrate";
import {
  emailVerificationTokens,
  users,
} from "@findbarber/shared/schema";
import {
  hashEmailToken,
  issueEmailVerificationToken,
} from "../../server/src/modules/auth/service";

const app = createApp();
const PASSWORD = "password123";

beforeAll(async () => {
  await migrateDb();
});

beforeEach(async () => {
  await db.delete(emailVerificationTokens);
  await db.delete(users);
});

async function registerUser(
  email: string,
  role: "CLIENT" | "BARBER" = "CLIENT",
): Promise<{ id: string; email: string }> {
  const res = await request(app)
    .post("/api/auth/register")
    .send({ email, password: PASSWORD, role });
  expect(res.status).toBe(201);
  return res.body.user as { id: string; email: string };
}

describe("register crée un compte non vérifié", () => {
  it("laisse email_verified_at NULL et émet un jeton haché", async () => {
    await registerUser("pending@example.com", "CLIENT");

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, "pending@example.com"))
      .limit(1);
    expect(user.emailVerifiedAt).toBeNull();

    const tokens = await db
      .select()
      .from(emailVerificationTokens)
      .where(eq(emailVerificationTokens.userId, user.id));
    expect(tokens.length).toBe(1);
    // Le jeton brut n'est jamais stocké : l'empreinte fait 64 hex chars (SHA-256).
    expect(tokens[0].tokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(tokens[0].consumedAt).toBeNull();
    expect(tokens[0].expiresAt.getTime()).toBeGreaterThan(Date.now());
  });
});

describe("login d'un compte non vérifié", () => {
  it("retourne 403 EMAIL_NOT_VERIFIED", async () => {
    await registerUser("blocked@example.com", "CLIENT");

    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "blocked@example.com", password: PASSWORD });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("EMAIL_NOT_VERIFIED");
  });
});

describe("POST /api/auth/verify-email", () => {
  it("vérifie un jeton valide sans créer de session", async () => {
    const user = await registerUser("valid@example.com", "CLIENT");
    const token = await issueEmailVerificationToken(user.id);

    const res = await request(app)
      .post("/api/auth/verify-email")
      .send({ token });

    expect(res.status).toBe(200);
    expect(res.body.verified).toBe(true);

    // Aucun cookie de session posé par la vérification.
    const cookies = (res.headers["set-cookie"] ?? []) as string[];
    expect(cookies.some((cookie) => cookie.startsWith("auth_token="))).toBe(
      false,
    );

    const [updated] = await db
      .select()
      .from(users)
      .where(eq(users.id, user.id))
      .limit(1);
    expect(updated.emailVerifiedAt).not.toBeNull();

    const [consumed] = await db
      .select()
      .from(emailVerificationTokens)
      .where(eq(emailVerificationTokens.tokenHash, hashEmailToken(token)))
      .limit(1);
    expect(consumed.consumedAt).not.toBeNull();

    // Le login fonctionne désormais.
    const login = await request(app)
      .post("/api/auth/login")
      .send({ email: "valid@example.com", password: PASSWORD });
    expect(login.status).toBe(200);
  });

  it("refuse un jeton expiré", async () => {
    const user = await registerUser("expired@example.com", "CLIENT");
    const token = await issueEmailVerificationToken(user.id);
    await db
      .update(emailVerificationTokens)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(eq(emailVerificationTokens.userId, user.id));

    const res = await request(app)
      .post("/api/auth/verify-email")
      .send({ token });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("INVALID_VERIFICATION_TOKEN");

    const [row] = await db
      .select()
      .from(users)
      .where(eq(users.id, user.id))
      .limit(1);
    expect(row.emailVerifiedAt).toBeNull();
  });

  it("refuse un jeton déjà utilisé", async () => {
    const user = await registerUser("used@example.com", "CLIENT");
    const token = await issueEmailVerificationToken(user.id);

    const first = await request(app)
      .post("/api/auth/verify-email")
      .send({ token });
    expect(first.status).toBe(200);

    const second = await request(app)
      .post("/api/auth/verify-email")
      .send({ token });
    expect(second.status).toBe(400);
    expect(second.body.error.code).toBe("INVALID_VERIFICATION_TOKEN");
  });

  it("refuse un jeton invalide", async () => {
    const res = await request(app)
      .post("/api/auth/verify-email")
      .send({ token: randomBytes(32).toString("hex") });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("INVALID_VERIFICATION_TOKEN");
  });
});

describe("POST /api/auth/resend-verification", () => {
  it("répond de façon générique pour un email inconnu", async () => {
    const res = await request(app)
      .post("/api/auth/resend-verification")
      .send({ email: "nobody@example.com" });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);

    const tokens = await db.select().from(emailVerificationTokens);
    expect(tokens.length).toBe(0);
  });

  it("émet un nouveau jeton après le cooldown", async () => {
    const user = await registerUser("resend@example.com", "CLIENT");
    // On vieillit le jeton émis à l'inscription pour sortir du cooldown.
    await db
      .update(emailVerificationTokens)
      .set({ createdAt: new Date(Date.now() - 120_000) })
      .where(eq(emailVerificationTokens.userId, user.id));

    const res = await request(app)
      .post("/api/auth/resend-verification")
      .send({ email: "resend@example.com" });

    expect(res.status).toBe(200);

    const tokens = await db
      .select()
      .from(emailVerificationTokens)
      .where(eq(emailVerificationTokens.userId, user.id));
    expect(tokens.length).toBe(2);
  });

  it("n'émet rien pendant le cooldown (silencieux, anti-énumération)", async () => {
    const user = await registerUser("cooldown@example.com", "CLIENT");

    const res = await request(app)
      .post("/api/auth/resend-verification")
      .send({ email: "cooldown@example.com" });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);

    const tokens = await db
      .select()
      .from(emailVerificationTokens)
      .where(eq(emailVerificationTokens.userId, user.id));
    // Toujours le seul jeton émis à l'inscription.
    expect(tokens.length).toBe(1);
  });

  it("ne révèle pas qu'un compte est déjà vérifié", async () => {
    const user = await registerUser("verified@example.com", "CLIENT");
    await db
      .update(users)
      .set({ emailVerifiedAt: new Date() })
      .where(eq(users.id, user.id));

    const res = await request(app)
      .post("/api/auth/resend-verification")
      .send({ email: "verified@example.com" });

    expect(res.status).toBe(200);

    const tokens = await db
      .select()
      .from(emailVerificationTokens)
      .where(eq(emailVerificationTokens.userId, user.id));
    // Aucun nouveau jeton : le compte est déjà vérifié.
    expect(tokens.length).toBe(1);
  });
});

describe("rate limit resend", () => {
  it("retourne 429 après dépassement du quota", async () => {
    const limitedApp = createApp({
      rateLimits: { resendVerification: { windowMs: 60_000, limit: 3 } },
    });

    for (let i = 0; i < 3; i += 1) {
      const res = await request(limitedApp)
        .post("/api/auth/resend-verification")
        .send({ email: `rl-${i}@example.com` });
      expect(res.status).toBe(200);
    }

    const blocked = await request(limitedApp)
      .post("/api/auth/resend-verification")
      .send({ email: "rl-blocked@example.com" });
    expect(blocked.status).toBe(429);
    expect(blocked.body.error.code).toBe("RATE_LIMITED");
  });
});
