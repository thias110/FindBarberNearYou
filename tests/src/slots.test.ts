import { describe, expect, it } from "vitest";
import { computeBookingSlots } from "@findbarber/shared/booking";
import {
  weekdayFromCalendarDate,
} from "@findbarber/shared/dates";
import {
  utcToZonedParts,
  zonedTimeToUtc,
} from "@findbarber/shared/timezones";

describe("weekdayFromCalendarDate", () => {
  it("returns ISO weekdays (1 = lundi … 7 = dimanche)", () => {
    expect(weekdayFromCalendarDate("2026-06-01")).toBe(1); // lundi
    expect(weekdayFromCalendarDate("2026-06-07")).toBe(7); // dimanche
    expect(weekdayFromCalendarDate("2024-02-29")).toBe(4); // jeudi
  });
});

describe("zonedTimeToUtc / utcToZonedParts", () => {
  it("converts a wall-clock time in UTC", () => {
    const date = zonedTimeToUtc("2026-06-01", 540, "UTC");
    expect(date?.toISOString()).toBe("2026-06-01T09:00:00.000Z");
  });

  it("applies the standard and summer offsets of Europe/Zurich", () => {
    expect(zonedTimeToUtc("2026-01-15", 540, "Europe/Zurich")?.toISOString()).toBe(
      "2026-01-15T08:00:00.000Z",
    );
    expect(zonedTimeToUtc("2026-07-15", 540, "Europe/Zurich")?.toISOString()).toBe(
      "2026-07-15T07:00:00.000Z",
    );
  });

  it("rejects a non-existent wall-clock time (spring forward)", () => {
    // Europe/Zurich : le 29/03/2026, 02:00 → 03:00. 02:30 n'existe pas.
    expect(zonedTimeToUtc("2026-03-29", 150, "Europe/Zurich")).toBeNull();
    // 03:30 existe (UTC+2).
    expect(zonedTimeToUtc("2026-03-29", 210, "Europe/Zurich")?.toISOString()).toBe(
      "2026-03-29T01:30:00.000Z",
    );
  });

  it("handles the ambiguous hour (fall back) deterministically", () => {
    const date = zonedTimeToUtc("2026-10-25", 150, "Europe/Zurich");
    expect(date).not.toBeNull();
    const parts = utcToZonedParts(date as Date, "Europe/Zurich");
    expect(parts.date).toBe("2026-10-25");
    expect(parts.minuteOfDay).toBe(150);
  });

  it("returns null for an invalid timezone", () => {
    expect(zonedTimeToUtc("2026-06-01", 540, "Mars/Olympus")).toBeNull();
  });

  it("decomposes an instant into zoned parts", () => {
    expect(
      utcToZonedParts(new Date("2026-01-15T08:00:00Z"), "Europe/Zurich"),
    ).toEqual({ date: "2026-01-15", minuteOfDay: 540 });
  });
});

const BASE = {
  timezone: "UTC",
  durationMinutes: 30,
  workingHours: [{ weekday: 1 as const, startMinute: 540, endMinute: 1080 }],
  timeOff: [],
  busy: [],
  now: new Date("2026-05-01T00:00:00Z"),
  leadTimeMinutes: 0,
  horizonDays: 366,
};

describe("computeBookingSlots", () => {
  it("generates non-overlapping slots on the service-duration grid", () => {
    const slots = computeBookingSlots({ ...BASE, date: "2026-06-01" });
    expect(slots).toHaveLength(18); // (1080 - 540) / 30
    expect(slots[0].startMinute).toBe(540);
    expect(slots[0].startAt).toBe("2026-06-01T09:00:00.000Z");
    expect(slots[0].endAt).toBe("2026-06-01T09:30:00.000Z");
    expect(slots[slots.length - 1].startMinute).toBe(1050);
  });

  it("follows the service duration (no fixed 15-minute grid)", () => {
    const slots = computeBookingSlots({
      ...BASE,
      date: "2026-06-01",
      durationMinutes: 45,
      workingHours: [{ weekday: 1 as const, startMinute: 540, endMinute: 720 }],
    });
    expect(slots.map((slot) => slot.startMinute)).toEqual([540, 585, 630, 675]);
  });

  it("returns nothing on a whole-day time off", () => {
    expect(
      computeBookingSlots({
        ...BASE,
        date: "2026-06-01",
        timeOff: [{ startDate: "2026-05-30", endDate: "2026-06-02" }],
      }),
    ).toEqual([]);
  });

  it("removes slots overlapping an active booking", () => {
    const slots = computeBookingSlots({
      ...BASE,
      date: "2026-06-01",
      busy: [
        {
          startAt: new Date("2026-06-01T09:15:00Z"),
          endAt: new Date("2026-06-01T09:45:00Z"),
        },
      ],
    });
    // 09:00 (overlap) et 09:30 (overlap) retirés ; 10:00 conservé.
    expect(slots.map((slot) => slot.startMinute)).not.toContain(540);
    expect(slots.map((slot) => slot.startMinute)).not.toContain(570);
    expect(slots.map((slot) => slot.startMinute)).toContain(600);
  });

  it("applies the lead time and the horizon", () => {
    const late = computeBookingSlots({
      ...BASE,
      date: "2026-06-01",
      now: new Date("2026-06-01T08:50:00Z"),
      leadTimeMinutes: 30,
    });
    expect(late[0].startAt).toBe("2026-06-01T09:30:00.000Z");

    const beyond = computeBookingSlots({
      ...BASE,
      date: "2026-06-01",
      now: new Date("2026-03-01T00:00:00Z"),
      horizonDays: 60,
    });
    expect(beyond).toEqual([]);
  });

  it("skips the non-existent local slot on the DST spring forward", () => {
    const slots = computeBookingSlots({
      ...BASE,
      timezone: "Europe/Zurich",
      date: "2026-03-29",
      durationMinutes: 60,
      now: new Date("2026-03-01T00:00:00Z"),
      workingHours: [{ weekday: 7 as const, startMinute: 0, endMinute: 1440 }],
    });
    expect(slots.map((slot) => slot.startMinute)).not.toContain(120); // 02:00 inexistant
    expect(slots.map((slot) => slot.startMinute)).toContain(60);
    expect(slots.map((slot) => slot.startMinute)).toContain(180);
  });

  it("returns nothing for an invalid date or no matching interval", () => {
    expect(computeBookingSlots({ ...BASE, date: "2026-02-30" })).toEqual([]);
    expect(computeBookingSlots({ ...BASE, date: "2026-06-02" })).toEqual([]); // mardi sans plage
  });
});
