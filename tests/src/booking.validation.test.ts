import { describe, expect, it } from "vitest";
import {
  bookingCreateSchema,
  bookingSlotsQuerySchema,
} from "@findbarber/shared/validation";

const createBase = {
  barberId: "barber-1",
  serviceId: "service-1",
  date: "2026-06-01",
  startMinute: 570,
  place: "SALON",
};

function create(overrides: Record<string, unknown> = {}) {
  return bookingCreateSchema.safeParse({ ...createBase, ...overrides });
}

describe("bookingCreateSchema", () => {
  it("accepts a valid booking payload", () => {
    const parsed = create();
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data).toEqual(createBase);
    }
  });

  it("trims identifiers and rejects empty ones", () => {
    const parsed = create({ barberId: "  barber-1  " });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.barberId).toBe("barber-1");

    expect(create({ barberId: "" }).success).toBe(false);
    expect(create({ barberId: "   " }).success).toBe(false);
    expect(create({ serviceId: "" }).success).toBe(false);
  });

  it("rejects identifiers longer than 64 characters", () => {
    expect(create({ barberId: "x".repeat(65) }).success).toBe(false);
    expect(create({ serviceId: "x".repeat(65) }).success).toBe(false);
  });

  it("rejects missing fields", () => {
    for (const key of ["barberId", "serviceId", "date", "startMinute", "place"]) {
      const { [key]: _omitted, ...rest } = createBase;
      void _omitted;
      expect(bookingCreateSchema.safeParse(rest).success, key).toBe(false);
    }
  });

  it("rejects unknown fields (strict)", () => {
    expect(create({ startAt: "2026-06-01T09:30:00Z" }).success).toBe(false);
    expect(create({ priceMinor: 2500 }).success).toBe(false);
    expect(create({ durationMinutes: 30 }).success).toBe(false);
  });

  it("rejects invalid calendar dates", () => {
    expect(create({ date: "2026-02-30" }).success).toBe(false);
    expect(create({ date: "2026-13-01" }).success).toBe(false);
    expect(create({ date: "01-06-2026" }).success).toBe(false);
    expect(create({ date: "2026-6-1" }).success).toBe(false);
    expect(create({ date: "lundi" }).success).toBe(false);
  });

  it("bounds startMinute to 0..1439 integers", () => {
    expect(create({ startMinute: 0 }).success).toBe(true);
    expect(create({ startMinute: 1439 }).success).toBe(true);
    for (const value of [-1, 1440, 1.5, "570", NaN]) {
      expect(create({ startMinute: value }).success, String(value)).toBe(false);
    }
  });

  it("rejects unknown place codes", () => {
    expect(create({ place: "HOME" }).success).toBe(false);
    expect(create({ place: "salon" }).success).toBe(false);
    expect(create({ place: "" }).success).toBe(false);
  });
});

describe("bookingSlotsQuerySchema", () => {
  const base = { serviceId: "service-1", date: "2026-06-01", place: "AT_CLIENT" };

  function query(overrides: Record<string, unknown> = {}) {
    return bookingSlotsQuerySchema.safeParse({ ...base, ...overrides });
  }

  it("accepts a valid query", () => {
    const parsed = query();
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data).toEqual(base);
  });

  it("rejects missing or empty fields", () => {
    expect(query({ serviceId: "" }).success).toBe(false);
    for (const key of ["serviceId", "date", "place"]) {
      const { [key]: _omitted, ...rest } = base;
      void _omitted;
      expect(bookingSlotsQuerySchema.safeParse(rest).success, key).toBe(false);
    }
  });

  it("rejects unknown query parameters (strict)", () => {
    expect(query({ timezone: "Europe/Zurich" }).success).toBe(false);
    expect(query({ stepMinutes: 15 }).success).toBe(false);
  });

  it("rejects invalid dates and unknown places", () => {
    expect(query({ date: "2026-02-30" }).success).toBe(false);
    expect(query({ date: "2026-6-1" }).success).toBe(false);
    expect(query({ place: "HOME" }).success).toBe(false);
  });
});
