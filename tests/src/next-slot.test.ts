// Libellé du prochain créneau (lot N1) : jour relatif et heure, horloge fixe.
import { describe, expect, it } from "vitest";
import { describeNextSlot } from "../../client/src/lib/nextSlot";

describe("describeNextSlot", () => {
  const now = new Date(2026, 9, 14, 8, 0); // mercredi 14 octobre, 08:00 local

  it("aujourd'hui", () => {
    const slot = new Date(2026, 9, 14, 14, 30).toISOString();
    expect(describeNextSlot(slot, now, "fr-CH")).toMatchObject({
      day: "today",
      time: "14:30",
    });
  });

  it("demain, y compris en fin de mois", () => {
    const slot = new Date(2026, 9, 15, 9, 0).toISOString();
    expect(describeNextSlot(slot, now, "fr-CH").day).toBe("tomorrow");
    const endOfMonth = new Date(2026, 9, 31, 20, 0);
    const firstOfNext = new Date(2026, 10, 1, 9, 0).toISOString();
    expect(describeNextSlot(firstOfNext, endOfMonth, "fr-CH").day).toBe("tomorrow");
  });

  it("plus tard : nom du jour dans la langue choisie", () => {
    const slot = new Date(2026, 9, 17, 10, 0).toISOString(); // samedi
    expect(describeNextSlot(slot, now, "fr-CH")).toMatchObject({
      day: "later",
      weekday: "samedi",
      time: "10:00",
    });
    expect(describeNextSlot(slot, now, "en-GB").weekday).toBe("Saturday");
  });
});
