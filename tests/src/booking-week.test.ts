import { describe, expect, it } from "vitest";
import {
  addCivilDays,
  canGoToNextWeek,
  canGoToPreviousWeek,
  diffCivilDays,
  isBookableDate,
  maxBookableDate,
  weekDates,
  weekRequestDays,
  weekStart,
} from "../../client/src/lib/bookingWeek";

const TODAY = "2026-10-19";
const HORIZON = 60;

describe("addCivilDays / diffCivilDays", () => {
  it("passe le mois et l'année", () => {
    expect(addCivilDays("2026-10-30", 3)).toBe("2026-11-02");
    expect(addCivilDays("2026-12-30", 3)).toBe("2027-01-02");
    expect(addCivilDays("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("ne dérive pas au changement d'heure (29 mars et 25 octobre 2026)", () => {
    expect(addCivilDays("2026-03-28", 2)).toBe("2026-03-30");
    expect(addCivilDays("2026-10-24", 2)).toBe("2026-10-26");
    expect(diffCivilDays("2026-03-28", "2026-03-30")).toBe(2);
    expect(diffCivilDays("2026-10-24", "2026-10-26")).toBe(2);
  });

  it("compte les jours entre deux dates", () => {
    expect(diffCivilDays(TODAY, TODAY)).toBe(0);
    expect(diffCivilDays(TODAY, "2026-10-26")).toBe(7);
    expect(diffCivilDays("2026-10-26", TODAY)).toBe(-7);
  });

  it("refuse une date invalide", () => {
    expect(() => addCivilDays("19/10/2026", 1)).toThrow();
  });
});

describe("semaines", () => {
  it("la semaine 0 commence aujourd'hui, les suivantes de 7 en 7", () => {
    expect(weekStart(TODAY, 0)).toBe(TODAY);
    expect(weekStart(TODAY, 1)).toBe("2026-10-26");
    expect(weekStart(TODAY, 2)).toBe("2026-11-02");
  });

  it("liste 7 jours consécutifs", () => {
    const days = weekDates(TODAY);
    expect(days).toHaveLength(7);
    expect(days[0]).toBe(TODAY);
    expect(days[6]).toBe("2026-10-25");
  });

  it("l'horizon est inclus", () => {
    expect(maxBookableDate(TODAY, HORIZON)).toBe("2026-12-18");
    expect(isBookableDate("2026-12-18", TODAY, HORIZON)).toBe(true);
    expect(isBookableDate("2026-12-19", TODAY, HORIZON)).toBe(false);
    expect(isBookableDate("2026-10-18", TODAY, HORIZON)).toBe(false);
    expect(isBookableDate(TODAY, TODAY, HORIZON)).toBe(true);
  });
});

describe("bornes de navigation", () => {
  it("la flèche précédente est inactive sur la semaine en cours", () => {
    expect(canGoToPreviousWeek(0)).toBe(false);
    expect(canGoToPreviousWeek(1)).toBe(true);
  });

  it("demande 7 jours, puis tronque la dernière semaine à l'horizon", () => {
    expect(weekRequestDays(TODAY, 0, HORIZON)).toBe(7);
    // Semaine 8 : du jour 56 au jour 60 inclus = 5 jours.
    expect(weekRequestDays(TODAY, 8, HORIZON)).toBe(5);
    expect(weekRequestDays(TODAY, 9, HORIZON)).toBe(0);
  });

  it("la flèche suivante s'arrête à la dernière semaine de l'horizon", () => {
    expect(canGoToNextWeek(TODAY, 0, HORIZON)).toBe(true);
    expect(canGoToNextWeek(TODAY, 7, HORIZON)).toBe(true);
    expect(canGoToNextWeek(TODAY, 8, HORIZON)).toBe(false);
  });

  it("gère un horizon multiple de 7 (la dernière semaine n'a qu'un jour)", () => {
    expect(weekRequestDays(TODAY, 8, 56)).toBe(1);
    expect(canGoToNextWeek(TODAY, 7, 56)).toBe(true);
    expect(canGoToNextWeek(TODAY, 8, 56)).toBe(false);
  });
});
