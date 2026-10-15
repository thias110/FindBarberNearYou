import { describe, expect, it } from "vitest";
import {
  boundsAround,
  distanceKm,
  formatDistance,
  normalizeBounds,
} from "../../client/src/lib/geo";
import { legacyFilterTags, parseSearchUrl } from "../../client/src/lib/searchUrl";

// Géométrie de la recherche (issues #50, #52) : la position du visiteur reste
// dans le navigateur, seul un rectangle englobant part au serveur.

const GENEVE = { latitude: 46.2044, longitude: 6.1432 };
const LAUSANNE = { latitude: 46.5197, longitude: 6.6323 };

describe("distanceKm", () => {
  it("computes great-circle distances", () => {
    expect(distanceKm(GENEVE, GENEVE)).toBe(0);
    expect(distanceKm(GENEVE, LAUSANNE)).toBeGreaterThan(50);
    expect(distanceKm(GENEVE, LAUSANNE)).toBeLessThan(53);
  });
});

describe("boundsAround", () => {
  it("contains the whole circle (plus a margin for approximate positions)", () => {
    const bounds = boundsAround(GENEVE, 10);
    expect(bounds.minLat).toBeLessThan(GENEVE.latitude);
    expect(bounds.maxLat).toBeGreaterThan(GENEVE.latitude);
    // Les quatre points cardinaux à 10 km sont dans le rectangle.
    const north = { latitude: GENEVE.latitude + 10 / 111.32, longitude: GENEVE.longitude };
    const east = {
      latitude: GENEVE.latitude,
      longitude:
        GENEVE.longitude + 10 / (111.32 * Math.cos((GENEVE.latitude * Math.PI) / 180)),
    };
    expect(north.latitude).toBeLessThan(bounds.maxLat);
    expect(east.longitude).toBeLessThan(bounds.maxLng);
    // Et Lausanne (≈ 51 km) n'y est pas.
    expect(LAUSANNE.latitude).toBeGreaterThan(bounds.maxLat);
  });

  it("stays within the API ranges near the poles", () => {
    const bounds = boundsAround({ latitude: 89.99, longitude: 179.9 }, 25);
    expect(bounds.maxLat).toBeLessThanOrEqual(90);
    expect(bounds.minLng).toBeGreaterThanOrEqual(-180);
    expect(bounds.maxLng).toBeLessThanOrEqual(180);
    expect(bounds.minLat).toBeLessThanOrEqual(bounds.maxLat);
    expect(bounds.minLng).toBeLessThanOrEqual(bounds.maxLng);
  });
});

describe("normalizeBounds", () => {
  it("covers every longitude when the view wraps around the world", () => {
    expect(normalizeBounds({ minLat: -10, maxLat: 10, minLng: 170, maxLng: 190 })).toEqual({
      minLat: -10,
      maxLat: 10,
      minLng: -180,
      maxLng: 180,
    });
    expect(
      normalizeBounds({ minLat: -95, maxLat: 95, minLng: -400, maxLng: 400 }),
    ).toEqual({ minLat: -90, maxLat: 90, minLng: -180, maxLng: 180 });
  });

  it("keeps a normal view and rounds to 6 decimals", () => {
    expect(
      normalizeBounds({ minLat: 46.1234567, maxLat: 46.3, minLng: 6, maxLng: 6.3 }),
    ).toEqual({ minLat: 46.123457, maxLat: 46.3, minLng: 6, maxLng: 6.3 });
  });
});

describe("formatDistance", () => {
  it("never shows meters (public positions are approximate)", () => {
    expect(formatDistance(0.3)).toBe("moins de 1 km");
    expect(formatDistance(3.44)).toBe("3,4 km");
    expect(formatDistance(12.6)).toBe("13 km");
  });
});

describe("parseSearchUrl", () => {
  it("reads smart filters and ignores invalid values", () => {
    const state = parseSearchUrl(
      new URLSearchParams("maxPrice=30&currency=eur&minRating=4&radiusKm=5&page=2"),
    );
    expect(state).toMatchObject({
      maxPrice: 30,
      currency: "EUR",
      minRating: 4,
      radiusKm: 5,
      page: 2,
    });
    const invalid = parseSearchUrl(
      new URLSearchParams("maxPrice=-1&currency=GBP&minRating=9&radiusKm=abc&page=0"),
    );
    expect(invalid).toMatchObject({
      maxPrice: null,
      currency: "CHF",
      minRating: null,
      radiusKm: null,
      page: 1,
    });
  });

  it("exposes inherited filters as removable tags", () => {
    const tags = legacyFilterTags(parseSearchUrl(new URLSearchParams("technique=degrade&q=Ali")));
    expect(tags).toEqual([
      { key: "technique", label: "Prestation : Dégradé" },
      { key: "q", label: "Nom : Ali" },
    ]);
  });
});
