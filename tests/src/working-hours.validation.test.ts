import { describe, expect, it } from "vitest";
import { workingHoursSchema } from "@findbarber/shared/validation";

function payload(
  intervals: { weekday: number; startMinute: number; endMinute: number }[],
) {
  return { intervals };
}

describe("workingHoursSchema", () => {
  it("accepts a full week with several intervals per day", () => {
    const parsed = workingHoursSchema.safeParse(
      payload([
        { weekday: 1, startMinute: 540, endMinute: 720 },
        { weekday: 1, startMinute: 840, endMinute: 1080 },
        { weekday: 3, startMinute: 0, endMinute: 720 },
        { weekday: 7, startMinute: 600, endMinute: 1140 },
      ]),
    );
    expect(parsed.success).toBe(true);
  });

  it("accepts an empty planning (suppression)", () => {
    expect(workingHoursSchema.safeParse(payload([])).success).toBe(true);
  });

  it("accepts adjacent intervals (pauses implicites)", () => {
    const parsed = workingHoursSchema.safeParse(
      payload([
        { weekday: 1, startMinute: 540, endMinute: 720 },
        { weekday: 1, startMinute: 720, endMinute: 840 },
      ]),
    );
    expect(parsed.success).toBe(true);
  });

  it("accepts the same times on different days", () => {
    const parsed = workingHoursSchema.safeParse(
      payload([
        { weekday: 2, startMinute: 540, endMinute: 720 },
        { weekday: 5, startMinute: 540, endMinute: 720 },
      ]),
    );
    expect(parsed.success).toBe(true);
  });

  it("accepts boundaries: start 0 and end 1440 (24:00)", () => {
    const parsed = workingHoursSchema.safeParse(
      payload([
        { weekday: 6, startMinute: 0, endMinute: 1440 },
        { weekday: 1, startMinute: 1439, endMinute: 1440 },
      ]),
    );
    expect(parsed.success).toBe(true);
  });

  it("rejects a missing intervals array", () => {
    expect(workingHoursSchema.safeParse({}).success).toBe(false);
    expect(workingHoursSchema.safeParse({ intervals: "x" }).success).toBe(false);
  });

  it("rejects unknown keys at both levels", () => {
    expect(
      workingHoursSchema.safeParse({ intervals: [], barberProfileId: "evil" })
        .success,
    ).toBe(false);
    expect(
      workingHoursSchema.safeParse(
        payload([
          {
            weekday: 1,
            startMinute: 540,
            endMinute: 720,
            id: "forged",
          } as unknown as { weekday: number; startMinute: number; endMinute: number },
        ]),
      ).success,
    ).toBe(false);
  });

  it("rejects out-of-range weekdays", () => {
    for (const weekday of [0, 8, -1, 1.5, "1"]) {
      expect(
        workingHoursSchema.safeParse(
          payload([
            {
              weekday,
              startMinute: 540,
              endMinute: 720,
            } as unknown as { weekday: number; startMinute: number; endMinute: number },
          ]),
        ).success,
      ).toBe(false);
    }
  });

  it("rejects out-of-range minutes", () => {
    const cases = [
      { startMinute: -1, endMinute: 720 },
      { startMinute: 1440, endMinute: 1440 },
      { startMinute: 540, endMinute: 0 },
      { startMinute: 540, endMinute: 1441 },
      { startMinute: 540.5, endMinute: 720 },
      { startMinute: 540, endMinute: 720.5 },
    ];
    for (const value of cases) {
      expect(
        workingHoursSchema.safeParse(payload([{ weekday: 1, ...value }])).success,
      ).toBe(false);
    }
  });

  it("rejects start >= end (no midnight crossing)", () => {
    expect(
      workingHoursSchema.safeParse(
        payload([{ weekday: 1, startMinute: 720, endMinute: 540 }]),
      ).success,
    ).toBe(false);
    expect(
      workingHoursSchema.safeParse(
        payload([{ weekday: 1, startMinute: 540, endMinute: 540 }]),
      ).success,
    ).toBe(false);
  });

  it("rejects overlapping intervals on the same day", () => {
    // Chevauchant
    expect(
      workingHoursSchema.safeParse(
        payload([
          { weekday: 1, startMinute: 540, endMinute: 720 },
          { weekday: 1, startMinute: 600, endMinute: 840 },
        ]),
      ).success,
    ).toBe(false);
    // Imbriqué
    expect(
      workingHoursSchema.safeParse(
        payload([
          { weekday: 1, startMinute: 540, endMinute: 1080 },
          { weekday: 1, startMinute: 600, endMinute: 900 },
        ]),
      ).success,
    ).toBe(false);
    // Doublon exact
    expect(
      workingHoursSchema.safeParse(
        payload([
          { weekday: 1, startMinute: 540, endMinute: 720 },
          { weekday: 1, startMinute: 540, endMinute: 720 },
        ]),
      ).success,
    ).toBe(false);
  });

  it("attaches overlap issues to the original payload index", () => {
    const parsed = workingHoursSchema.safeParse(
      payload([
        { weekday: 1, startMinute: 540, endMinute: 720 },
        { weekday: 2, startMinute: 600, endMinute: 840 },
        { weekday: 1, startMinute: 600, endMinute: 840 }, // chevauche l'index 0
      ]),
    );
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      const paths = parsed.error.issues.map((issue) => issue.path);
      expect(paths).toContainEqual(["intervals", 2]);
      expect(paths).not.toContainEqual(["intervals", 0]);
    }
  });

  it("attaches the start < end issue to the interval index and field", () => {
    const parsed = workingHoursSchema.safeParse(
      payload([
        { weekday: 1, startMinute: 540, endMinute: 720 },
        { weekday: 1, startMinute: 720, endMinute: 540 },
      ]),
    );
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      const paths = parsed.error.issues.map((issue) => issue.path);
      expect(paths).toContainEqual(["intervals", 1, "endMinute"]);
    }
  });

  it("attaches per-day cap issues to the overflowing indices", () => {
    const intervals = Array.from({ length: 7 }, (_, index) => ({
      weekday: 1,
      startMinute: 60 * index,
      endMinute: 60 * index + 30,
    }));
    const parsed = workingHoursSchema.safeParse(payload(intervals));
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      const paths = parsed.error.issues.map((issue) => issue.path);
      expect(paths).toContainEqual(["intervals", 6]);
      expect(paths).not.toContainEqual(["intervals", 5]);
    }
  });

  it("rejects more than the maximum intervals per day", () => {
    const intervals = Array.from({ length: 7 }, (_, index) => ({
      weekday: 1,
      startMinute: 60 * index,
      endMinute: 60 * index + 30,
    }));
    expect(workingHoursSchema.safeParse(payload(intervals)).success).toBe(false);
  });

  it("rejects more than the maximum total intervals", () => {
    const intervals: { weekday: number; startMinute: number; endMinute: number }[] = [];
    for (const weekday of [1, 2, 3, 4, 5, 6, 7]) {
      // 6 plages par jour = 42 (limite exacte), la 43e doit être refusée.
      for (let index = 0; index < 6; index++) {
        intervals.push({
          weekday,
          startMinute: 60 * index,
          endMinute: 60 * index + 30,
        });
      }
    }
    expect(intervals).toHaveLength(42);
    expect(workingHoursSchema.safeParse(payload(intervals)).success).toBe(true);
    intervals.push({ weekday: 1, startMinute: 360, endMinute: 390 });
    expect(workingHoursSchema.safeParse(payload(intervals)).success).toBe(false);
  });
});
