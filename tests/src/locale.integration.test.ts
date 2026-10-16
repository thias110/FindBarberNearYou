// Langue du compte (issues #32, #38) : français par défaut, choisie à
// l'inscription, modifiable par son seul titulaire, valeurs fr/en/it/es.
import request from "supertest";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../server/src/app";
import { migrateDb } from "../../server/src/db/migrate";
import { createUser, login, PASSWORD, resetBookingTables } from "./booking-api-helpers";

const app = createApp();

beforeAll(async () => {
  await migrateDb();
});

beforeEach(async () => {
  await resetBookingTables();
});

describe("langue du compte", () => {
  it("vaut fr par défaut et suit le choix fait à l'inscription", async () => {
    await createUser("defaut@example.com", "CLIENT");
    const session = await login(app, "defaut@example.com");
    expect((await session.agent.get("/api/auth/me")).body.user.locale).toBe("fr");

    const res = await request(app)
      .post("/api/auth/register")
      .send({ email: "it@example.com", password: PASSWORD, role: "CLIENT", locale: "it" });
    expect(res.status).toBe(201);
    expect(res.body.user.locale).toBe("it");
  });

  it("refuse une langue non prise en charge à l'inscription", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({ email: "de@example.com", password: PASSWORD, role: "CLIENT", locale: "de" });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("se modifie par PATCH /api/users/me/locale, pour la session courante seulement", async () => {
    await createUser("a@example.com", "CLIENT");
    await createUser("b@example.com", "BARBER");
    const a = await login(app, "a@example.com");

    const ok = await a.agent
      .patch("/api/users/me/locale")
      .set("X-CSRF-Token", a.csrf)
      .send({ locale: "es" });
    expect(ok.status).toBe(200);
    expect(ok.body.user.locale).toBe("es");
    expect((await a.agent.get("/api/auth/me")).body.user.locale).toBe("es");

    const b = await login(app, "b@example.com");
    expect((await b.agent.get("/api/auth/me")).body.user.locale).toBe("fr");
  });

  it("valide la valeur, exige une session et le jeton CSRF", async () => {
    await createUser("c@example.com", "CLIENT");
    const c = await login(app, "c@example.com");
    for (const body of [{ locale: "de" }, { locale: "en", userId: "x" }, {}]) {
      const res = await c.agent
        .patch("/api/users/me/locale")
        .set("X-CSRF-Token", c.csrf)
        .send(body);
      expect(res.status, JSON.stringify(body)).toBe(400);
    }
    expect(
      (await request(app).patch("/api/users/me/locale").send({ locale: "en" })).status,
    ).toBe(401);
    expect(
      (await c.agent.patch("/api/users/me/locale").send({ locale: "en" })).status,
    ).toBe(403);
  });
});
