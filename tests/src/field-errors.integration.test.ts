// Erreurs rattachées aux champs (issue #57) : un 400 VALIDATION_ERROR porte,
// en plus du message lisible, la liste `fields` (chemin + message) que le
// client affiche sous chaque champ.
import request from "supertest";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../server/src/app";
import { migrateDb } from "../../server/src/db/migrate";
import { ApiError } from "../../client/src/lib/apiClient";
import { fieldErrorsFrom } from "../../client/src/lib/formErrors";
import { createUser, resetBookingTables } from "./booking-api-helpers";

const app = createApp();

beforeAll(async () => {
  await migrateDb();
});

beforeEach(async () => {
  await resetBookingTables();
});

describe("format des erreurs de validation", () => {
  it("renvoie le chemin et le message de chaque champ refusé", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({ email: "pas-un-email", password: "court", role: "CLIENT" });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(typeof res.body.error.message).toBe("string");
    const paths = (res.body.error.fields as { path: string }[]).map((f) => f.path);
    expect(paths).toEqual(expect.arrayContaining(["email", "password"]));
    for (const field of res.body.error.fields) {
      expect(field.message).toEqual(expect.any(String));
    }
  });

  it("n'ajoute pas `fields` aux autres erreurs", async () => {
    await createUser("deja@example.com", "CLIENT");
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "deja@example.com", password: "mauvais-mot-de-passe" });
    expect(res.status).toBe(401);
    expect(res.body.error).not.toHaveProperty("fields");
  });
});

describe("fieldErrorsFrom (client)", () => {
  it("indexe par premier segment, garde le premier message et ignore l'inconnu", () => {
    const err = new ApiError(400, "VALIDATION_ERROR", "…", [
      { path: "places.0", message: "Lieu invalide" },
      { path: "places.1", message: "Autre" },
      { path: "email", message: "Email invalide" },
      { path: "secret", message: "Ignoré" },
    ]);
    expect(fieldErrorsFrom(err, ["places", "email"])).toEqual({
      places: "Lieu invalide",
      email: "Email invalide",
    });
  });

  it("ne renvoie rien pour une autre erreur", () => {
    expect(fieldErrorsFrom(new ApiError(409, "SLOT_UNAVAILABLE", "x"), ["a"])).toEqual({});
    expect(fieldErrorsFrom(new Error("réseau"), ["a"])).toEqual({});
  });
});
