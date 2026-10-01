import { describe, expect, it } from "vitest";
import { profileSchema } from "@findbarber/shared/validation";

const base = {
  displayName: "Barbier",
  description: "Description",
  address: "Rue du Test 1",
  city: "Genève",
  postalCode: null,
  countryCode: "CH",
  latitude: 46.2,
  longitude: 6.14,
  currency: "CHF",
  places: ["SALON"],
};

function parse(overrides: Record<string, unknown> = {}) {
  return profileSchema.safeParse({ ...base, ...overrides });
}

describe("profileSchema — lieux de prestation (issue #19)", () => {
  it("accepts SALON with an address", () => {
    const parsed = parse();
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.places).toEqual(["SALON"]);
      expect(parsed.data.address).toBe("Rue du Test 1");
      expect(parsed.data.travelRadiusKm).toBeNull();
    }
  });

  it("accepts an AT_CLIENT-only profile without an address", () => {
    const parsed = parse({
      places: ["AT_CLIENT"],
      address: null,
      travelRadiusKm: 10,
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.address).toBeNull();
      expect(parsed.data.travelRadiusKm).toBe(10);
    }
  });

  it("normalises an empty address to null", () => {
    const parsed = parse({ places: ["AT_CLIENT"], address: "   ", travelRadiusKm: 5 });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.address).toBeNull();
  });

  it("accepts AT_CLIENT combined with SALON when both rules are met", () => {
    const parsed = parse({
      places: ["SALON", "AT_CLIENT"],
      address: "Rue 1",
      travelRadiusKm: 20,
    });
    expect(parsed.success).toBe(true);
  });

  it("deduplicates and normalises place codes", () => {
    const parsed = parse({ places: ["salon", "SALON", " At_Client "], travelRadiusKm: 5 });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.places).toEqual(["SALON", "AT_CLIENT"]);
    }
  });

  it("rejects an empty or missing place list", () => {
    expect(parse({ places: [] }).success).toBe(false);
    const { places, ...withoutPlaces } = base;
    void places;
    expect(profileSchema.safeParse(withoutPlaces).success).toBe(false);
  });

  it("rejects unknown place codes", () => {
    expect(parse({ places: ["HOME"] }).success).toBe(false);
    expect(parse({ places: ["SALON", "MARS"] }).success).toBe(false);
  });

  it("requires an address for SALON and AT_PROVIDER", () => {
    expect(parse({ places: ["SALON"], address: null }).success).toBe(false);
    expect(
      parse({ places: ["AT_PROVIDER"], address: "" }).success,
    ).toBe(false);
    expect(
      parse({ places: ["AT_PROVIDER"], address: "Rue 2" }).success,
    ).toBe(true);
  });

  it("requires travelRadiusKm when AT_CLIENT is selected", () => {
    expect(
      parse({ places: ["AT_CLIENT"], address: null, travelRadiusKm: null }).success,
    ).toBe(false);
    expect(
      parse({ places: ["AT_CLIENT"], address: null }).success,
    ).toBe(false);
  });

  it("rejects a non-null radius when AT_CLIENT is not selected", () => {
    expect(parse({ places: ["SALON"], travelRadiusKm: 10 }).success).toBe(false);
    expect(
      parse({ places: ["AT_PROVIDER"], travelRadiusKm: 10 }).success,
    ).toBe(false);
  });

  it("bounds travelRadiusKm to 1..100 integers", () => {
    for (const value of [0, 101, 1.5, -3, "10"]) {
      expect(
        parse({ places: ["AT_CLIENT"], address: null, travelRadiusKm: value })
          .success,
        JSON.stringify(value),
      ).toBe(false);
    }
    expect(
      parse({ places: ["AT_CLIENT"], address: null, travelRadiusKm: 1 }).success,
    ).toBe(true);
    expect(
      parse({ places: ["AT_CLIENT"], address: null, travelRadiusKm: 100 }).success,
    ).toBe(true);
  });

  it("still rejects unknown keys (.strict)", () => {
    expect(parse({ unexpected: true }).success).toBe(false);
  });
});
