// Machine à états, échéance des demandes PENDING et créneaux aux changements
// d'heure (lot 4 rouvert). Tests purs, sans base.
import { describe, expect, it } from "vitest";
import {
  BOOKING_TRANSITIONS,
  NO_SHOW_WINDOW_HOURS,
  canMarkNoShow,
  canTransitionBooking,
  computeBookingSlots,
  effectiveBookingStatus,
  isPendingBookingExpired,
  isTerminalBookingStatus,
  pendingBookingExpiresAt,
  type BookingActor,
} from "@findbarber/shared/booking";
import {
  BOOKING_STATUSES,
  type BookingStatus,
} from "@findbarber/shared/constants";

const ACTORS: BookingActor[] = ["CLIENT", "BARBER", "ADMIN", "SYSTEM"];

// Table attendue, écrite indépendamment de l'implémentation.
const ALLOWED = new Set([
  "PENDING>CONFIRMED:BARBER",
  "PENDING>DECLINED:BARBER",
  "PENDING>CANCELLED:CLIENT",
  "PENDING>CANCELLED:BARBER",
  "PENDING>CANCELLED:ADMIN",
  "PENDING>EXPIRED:SYSTEM",
  "CONFIRMED>COMPLETED:BARBER",
  "CONFIRMED>NO_SHOW:BARBER",
  "CONFIRMED>CANCELLED:CLIENT",
  "CONFIRMED>CANCELLED:BARBER",
  "CONFIRMED>CANCELLED:ADMIN",
]);

describe("machine à états des réservations", () => {
  it("n'autorise que les transitions de la table, pour chaque rôle", () => {
    for (const from of BOOKING_STATUSES) {
      for (const to of BOOKING_STATUSES) {
        for (const actor of ACTORS) {
          expect(
            canTransitionBooking(from, to, actor),
            `${from} → ${to} par ${actor}`,
          ).toBe(ALLOWED.has(`${from}>${to}:${actor}`));
        }
      }
    }
  });

  it("rend terminaux annulée, refusée, expirée, terminée et absence", () => {
    const terminal: BookingStatus[] = [
      "CANCELLED",
      "DECLINED",
      "EXPIRED",
      "COMPLETED",
      "NO_SHOW",
    ];
    for (const status of terminal) {
      expect(isTerminalBookingStatus(status)).toBe(true);
      expect(BOOKING_TRANSITIONS[status]).toEqual({});
    }
    expect(isTerminalBookingStatus("PENDING")).toBe(false);
    expect(isTerminalBookingStatus("CONFIRMED")).toBe(false);
  });

  it("interdit explicitement annulée → confirmée, quel que soit le rôle", () => {
    for (const actor of ACTORS) {
      expect(canTransitionBooking("CANCELLED", "CONFIRMED", actor)).toBe(false);
    }
  });
});

describe("fenêtre de marquage d'absence (lot N8)", () => {
  const start = new Date("2026-10-14T10:00:00.000Z");

  it("fixe la fenêtre à 48 h", () => {
    expect(NO_SHOW_WINDOW_HOURS).toBe(48);
  });

  it("refuse avant le début, accepte dès l'instant du début", () => {
    expect(canMarkNoShow(start, new Date("2026-10-14T09:59:59.999Z"))).toBe(false);
    expect(canMarkNoShow(start, new Date("2026-10-14T10:00:00.000Z"))).toBe(true);
  });

  it("accepte jusqu'à 48 h incluses, refuse ensuite", () => {
    expect(canMarkNoShow(start, new Date("2026-10-16T10:00:00.000Z"))).toBe(true);
    expect(canMarkNoShow(start, new Date("2026-10-16T10:00:00.001Z"))).toBe(false);
  });

  it("accepte une date de début en chaîne ISO", () => {
    expect(
      canMarkNoShow("2026-10-14T10:00:00.000Z", new Date("2026-10-14T12:00:00.000Z")),
    ).toBe(true);
  });

  it("refuse une date de début illisible", () => {
    expect(canMarkNoShow("pas-une-date", new Date("2026-10-14T12:00:00.000Z"))).toBe(false);
  });
});

