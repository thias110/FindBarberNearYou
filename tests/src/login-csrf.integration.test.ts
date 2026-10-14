// CSRF de connexion (issue #12) : décision documentée.
// Login et inscription ne portent pas de jeton CSRF (aucune session n'existe
// encore). La protection repose sur le fait que l'API n'accepte QUE du JSON :
// un formulaire HTML d'un site tiers (urlencoded, multipart, text/plain) ne
// peut pas produire un corps JSON, et un `fetch` cross-origin avec
// `Content-Type: application/json` déclenche un preflight CORS refusé (origine
// exacte, voir CORS_ORIGIN). Ces tests verrouillent ce comportement : aucune
// session ne doit être créée par une requête non JSON.
import request from "supertest";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../server/src/app";
import { migrateDb } from "../../server/src/db/migrate";
import {
  createUser,
  PASSWORD,
  resetBookingTables,
} from "./booking-api-helpers";

const app = createApp();
const EMAIL = "csrf-login@example.com";

beforeAll(async () => {
  await migrateDb();
});

beforeEach(async () => {
  await resetBookingTables();
  await createUser(EMAIL, "CLIENT");
});

function setsSession(res: request.Response): boolean {
  const cookies = res.headers["set-cookie"] as unknown as string[] | undefined;
  return (cookies ?? []).some((c) => c.startsWith("auth_token="));
}

describe("login CSRF : seules les requêtes JSON ouvrent une session", () => {
  it("accepte le JSON (contrôle)", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: EMAIL, password: PASSWORD });
    expect(res.status).toBe(200);
    expect(setsSession(res)).toBe(true);
  });

  it.each([
    [
      "formulaire urlencoded",
      "application/x-www-form-urlencoded",
      `email=${encodeURIComponent(EMAIL)}&password=${PASSWORD}`,
    ],
    [
      "formulaire text/plain",
      "text/plain",
      JSON.stringify({ email: EMAIL, password: PASSWORD }),
    ],
  ])("refuse un %s sans créer de session", async (_label, type, body) => {
    const res = await request(app)
      .post("/api/auth/login")
      .set("Content-Type", type)
      .send(body);
    expect(res.status).toBe(400);
    expect(setsSession(res)).toBe(false);
  });

  it("le preflight CORS d'une origine tierce n'autorise pas l'appel", async () => {
    const res = await request(app)
      .options("/api/auth/login")
      .set("Origin", "https://evil.example")
      .set("Access-Control-Request-Method", "POST")
      .set("Access-Control-Request-Headers", "content-type");
    expect(res.headers["access-control-allow-origin"]).not.toBe(
      "https://evil.example",
    );
  });
});
