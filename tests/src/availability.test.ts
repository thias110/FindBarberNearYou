// Disponibilité affichée dans la recherche (lot N1) : calcul pur, horloge fixe.
import { describe, expect, it } from "vitest";
import type { Weekday } from "@findbarber/shared/constants";
import { summarizeAvailability } from "@findbarber/shared/booking";

const EVERY_DAY = ([1, 2, 3, 4, 5, 6, 7] as Weekday[]).map((weekday) => ({
  weekday,
  startMinute: 9 * 60,
  endMinute: 18 * 60,
}));

// Mercredi 14 octobre 2026, 08:00 à Zurich (06:00 UTC, heure d'été).
const NOW = new Date("2026-10-14T06:00:00.000Z");
const base = {
  timezone: "Europe/Zurich",
  durations: [30],
  workingHours: EVERY_DAY,
  timeOff: [],
  busy: [],
  now: NOW,
};

describe("summarizeAvailability", () => {
  it("donne le premier créneau du jour, à l'ouverture du salon", () => {
    expect(summarizeAvailability(base)).toEqual({
      nextAvailableAt: "2026-10-14T07:00:00.000Z", // 09:00 à Zurich
      availableToday: true,
    });
  });

  it("respecte le délai minimal de réservation (30 min)", () => {
    // 08:45 à Zurich : 09:00 est trop proche, le premier créneau est 09:30.
    const now = new Date("2026-10-14T06:45:00.000Z");
    expect(summarizeAvailability({ ...base, now }).nextAvailableAt).toBe(
      "2026-10-14T07:30:00.000Z",
    );
  });

  it("saute un créneau occupé", () => {
    const busy = [
      {
        startAt: new Date("2026-10-14T07:00:00.000Z"),
        endAt: new Date("2026-10-14T07:30:00.000Z"),
      },
    ];
    expect(summarizeAvailability({ ...base, busy }).nextAvailableAt).toBe(
      "2026-10-14T07:30:00.000Z",
    );
  });

  it("passe au lendemain quand la journée est pleine, sans « aujourd'hui »", () => {
    const busy = [
      {
        startAt: new Date("2026-10-14T07:00:00.000Z"),
        endAt: new Date("2026-10-14T16:00:00.000Z"),
      },
    ];
    expect(summarizeAvailability({ ...base, busy })).toEqual({
      nextAvailableAt: "2026-10-15T07:00:00.000Z",
      availableToday: false,
    });
  });

  it("tient compte des absences et des jours fermés", () => {
    const workingHours = EVERY_DAY.filter((h) => h.weekday === 1); // lundi seul
    const timeOff = [{ startDate: "2026-10-19", endDate: "2026-10-19" }];
    // Lundi 19 en congé : plus aucun lundi dans les 7 jours.
    expect(summarizeAvailability({ ...base, workingHours, timeOff })).toEqual({
      nextAvailableAt: null,
      availableToday: false,
    });
    expect(summarizeAvailability({ ...base, workingHours }).nextAvailableAt).toBe(
      "2026-10-19T07:00:00.000Z",
    );
  });

  it("ne regarde que 7 jours", () => {
    // Seul le mercredi est ouvert, et aujourd'hui (mercredi) est plein : le
    // mercredi suivant est le 8e jour, donc hors fenêtre.
    const workingHours = EVERY_DAY.filter((h) => h.weekday === 3);
    const busy = [
      {
        startAt: new Date("2026-10-14T07:00:00.000Z"),
        endAt: new Date("2026-10-14T16:00:00.000Z"),
      },
    ];
    expect(summarizeAvailability({ ...base, workingHours, busy }).nextAvailableAt).toBeNull();
  });

  it("prend la prestation qui offre le créneau le plus tôt", () => {
    // 60 min ne tient plus entre 09:00 et 10:00 occupé ; 30 min non plus avant
    // 10:00. Créneau de 09:30 libre pour 30 min seulement.
    const busy = [
      {
        startAt: new Date("2026-10-14T07:00:00.000Z"),
        endAt: new Date("2026-10-14T07:30:00.000Z"),
      },
    ];
    expect(
      summarizeAvailability({ ...base, durations: [60, 30], busy }).nextAvailableAt,
    ).toBe("2026-10-14T07:30:00.000Z");
  });

  it("sans prestation active ni horaires : aucune disponibilité", () => {
    const none = { nextAvailableAt: null, availableToday: false };
    expect(summarizeAvailability({ ...base, durations: [] })).toEqual(none);
    expect(summarizeAvailability({ ...base, workingHours: [] })).toEqual(none);
  });

  it("« aujourd'hui » suit le fuseau du salon, pas celui du serveur", () => {
    // 23:30 UTC le 14 = déjà le 15 à 13:30 à Kiritimati (UTC+14).
    const now = new Date("2026-10-14T23:30:00.000Z");
    const result = summarizeAvailability({ ...base, timezone: "Pacific/Kiritimati", now });
    expect(result.availableToday).toBe(true);
    // 14:00 locale le 15 = 00:00 UTC le 15.
    expect(result.nextAvailableAt).toBe("2026-10-15T00:00:00.000Z");
  });
});
