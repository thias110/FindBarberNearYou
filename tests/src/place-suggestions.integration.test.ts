// Autocomplétion de ville de la recherche publique (lot N4) : route publique,
// saisie bornée, cache 24 h, limitation de débit dédiée, villes et quartiers
// seulement (faux géocodeur injecté en test, aucun appel réseau).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { createApp } from "../../server/src/app";
import {
  extractPlaces,
  setGeocoder,
} from "../../server/src/lib/geocoding";
import {
  clearPlaceCache,
  PLACE_CACHE_TTL_MS,
  suggestCities,
} from "../../server/src/modules/places/service";
import { AppError } from "../../server/src/lib/errors";

beforeEach(() => {
  clearPlaceCache();
});

afterEach(() => {
  setGeocoder(null);
});

function fakeGeocoder() {
  const suggestPlaces = vi.fn().mockResolvedValue([
    { name: "Genève", label: "Genève, Genève, Suisse" },
  ]);
  setGeocoder({ geocode: vi.fn(), suggestPlaces });
  return suggestPlaces;
}

describe("GET /api/places/suggest (lot N4)", () => {
  it("répond sans authentification avec des villes, sans coordonnées", async () => {
    const app = createApp();
    const suggestPlaces = fakeGeocoder();
    const res = await request(app).get("/api/places/suggest").query({ q: "  Gen " });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      suggestions: [{ name: "Genève", label: "Genève, Genève, Suisse" }],
    });
    // Saisie nettoyée, limite fixe.
    expect(suggestPlaces).toHaveBeenCalledWith("Gen", 5);
    expect(res.headers["cache-control"]).toContain("max-age=86400");
  });

  it("valide la saisie : 2 à 80 caractères, aucun paramètre en trop", async () => {
    const app = createApp();
    const suggestPlaces = fakeGeocoder();
    const bad = [
      {},
      { q: "" },
      { q: "a" },
      { q: " a " },
      { q: "x".repeat(81) },
      { q: "Genève", extra: "1" },
    ];
    for (const query of bad) {
      const res = await request(app).get("/api/places/suggest").query(query);
      expect(res.status, JSON.stringify(query)).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    }
    expect((await request(app).get("/api/places/suggest?q=a&q=b")).status).toBe(400);
    expect(suggestPlaces).not.toHaveBeenCalled();

    const ok = await request(app).get("/api/places/suggest").query({ q: "x".repeat(80) });
    expect(ok.status).toBe(200);
  });

  it("garde la réponse 24 h par saisie normalisée (casse ignorée)", async () => {
    const app = createApp();
    const suggestPlaces = fakeGeocoder();
    await request(app).get("/api/places/suggest").query({ q: "Genève" });
    await request(app).get("/api/places/suggest").query({ q: "genève" });
    await request(app).get("/api/places/suggest").query({ q: " GENÈVE " });
    expect(suggestPlaces).toHaveBeenCalledTimes(1);

    await request(app).get("/api/places/suggest").query({ q: "Lausanne" });
    expect(suggestPlaces).toHaveBeenCalledTimes(2);
  });

  it("rappelle le fournisseur une fois les 24 h écoulées", async () => {
    const suggestPlaces = fakeGeocoder();
    const t0 = 1_000_000;
    await suggestCities("Genève", t0);
    await suggestCities("Genève", t0 + PLACE_CACHE_TTL_MS - 1);
    expect(suggestPlaces).toHaveBeenCalledTimes(1);
    await suggestCities("Genève", t0 + PLACE_CACHE_TTL_MS + 1);
    expect(suggestPlaces).toHaveBeenCalledTimes(2);
  });

  it("ne met jamais une erreur en cache et répond 503 sans fuite de la saisie", async () => {
    const app = createApp();
    const suggestPlaces = vi
      .fn()
      .mockRejectedValueOnce(
        new AppError(503, "GEOCODING_UNAVAILABLE", "Service de géocodage indisponible."),
      )
      .mockResolvedValue([{ name: "Genève", label: "Genève, Suisse" }]);
    setGeocoder({ geocode: vi.fn(), suggestPlaces });

    const failed = await request(app).get("/api/places/suggest").query({ q: "Secret" });
    expect(failed.status).toBe(503);
    expect(failed.body.error.code).toBe("GEOCODING_UNAVAILABLE");
    expect(JSON.stringify(failed.body)).not.toContain("Secret");

    const retried = await request(app).get("/api/places/suggest").query({ q: "Secret" });
    expect(retried.status).toBe(200);
    expect(suggestPlaces).toHaveBeenCalledTimes(2);
  });

  it("répond 503 si le géocodage n'est pas configuré", async () => {
    const app = createApp();
    const res = await request(app).get("/api/places/suggest").query({ q: "Genève" });
    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe("GEOCODING_UNAVAILABLE");
  });

  it("limite le débit avec un bucket dédié (429)", async () => {
    const app = createApp({ rateLimits: { places: { windowMs: 60_000, limit: 2 } } });
    fakeGeocoder();
    const statuses: number[] = [];
    for (let i = 0; i < 3; i += 1) {
      const res = await request(app).get("/api/places/suggest").query({ q: "Genève" });
      statuses.push(res.status);
    }
    expect(statuses).toEqual([200, 200, 429]);
  });
});

describe("extractPlaces : réponse du fournisseur", () => {
  it("garde le nom court et le libellé, sans doublon, sans confiance dans la forme", () => {
    const data = {
      features: [
        { text: "Genève", place_name: "Genève, Genève, Suisse", geometry: {} },
        { text: "Genève", place_name: "Genève, Genève, Suisse" },
        { text: "Carouge", place_name: "Carouge, Genève, Suisse" },
        { text: 12, place_name: "x" },
        { text: "  ", place_name: "y" },
        null,
        "texte",
      ],
    };
    expect(extractPlaces(data, 5)).toEqual([
      { name: "Genève", label: "Genève, Genève, Suisse" },
      { name: "Carouge", label: "Carouge, Genève, Suisse" },
    ]);
    expect(extractPlaces(data, 1)).toHaveLength(1);
    expect(extractPlaces(null, 5)).toEqual([]);
    expect(extractPlaces({ features: "non" }, 5)).toEqual([]);
  });
});
