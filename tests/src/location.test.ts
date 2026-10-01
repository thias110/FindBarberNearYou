import { describe, expect, it } from "vitest";
import {
  approximateCoordinate,
  approximateCoordinates,
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
