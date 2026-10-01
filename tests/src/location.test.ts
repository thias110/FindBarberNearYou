import { describe, expect, it } from "vitest";
import {
  approximateCoordinate,
  approximateCoordinates,
  haversineDistanceKm,
  isValidLatitude,
  isValidLongitude,
} from "../../server/src/lib/location";

describe("approximateCoordinate", () => {
  it("rounds to two decimals", () => {
    expect(approximateCoordinate(46.2044)).toBe(46.2);
    expect(approximateCoordinate(6.1432)).toBe(6.14);
    expect(approximateCoordinate(46.20449)).toBe(46.2);
    expect(approximateCoordinate(46.2051)).toBe(46.21);
  });

  it("handles negative values, including -0 normalised to 0", () => {
    expect(approximateCoordinate(-33.8688)).toBe(-33.87);
    expect(approximateCoordinate(-0.004)).toBe(0);
    expect(approximateCoordinate(-0)).toBe(0);
    expect(Object.is(approximateCoordinate(-0.001), 0)).toBe(true);
  });

  it("keeps values already at two decimals unchanged (equality is allowed)", () => {
    // La règle est une transformation, pas une inégalité systématique : un
    // arrondi peut être égal à la valeur exacte si elle a déjà deux décimales.
    for (const value of [46.2, 6.14, -33.87, 0, 12.34, 100.5]) {
      expect(approximateCoordinate(value)).toBe(value);
    }
  });

  it("preserves geographic boundaries", () => {
    expect(approximateCoordinate(90)).toBe(90);
    expect(approximateCoordinate(-90)).toBe(-90);
    expect(approximateCoordinate(180)).toBe(180);
    expect(approximateCoordinate(-180)).toBe(-180);
    expect(approximateCoordinate(89.999)).toBe(90);
  });

  it("returns a rounded latitude/longitude pair", () => {
    expect(approximateCoordinates(46.20449, 6.14321)).toEqual({
      latitude: 46.2,
      longitude: 6.14,
    });
    expect(approximateCoordinates(-33.8688, 151.2093)).toEqual({
      latitude: -33.87,
      longitude: 151.21,
    });
  });
});

describe("haversineDistanceKm", () => {
  it("returns 0 for identical points", () => {
    expect(haversineDistanceKm(46.2044, 6.1432, 46.2044, 6.1432)).toBe(0);
  });

  it("computes the approximate distance between two cities", () => {
    // Genève → Zurich ≈ 224 km.
    const distance = haversineDistanceKm(46.2044, 6.1432, 47.3769, 8.5417);
    expect(distance).toBeGreaterThan(200);
    expect(distance).toBeLessThan(250);
  });

  it("is symmetric", () => {
    const ab = haversineDistanceKm(46.2, 6.14, 47.37, 8.54);
    const ba = haversineDistanceKm(47.37, 8.54, 46.2, 6.14);
    expect(ab).toBeCloseTo(ba, 10);
  });

  it("throws a generic error for invalid coordinates (no private leak)", () => {
    expect(() => haversineDistanceKm(91, 0, 0, 0)).toThrow("Coordonnées invalides.");
    expect(() => haversineDistanceKm(0, 181, 0, 0)).toThrow("Coordonnées invalides.");
    expect(() => haversineDistanceKm(0, 0, -91, 0)).toThrow("Coordonnées invalides.");
  });
});

describe("coordinate validation", () => {
  it("validates latitudes and longitudes", () => {
    expect(isValidLatitude(0)).toBe(true);
    expect(isValidLatitude(90)).toBe(true);
    expect(isValidLatitude(-90)).toBe(true);
    expect(isValidLatitude(90.1)).toBe(false);
    expect(isValidLatitude(Number.NaN)).toBe(false);
    expect(isValidLongitude(0)).toBe(true);
    expect(isValidLongitude(180)).toBe(true);
    expect(isValidLongitude(-180)).toBe(true);
    expect(isValidLongitude(180.1)).toBe(false);
  });
});
