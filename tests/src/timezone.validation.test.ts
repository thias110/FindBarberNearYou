import { describe, expect, it } from "vitest";
import { profileSchema } from "@findbarber/shared/validation";

const validProfile = {
  displayName: "Barbier Test",
  description: "Description",
  address: "Rue 1",
  city: "Genève",
  postalCode: null,
  countryCode: "CH",
  latitude: 46.2,
  longitude: 6.14,
  currency: "CHF",
};

function parse(body: Record<string, unknown>) {
  return profileSchema.safeParse({ ...validProfile, ...body });
}

describe("profileSchema.timezone", () => {
  it("absent → undefined (inchangé)", () => {
    const parsed = parse({});
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.timezone).toBeUndefined();
  });

  it("null → effacement explicite", () => {
    const parsed = parse({ timezone: null });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.timezone).toBeNull();
  });

  it("vide ou espaces (après trim) → effacement explicite", () => {
    for (const value of ["", "   "]) {
      const parsed = parse({ timezone: value });
      expect(parsed.success, JSON.stringify(value)).toBe(true);
      if (parsed.success) expect(parsed.data.timezone).toBeNull();
    }
  });

  it("valeur valide → normalisée", () => {
    const utc = parse({ timezone: "utc" });
    expect(utc.success).toBe(true);
    if (utc.success) expect(utc.data.timezone).toBe("UTC");

    const recased = parse({ timezone: "europe/zurich" });
    expect(recased.success).toBe(true);
    if (recased.success) expect(recased.data.timezone).toBe("Europe/Zurich");
  });

  it("valeur non vide invalide → échec, jamais convertie en null", () => {
    for (const value of ["+01:00", "+23", "-2359", "CET", "Mars/Olympus"]) {
      const parsed = parse({ timezone: value });
      expect(parsed.success, JSON.stringify(value)).toBe(false);
    }
  });

  it("Etc/… → échec (restriction produit)", () => {
    for (const value of ["Etc/GMT+1", "ETC/UTC"]) {
      const parsed = parse({ timezone: value });
      expect(parsed.success, value).toBe(false);
    }
  });

  it("valeur trop longue → échec", () => {
    const parsed = parse({ timezone: `Europe/${"x".repeat(58)}` });
    expect(parsed.success).toBe(false);
  });

  it("les champs inconnus restent refusés (.strict)", () => {
    const parsed = parse({ unexpected: true });
    expect(parsed.success).toBe(false);
  });
});
