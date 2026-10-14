import { describe, expect, it } from "vitest";
import { isBookingEnded } from "@findbarber/shared/booking";

const NOW = new Date("2026-10-14T12:00:00.000Z");

describe("isBookingEnded", () => {
  it("refuse une réservation future ou en cours", () => {
    expect(isBookingEnded("2026-10-22T07:45:00.000Z", NOW)).toBe(false);
    expect(isBookingEnded(new Date("2026-10-14T12:00:01.000Z"), NOW)).toBe(false);
  });

  it("accepte dès que la fin réelle est atteinte", () => {
    expect(isBookingEnded("2026-10-14T12:00:00.000Z", NOW)).toBe(true);
    expect(isBookingEnded(new Date("2026-10-13T12:45:00.000Z"), NOW)).toBe(true);
  });

  it("refuse une date de fin illisible", () => {
    expect(isBookingEnded("pas-une-date", NOW)).toBe(false);
  });
});
