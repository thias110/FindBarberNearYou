import { describe, expect, it } from "vitest";
import type { AdminUser } from "@findbarber/shared/types";
import {
  adminUserDisplayName,
  bookingClientLabel,
  cancellationActorLabel,
} from "../../client/src/lib/admin";

const baseUser: AdminUser = {
  id: "user-1",
  email: "client@example.com",
  role: "CLIENT",
  status: "ACTIVE",
  name: "Alice",
  createdAt: "2026-01-01T00:00:00.000Z",
  barberProfileId: null,
};

describe("cancellationActorLabel", () => {
  it("nomme chaque responsable connu", () => {
    expect(cancellationActorLabel("CLIENT")).toBe("Le client");
    expect(cancellationActorLabel("BARBER")).toBe("Le professionnel");
    expect(cancellationActorLabel("ADMIN")).toBe("L'administration");
  });

  it("retourne null pour une valeur inconnue ou absente", () => {
    expect(cancellationActorLabel(null)).toBeNull();
    expect(cancellationActorLabel("SYSTEM")).toBeNull();
  });
});

describe("adminUserDisplayName", () => {
  it("préfère le nom quand il est renseigné", () => {
    expect(adminUserDisplayName(baseUser)).toBe("Alice");
  });

  it("retombe sur l'email quand le nom est absent ou vide", () => {
    expect(adminUserDisplayName({ ...baseUser, name: null })).toBe(
      "client@example.com",
    );
    expect(adminUserDisplayName({ ...baseUser, name: "   " })).toBe(
      "client@example.com",
    );
  });
});

describe("bookingClientLabel", () => {
  it("préfère le nom du client", () => {
    expect(
      bookingClientLabel({ clientName: "Bob", clientEmail: "bob@example.com" }),
    ).toBe("Bob");
  });

  it("retombe sur l'email puis sur un libellé neutre", () => {
    expect(
      bookingClientLabel({ clientName: "  ", clientEmail: "bob@example.com" }),
    ).toBe("bob@example.com");
    expect(
      bookingClientLabel({ clientName: null, clientEmail: null }),
    ).toBe("Client inconnu");
  });
});
