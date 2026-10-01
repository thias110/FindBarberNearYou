import { describe, expect, it } from "vitest";
import {
  compareCalendarDates,
  inclusiveDayCount,
  isValidCalendarDate,
} from "../../shared/src/dates";

describe("isValidCalendarDate", () => {
  it("accepts real calendar dates", () => {
    expect(isValidCalendarDate("2026-01-01")).toBe(true);
    expect(isValidCalendarDate("2026-12-31")).toBe(true);
    expect(isValidCalendarDate("2024-02-29")).toBe(true);
    expect(isValidCalendarDate("2000-02-29")).toBe(true);
  });

  it("rejects malformed formats", () => {
    for (const value of [
      "",
      "2026-1-1",
      "26-01-01",
      "2026/01/01",
      "2026-01-1",
      "2026-1-01",
      "aaaa-bb-cc",
      "2026-01-01T00:00:00Z",
    ]) {
      expect(isValidCalendarDate(value)).toBe(false);
    }
  });

  it("rejects impossible dates and non-leap February 29", () => {
    for (const value of [
      "2026-02-29",
      "1900-02-29",
      "2026-02-30",
      "2026-04-31",
      "2026-13-01",
      "2026-00-10",
      "2026-01-00",
      "2026-01-32",
    ]) {
      expect(isValidCalendarDate(value)).toBe(false);
    }
  });

  it("restricts years to 0001..9999 and handles early years", () => {
    // Année zéro refusée (même un 29 février « bissextile » pour 0000).
    expect(isValidCalendarDate("0000-01-01")).toBe(false);
    expect(isValidCalendarDate("0000-02-29")).toBe(false);
    // Bornes basses correctement traitées (pas de conversion 19xx).
    expect(isValidCalendarDate("0001-01-01")).toBe(true);
    expect(isValidCalendarDate("0099-01-01")).toBe(true);
    expect(isValidCalendarDate("0099-02-29")).toBe(false); // 99 non bissextile
    // Règles grégoriennes des siècles.
    expect(isValidCalendarDate("0400-02-29")).toBe(true); // 400 bissextile
    expect(isValidCalendarDate("1900-02-29")).toBe(false); // 1900 non bissextile
    expect(isValidCalendarDate("2000-02-29")).toBe(true); // 2000 bissextile
    expect(isValidCalendarDate("9999-12-31")).toBe(true);
  });
});

describe("compareCalendarDates", () => {
  it("orders dates chronologically", () => {
    expect(compareCalendarDates("2026-01-01", "2026-01-02")).toBe(-1);
    expect(compareCalendarDates("2026-01-02", "2026-01-01")).toBe(1);
    expect(compareCalendarDates("2026-01-01", "2026-01-01")).toBe(0);
  });
});

describe("inclusiveDayCount", () => {
  it("counts a single day as one", () => {
    expect(inclusiveDayCount("2026-06-15", "2026-06-15")).toBe(1);
  });

  it("counts inclusive ranges across month and year boundaries", () => {
    expect(inclusiveDayCount("2026-01-01", "2026-01-31")).toBe(31);
    expect(inclusiveDayCount("2026-01-01", "2026-12-31")).toBe(365);
    expect(inclusiveDayCount("2026-01-01", "2027-01-01")).toBe(366);
  });

  it("accounts for leap years", () => {
    expect(inclusiveDayCount("2024-02-01", "2024-02-29")).toBe(29);
    expect(inclusiveDayCount("2024-01-01", "2024-12-31")).toBe(366);
    expect(inclusiveDayCount("2025-01-01", "2025-12-31")).toBe(365);
  });

  it("is insensitive to DST transitions (UTC arithmetic)", () => {
    // Passage à l'heure d'été en Europe (nuit du 28 au 29 mars 2026).
    expect(inclusiveDayCount("2026-03-28", "2026-03-29")).toBe(2);
    // Passage à l'heure d'hiver (nuit du 25 au 26 octobre 2025).
    expect(inclusiveDayCount("2025-10-25", "2025-10-26")).toBe(2);
  });

  it("handles early years 0001..0099 literally", () => {
    expect(inclusiveDayCount("0001-01-01", "0001-01-31")).toBe(31);
    expect(inclusiveDayCount("0099-01-01", "0099-01-31")).toBe(31);
    // 0099 non bissextile : du 01/01/0099 au 01/01/0100 = 366 jours inclus.
    expect(inclusiveDayCount("0099-01-01", "0100-01-01")).toBe(366);
  });
});
