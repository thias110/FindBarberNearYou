import { describe, expect, it } from "vitest";
import { timeOffCreateSchema } from "@findbarber/shared/validation";

function payload(overrides: Record<string, unknown> = {}) {
  return { startDate: "2026-06-01", endDate: "2026-06-01", ...overrides };
}

describe("timeOffCreateSchema", () => {
  it("accepts a single day", () => {
    const parsed = timeOffCreateSchema.safeParse(
      payload({ startDate: "2026-06-15", endDate: "2026-06-15" }),
    );
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.reason).toBeNull();
    }
  });

  it("accepts a multi-day period with an optional reason", () => {
    const parsed = timeOffCreateSchema.safeParse(
      payload({
        startDate: "2026-07-01",
        endDate: "2026-07-15",
        reason: "  Congés d'été  ",
      }),
    );
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.reason).toBe("Congés d'été");
    }
  });

  it("normalises an empty or whitespace-only reason to null", () => {
    for (const reason of ["", "   "]) {
      const parsed = timeOffCreateSchema.safeParse(payload({ reason }));
      expect(parsed.success).toBe(true);
      if (parsed.success) expect(parsed.data.reason).toBeNull();
    }
  });

  it("accepts an explicit null reason", () => {
    const parsed = timeOffCreateSchema.safeParse(payload({ reason: null }));
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.reason).toBeNull();
  });

  it("accepts a leap day", () => {
    expect(
      timeOffCreateSchema.safeParse(
        payload({ startDate: "2024-02-29", endDate: "2024-02-29" }),
      ).success,
    ).toBe(true);
  });

  it("rejects invalid or impossible dates", () => {
    const cases = [
      { startDate: "2026-02-30", endDate: "2026-03-01" },
      { startDate: "2026-02-29", endDate: "2026-03-01" },
      { startDate: "2026-13-01", endDate: "2026-13-02" },
      { startDate: "2026-1-1", endDate: "2026-01-02" },
      { startDate: "not-a-date", endDate: "2026-01-02" },
      { startDate: "2026-01-01", endDate: "2026-00-10" },
    ];
    for (const value of cases) {
      expect(timeOffCreateSchema.safeParse(payload(value)).success).toBe(false);
    }
  });

  it("rejects year 0000 and accepts early years 0001..0099", () => {
    expect(
      timeOffCreateSchema.safeParse(
        payload({ startDate: "0000-01-01", endDate: "0000-01-02" }),
      ).success,
    ).toBe(false);
    expect(
      timeOffCreateSchema.safeParse(
        payload({ startDate: "0000-02-29", endDate: "0000-02-29" }),
      ).success,
    ).toBe(false);
    expect(
      timeOffCreateSchema.safeParse(
        payload({ startDate: "0001-01-01", endDate: "0001-01-01" }),
      ).success,
    ).toBe(true);
    expect(
      timeOffCreateSchema.safeParse(
        payload({ startDate: "0099-01-01", endDate: "0099-01-31" }),
      ).success,
    ).toBe(true);
  });

  it("rejects a start date after the end date", () => {
    const parsed = timeOffCreateSchema.safeParse(
      payload({ startDate: "2026-06-10", endDate: "2026-06-09" }),
    );
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues.map((issue) => issue.path)).toContainEqual([
        "endDate",
      ]);
    }
  });

  it("accepts exactly 366 days and rejects 367 days", () => {
    // 2026 n'est pas bissextile : 1er janvier 2026 → 1er janvier 2027 = 366 jours.
    expect(
      timeOffCreateSchema.safeParse(
        payload({ startDate: "2026-01-01", endDate: "2027-01-01" }),
      ).success,
    ).toBe(true);
    expect(
      timeOffCreateSchema.safeParse(
        payload({ startDate: "2026-01-01", endDate: "2027-01-02" }),
      ).success,
    ).toBe(false);
  });

  it("rejects a reason longer than 500 characters", () => {
    expect(
      timeOffCreateSchema.safeParse(payload({ reason: "a".repeat(500) })).success,
    ).toBe(true);
    expect(
      timeOffCreateSchema.safeParse(payload({ reason: "a".repeat(501) })).success,
    ).toBe(false);
  });

  it("rejects unknown keys at the root", () => {
    expect(
      timeOffCreateSchema.safeParse(payload({ barberProfileId: "evil" })).success,
    ).toBe(false);
    expect(timeOffCreateSchema.safeParse(payload({ id: "forged" })).success).toBe(
      false,
    );
    expect(timeOffCreateSchema.safeParse({}).success).toBe(false);
  });

  it("rejects non-string dates", () => {
    expect(
      timeOffCreateSchema.safeParse(payload({ startDate: 20260601 })).success,
    ).toBe(false);
    expect(
      timeOffCreateSchema.safeParse(payload({ endDate: null })).success,
    ).toBe(false);
  });
});
