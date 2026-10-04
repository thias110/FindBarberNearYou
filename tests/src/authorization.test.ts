import { describe, expect, it } from "vitest";
import { AppError } from "../../server/src/lib/errors";
import {
  assertBookingClientOwner,
  assertBookingReadAccess,
  bookingNotFound,
  isBookingBarberOwner,
  isBookingClientOwner,
  type AuthUser,
} from "../../server/src/lib/authorization";

function user(id: string, role: AuthUser["role"]): AuthUser {
  return { id, role };
}

const booking = { clientUserId: "client-a", barberProfileId: "barber-a" };

function expectBookingNotFound(fn: () => void) {
  try {
    fn();
  } catch (err) {
    expect(err).toBeInstanceOf(AppError);
    const appError = err as AppError;
    expect(appError.status).toBe(404);
    expect(appError.code).toBe("BOOKING_NOT_FOUND");
    return;
  }
  throw new Error("Une erreur 404 BOOKING_NOT_FOUND était attendue.");
}

describe("isBookingClientOwner", () => {
  it("accepte uniquement le CLIENT propriétaire", () => {
    expect(isBookingClientOwner(user("client-a", "CLIENT"), booking)).toBe(true);
    expect(isBookingClientOwner(user("client-b", "CLIENT"), booking)).toBe(false);
    expect(isBookingClientOwner(user("client-a", "BARBER"), booking)).toBe(false);
    expect(isBookingClientOwner(user("client-a", "ADMIN"), booking)).toBe(false);
  });
});

describe("isBookingBarberOwner", () => {
  it("compare le profil barber de la réservation", () => {
    expect(isBookingBarberOwner("barber-a", booking)).toBe(true);
    expect(isBookingBarberOwner("barber-b", booking)).toBe(false);
  });
});

describe("assertBookingReadAccess", () => {
  it("autorise le CLIENT propriétaire", () => {
    expect(() =>
      assertBookingReadAccess(user("client-a", "CLIENT"), booking, null),
    ).not.toThrow();
  });

  it("autorise le BARBER propriétaire", () => {
    expect(() =>
      assertBookingReadAccess(user("barber-user", "BARBER"), booking, "barber-a"),
    ).not.toThrow();
  });

  it("autorise ADMIN (convention explicite, lecture seule)", () => {
    expect(() =>
      assertBookingReadAccess(user("admin", "ADMIN"), booking, null),
    ).not.toThrow();
  });

  it("refuse un CLIENT non propriétaire en 404 BOOKING_NOT_FOUND", () => {
    expectBookingNotFound(() =>
      assertBookingReadAccess(user("client-b", "CLIENT"), booking, null),
    );
  });

  it("refuse un BARBER non propriétaire en 404 BOOKING_NOT_FOUND", () => {
    expectBookingNotFound(() =>
      assertBookingReadAccess(user("barber-b", "BARBER"), booking, "barber-b"),
    );
  });

  it("refuse un BARBER sans profil en 404 BOOKING_NOT_FOUND", () => {
    expectBookingNotFound(() =>
      assertBookingReadAccess(user("barber-b", "BARBER"), booking, null),
    );
  });
});

describe("assertBookingClientOwner", () => {
  it("autorise le CLIENT propriétaire", () => {
    expect(() =>
      assertBookingClientOwner(user("client-a", "CLIENT"), booking),
    ).not.toThrow();
  });

  it("refuse un autre client, un BARBER ou un ADMIN en 404", () => {
    expectBookingNotFound(() =>
      assertBookingClientOwner(user("client-b", "CLIENT"), booking),
    );
    expectBookingNotFound(() =>
      assertBookingClientOwner(user("barber-user", "BARBER"), booking),
    );
    expectBookingNotFound(() =>
      assertBookingClientOwner(user("admin", "ADMIN"), booking),
    );
  });
});

describe("bookingNotFound", () => {
  it("produit une AppError 404 BOOKING_NOT_FOUND", () => {
    const error = bookingNotFound();
    expect(error).toBeInstanceOf(AppError);
    expect(error.status).toBe(404);
    expect(error.code).toBe("BOOKING_NOT_FOUND");
    expect(error.message).toBe("Réservation introuvable.");
  });
});