describe("échéance des demandes PENDING", () => {
  const createdAt = new Date("2026-06-01T10:00:00Z");
  const farStart = new Date("2026-06-10T10:00:00Z");

  it("expire 24 h après la création", () => {
    expect(pendingBookingExpiresAt(createdAt, farStart).toISOString()).toBe(
      "2026-06-02T10:00:00.000Z",
    );
    const booking = { status: "PENDING" as const, createdAt, startAt: farStart };
    expect(
      isPendingBookingExpired(booking, new Date("2026-06-02T09:59:00Z")),
    ).toBe(false);
    expect(
      isPendingBookingExpired(booking, new Date("2026-06-02T10:00:00Z")),
    ).toBe(true);
  });

  it("expire au début du rendez-vous s'il arrive avant 24 h", () => {
    const soon = new Date("2026-06-01T15:00:00Z");
    expect(pendingBookingExpiresAt(createdAt, soon).toISOString()).toBe(
      "2026-06-01T15:00:00.000Z",
    );
  });

  it("ne touche que les PENDING", () => {
    const late = new Date("2026-06-05T00:00:00Z");
    expect(
      effectiveBookingStatus(
        { status: "CONFIRMED", createdAt, startAt: farStart },
        late,
      ),
    ).toBe("CONFIRMED");
    expect(
      effectiveBookingStatus(
        { status: "PENDING", createdAt, startAt: farStart },
        late,
      ),
    ).toBe("EXPIRED");
  });
});

describe("créneaux aux changements d'heure (Europe/Zurich)", () => {
  const BASE = {
    timezone: "Europe/Zurich",
    timeOff: [],
    busy: [],
    now: new Date("2026-01-01T00:00:00Z"),
    leadTimeMinutes: 0,
    horizonDays: 800,
  };

  it("passage à l'heure d'été : aucun créneau ne finit après la fin réelle de la plage", () => {
    // Plage 00:30–03:00. 01:30 + 60 min finit réellement à 03:30 (l'heure
    // 02:00–03:00 n'existe pas) : ce créneau dépasserait la plage.
    const slots = computeBookingSlots({
      ...BASE,
      date: "2027-03-28",
      durationMinutes: 60,
      workingHours: [{ weekday: 7, startMinute: 30, endMinute: 180 }],
    });
    expect(slots.map((slot) => slot.startMinute)).toEqual([30]);
    expect(slots[0].startAt).toBe("2027-03-27T23:30:00.000Z");
  });

  it("passage à l'heure d'été : offset +1 avant, +2 après", () => {
    const slots = computeBookingSlots({
      ...BASE,
      date: "2027-03-28",
      durationMinutes: 60,
      workingHours: [{ weekday: 7, startMinute: 0, endMinute: 600 }],
    });
    const byMinute = new Map(slots.map((s) => [s.startMinute, s.startAt]));
    expect(byMinute.get(60)).toBe("2027-03-28T00:00:00.000Z"); // 01:00 CET
    expect(byMinute.has(120)).toBe(false); // 02:00 n'existe pas
    expect(byMinute.get(180)).toBe("2027-03-28T01:00:00.000Z"); // 03:00 CEST
    expect(byMinute.get(540)).toBe("2027-03-28T07:00:00.000Z"); // 09:00 CEST
  });

  it("passage à l'heure d'hiver : créneaux sans chevauchement réel sur l'heure répétée", () => {
    const slots = computeBookingSlots({
      ...BASE,
      date: "2026-10-25",
      durationMinutes: 60,
      workingHours: [{ weekday: 7, startMinute: 60, endMinute: 600 }],
    });
    const byMinute = new Map(slots.map((s) => [s.startMinute, s]));
    expect(byMinute.get(60)?.startAt).toBe("2026-10-24T23:00:00.000Z"); // 01:00 CEST
    expect(byMinute.get(180)?.startAt).toBe("2026-10-25T02:00:00.000Z"); // 03:00 CET
    expect(byMinute.get(540)?.startAt).toBe("2026-10-25T08:00:00.000Z"); // 09:00 CET
    for (let i = 1; i < slots.length; i += 1) {
      expect(Date.parse(slots[i].startAt)).toBeGreaterThanOrEqual(
        Date.parse(slots[i - 1].endAt),
      );
    }
  });
});
