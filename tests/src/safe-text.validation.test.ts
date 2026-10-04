import { describe, expect, it } from "vitest";
import { containsControlChars, safeText } from "@findbarber/shared/validation";

describe("containsControlChars", () => {
  it("détecte les caractères de contrôle interdits", () => {
    expect(containsControlChars("a\u0000b")).toBe(true);
    expect(containsControlChars("a\u001bb")).toBe(true);
    expect(containsControlChars("a\u000Bb")).toBe(true);
    expect(containsControlChars("a\u000Cb")).toBe(true);
    expect(containsControlChars("a\u007Fb")).toBe(true);
    expect(containsControlChars("texte normal")).toBe(false);
  });

  it("autorise les sauts de ligne et tabulations", () => {
    expect(containsControlChars("ligne\nsuivante")).toBe(false);
    expect(containsControlChars("colonne\tvaleur")).toBe(false);
    expect(containsControlChars("retour\rchariot")).toBe(false);
  });
});

describe("safeText", () => {
  const schema = safeText(10, "Trop long.");

  it("trim puis accepte un texte normal", () => {
    expect(schema.parse("  hello  ")).toBe("hello");
  });

  it("rejette les caractères de contrôle", () => {
    expect(schema.safeParse("a\u0000b").success).toBe(false);
    expect(schema.safeParse("a\u001bb").success).toBe(false);
    expect(schema.safeParse("a\u000Bb").success).toBe(false);
  });

  it("applique la longueur maximale après trim", () => {
    expect(schema.safeParse("12345678901").success).toBe(false);
    expect(schema.safeParse("1234567890").success).toBe(true);
  });
});
