// Mot de passe oublié (issue #9) et emails à jeton : réponse neutre, jeton
// haché à usage unique et expirant, révocation des sessions existantes ; un
// échec d'envoi ne casse ni l'inscription ni la demande.
import { randomUUID } from "node:crypto";
import request from "supertest";
import { eq } from "drizzle-orm";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../server/src/app";
import { db } from "../../server/src/db/client";
import { migrateDb } from "../../server/src/db/migrate";
import { hashEmailToken } from "../../server/src/modules/auth/service";
import {
  clearSentEmails,
  sentEmails,
  simulateMailFailures,
} from "../../server/src/lib/mailer";
import { passwordResetTokens, users } from "@findbarber/shared/schema";
import {
  createUser,
  PASSWORD,
  resetBookingTables,
} from "./booking-api-helpers";

const app = createApp();
const EMAIL = "reset-user@example.com";
const NEW_PASSWORD = "NouveauMotDePasse42!";

beforeAll(async () => {
  await migrateDb();
});

beforeEach(async () => {
  await resetBookingTables();
  clearSentEmails();
});

function tokenFrom(text: string, path: string): string {
  const match = text.match(new RegExp(`${path}\\?token=([a-f0-9]{64})`));
  expect(match, "lien à jeton absent de l'email").not.toBeNull();
  return match![1];
}

async function requestReset(email: string) {
  return request(app).post("/api/auth/forgot-password").send({ email });
}

describe("mot de passe oublié", () => {
  it("répond 202 à l'identique, que le compte existe ou non", async () => {
    await createUser(EMAIL, "CLIENT");
    const known = await requestReset(EMAIL);
    const unknown = await requestReset("nobody@example.com");
    expect(known.status).toBe(202);
    expect(unknown.status).toBe(202);
    expect(unknown.body).toEqual(known.body);
    expect(sentEmails().map((m) => m.to)).toEqual([EMAIL]);
  });

  it("ne stocke que l'empreinte du jeton et respecte le délai de renvoi", async () => {
    const userId = await createUser(EMAIL, "CLIENT");
    await requestReset(EMAIL);
    await requestReset(EMAIL);
    expect(sentEmails()).toHaveLength(1);

    const token = tokenFrom(sentEmails()[0].text, "/reset-password");
    const rows = await db
      .select()
      .from(passwordResetTokens)
      .where(eq(passwordResetTokens.userId, userId));
    expect(rows).toHaveLength(1);
    expect(rows[0].tokenHash).toBe(hashEmailToken(token));
    expect(JSON.stringify(rows)).not.toContain(token);
  });

  it("réinitialise, révoque les sessions existantes et refuse la réutilisation", async () => {
    await createUser(EMAIL, "CLIENT");
    const oldSession = request.agent(app);
    await oldSession
      .post("/api/auth/login")
      .send({ email: EMAIL, password: PASSWORD })
      .expect(200);
    await oldSession.get("/api/auth/me").expect(200);

    await requestReset(EMAIL);
    const token = tokenFrom(sentEmails()[0].text, "/reset-password");

    // Les sessions sont comparées à la seconde : on garantit l'écart.
    await new Promise((r) => setTimeout(r, 1100));
    const reset = await request(app)
      .post("/api/auth/reset-password")
      .send({ token, password: NEW_PASSWORD });
    expect(reset.status).toBe(200);

    expect((await oldSession.get("/api/auth/me")).status).toBe(401);
    expect(
      (
        await request(app)
          .post("/api/auth/login")
          .send({ email: EMAIL, password: PASSWORD })
      ).status,
    ).toBe(401);
    expect(
      (
        await request(app)
          .post("/api/auth/login")
          .send({ email: EMAIL, password: NEW_PASSWORD })
      ).status,
    ).toBe(200);

    const reuse = await request(app)
      .post("/api/auth/reset-password")
      .send({ token, password: "EncoreUnAutre123!" });
    expect(reuse.status).toBe(400);
    expect(reuse.body.error.code).toBe("INVALID_RESET_TOKEN");
  });

  it("refuse un jeton expiré, inconnu ou un mot de passe trop court", async () => {
    const userId = await createUser(EMAIL, "CLIENT");
    const expired = "ab".repeat(32);
    await db.insert(passwordResetTokens).values({
      id: randomUUID(),
      userId,
      tokenHash: hashEmailToken(expired),
      expiresAt: new Date(Date.now() - 1000),
    });
    for (const token of [expired, "cd".repeat(32)]) {
      const res = await request(app)
        .post("/api/auth/reset-password")
        .send({ token, password: NEW_PASSWORD });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("INVALID_RESET_TOKEN");
    }
    const short = await request(app)
      .post("/api/auth/reset-password")
      .send({ token: expired, password: "court" });
    expect(short.status).toBe(400);
    expect(short.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("n'envoie rien à un compte suspendu", async () => {
    const userId = await createUser(EMAIL, "CLIENT");
    await db
      .update(users)
      .set({ status: "SUSPENDED" })
      .where(eq(users.id, userId));
    expect((await requestReset(EMAIL)).status).toBe(202);
    expect(sentEmails()).toHaveLength(0);
  });

  it("une panne SMTP n'échoue pas la demande", async () => {
    await createUser(EMAIL, "CLIENT");
    simulateMailFailures(1);
    expect((await requestReset(EMAIL)).status).toBe(202);
  });

  it("limite les demandes par IP (429)", async () => {
    const limited = createApp({
      rateLimits: { passwordReset: { windowMs: 60_000, limit: 2 } },
    });
    for (let i = 0; i < 2; i += 1) {
      await request(limited)
        .post("/api/auth/forgot-password")
        .send({ email: EMAIL })
        .expect(202);
    }
    const blocked = await request(limited)
      .post("/api/auth/forgot-password")
      .send({ email: EMAIL });
    expect(blocked.status).toBe(429);
  });
});

describe("email de vérification", () => {
  it("est envoyé à l'inscription avec un lien utilisable", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({
        email: "verify-me@example.com",
        password: PASSWORD,
        role: "CLIENT",
      });
    expect(res.status).toBe(201);
    const [mail] = sentEmails();
    expect(mail.to).toBe("verify-me@example.com");
    expect(mail.subject).toContain("Confirmez");
    const token = tokenFrom(mail.text, "/verify-email");
    await request(app)
      .post("/api/auth/verify-email")
      .send({ token })
      .expect(200);
  });

  it("une panne SMTP n'échoue pas l'inscription", async () => {
    simulateMailFailures(1);
    const res = await request(app)
      .post("/api/auth/register")
      .send({
        email: "smtp-down@example.com",
        password: PASSWORD,
        role: "CLIENT",
      });
    expect(res.status).toBe(201);
    expect(sentEmails()).toHaveLength(0);
  });
});
