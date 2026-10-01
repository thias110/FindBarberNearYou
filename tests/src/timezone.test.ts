import { describe, expect, it } from "vitest";
import {
  classifyIanaTimeZone,
  hasIanaTimeZoneList,
  listIanaTimeZones,
} from "@findbarber/shared/timezones";

describe("listIanaTimeZones", () => {
  it("fournit la liste canonique plus UTC quand Intl est disponible", () => {
    if (!hasIanaTimeZoneList()) return; // environnement sans supportedValuesOf
    const zones = listIanaTimeZones();
    expect(zones).toContain("UTC");
    expect(zones).toContain("Europe/Zurich");
    expect(zones.some((zone) => zone.toLowerCase().startsWith("etc/"))).toBe(
      false,
    );
  });
});

describe("classifyIanaTimeZone", () => {
  it("distingue valeur vide et valeur invalide (jamais confondues)", () => {
    expect(classifyIanaTimeZone("")).toEqual({ kind: "empty" });
    expect(classifyIanaTimeZone("   ")).toEqual({ kind: "empty" });
    expect(classifyIanaTimeZone("+01:00").kind).toBe("invalid");
  });

  it("accepte UTC explicitement, sans distinction de casse", () => {
    expect(classifyIanaTimeZone("UTC")).toEqual({ kind: "valid", value: "UTC" });
    expect(classifyIanaTimeZone("utc")).toEqual({ kind: "valid", value: "UTC" });
  });

  it("corrige la casse via la liste canonique", () => {
    expect(classifyIanaTimeZone("Europe/Zurich")).toEqual({
      kind: "valid",
      value: "Europe/Zurich",
    });
    expect(classifyIanaTimeZone("europe/zurich")).toEqual({
      kind: "valid",
      value: "Europe/Zurich",
    });
  });

  it("conserve un alias avec / reconnu par Intl, sans conversion", () => {
    // « US/Eastern » est un alias stable du backward tzdata. On n'assume ni sa
    // présence dans la liste canonique, ni sa résolution par une version
    // précise d'ICU : seule la conservation de la valeur est vérifiée.
    const parsed = classifyIanaTimeZone("US/Eastern");
    expect(parsed).toSatisfy(
      (result) =>
        result.kind === "invalid" ||
        (result.kind === "valid" && result.value === "US/Eastern"),
    );
    // Si l'ICU courant le reconnaît (cas normal), la valeur est bien conservée
    // telle quelle, jamais remplacée par resolvedOptions().timeZone.
    if (parsed.kind === "valid") {
      expect(parsed.value).toBe("US/Eastern");
    }
  });

  it("refuse Etc/… sans distinction de casse (restriction produit, pas « invalide »)", () => {
    expect(classifyIanaTimeZone("Etc/GMT+1")).toMatchObject({
      kind: "restricted",
    });
    expect(classifyIanaTimeZone("etc/utc")).toMatchObject({
      kind: "restricted",
    });
  });

  it("refuse offsets, abréviations seules et noms inconnus", () => {
    for (const value of [
      "+01:00",
      "+23",
      "-2359",
      "CET",
      "GMT",
      "Mars/Olympus",
      "Europe/Zurich/Extra",
    ]) {
      expect(classifyIanaTimeZone(value).kind, value).toBe("invalid");
    }
  });
});
