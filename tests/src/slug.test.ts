// Identifiant d'URL d'une ville (lot N9).
import { describe, expect, it } from "vitest";
import {
  CITY_SLUG_MAX_LENGTH,
  isCitySlug,
  slugifyCity,
} from "../../server/src/lib/slug";

describe("slugifyCity", () => {
  it("retire les accents, passe en minuscules et sépare par des tirets", () => {
    expect(slugifyCity("Genève")).toBe("geneve");
    expect(slugifyCity("GENÈVE")).toBe("geneve");
    expect(slugifyCity("Saint-Gervais-les-Bains")).toBe("saint-gervais-les-bains");
    expect(slugifyCity("  Zürich  ")).toBe("zurich");
    expect(slugifyCity("L'Isle-d'Abeau")).toBe("l-isle-d-abeau");
    expect(slugifyCity("Aix en  Provence")).toBe("aix-en-provence");
  });

  it("donne une chaîne vide sans lettre ni chiffre latin", () => {
    expect(slugifyCity("")).toBe("");
    expect(slugifyCity("---")).toBe("");
    expect(slugifyCity("Москва")).toBe("");
  });

  it("borne la longueur sans tiret final", () => {
    const slug = slugifyCity(`${"a".repeat(79)} b`);
    expect(slug.length).toBeLessThanOrEqual(CITY_SLUG_MAX_LENGTH);
    expect(slug.endsWith("-")).toBe(false);
  });
});

describe("isCitySlug", () => {
  it("n'accepte que la forme produite par slugifyCity", () => {
    for (const ok of ["geneve", "saint-gervais-les-bains", "paris-4"]) {
      expect(isCitySlug(ok), ok).toBe(true);
    }
    for (const bad of ["", "Geneve", "a_b", "-a", "a-", "a--b", "../x", "a b", "a".repeat(81)]) {
      expect(isCitySlug(bad), bad).toBe(false);
    }
  });
});
