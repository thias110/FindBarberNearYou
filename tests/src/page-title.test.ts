import { describe, expect, it } from "vitest";
import { pageTitle } from "../../client/src/lib/pageTitle";

describe("pageTitle", () => {
  it("donne un titre explicite aux routes connues", () => {
    expect(pageTitle("/aide")).toBe("Questions fréquentes — FindBarber");
    expect(pageTitle("/barbers")).toBe("Rechercher un barber — FindBarber");
    expect(pageTitle("/pro/stats")).toBe("Mes statistiques — FindBarber");
    expect(pageTitle("/settings")).toBe("Paramètres — FindBarber");
    expect(pageTitle("/admin/users/")).toBe(
      "Utilisateurs — Administration — FindBarber",
    );
  });

  it("gère les routes paramétrées", () => {
    expect(pageTitle("/barbers/abc-123")).toBe("Profil du barber — FindBarber");
    expect(pageTitle("/admin/barbers/abc/stats")).toBe(
      "Statistiques du barber — Administration — FindBarber",
    );
  });

  it("laisse les pages d'authentification poser leur titre", () => {
    expect(pageTitle("/login")).toBeNull();
    expect(pageTitle("/verify-email")).toBeNull();
  });

  it("donne le titre « Page introuvable » à une route inconnue", () => {
    expect(pageTitle("/inconnue")).toBe("Page introuvable — FindBarber");
  });
});
