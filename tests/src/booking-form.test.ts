import { describe, expect, it } from "vitest";
import {
  addDays,
  hasErrors,
  toLocalISODate,
  validateBookingForm,
} from "../../client/src/lib/booking";

const baseForm = {
  serviceId: "service-1",
  place: "SALON" as const,
  date: "2026-06-01",
  startMinute: 540,
  clientAddress: "",
};

describe("validateBookingForm", () => {
  it("accepts a complete SALON booking", () => {
    expect(hasErrors(validateBookingForm(baseForm))).toBe(false);
  });

  it("requires a service, place, date and slot", () => {
    const errors = validateBookingForm({
      serviceId: "",
      place: "",
      date: "",
      startMinute: null,
      clientAddress: "",
    });
    expect(errors.serviceId).toBeTruthy();
    expect(errors.place).toBeTruthy();
    expect(errors.date).toBeTruthy();
    expect(errors.startMinute).toBeTruthy();
  });

  it("requires an address only for AT_CLIENT", () => {
    const missing = validateBookingForm({
      ...baseForm,
      place: "AT_CLIENT",
      clientAddress: "  ",
    });
    expect(missing.clientAddress).toBeTruthy();

    const provided = validateBookingForm({
      ...baseForm,
      place: "AT_CLIENT",
      clientAddress: "Rue du Client 1, Genève",
    });
    expect(provided.clientAddress).toBeUndefined();
  });

  it("does not require an address for SALON or AT_PROVIDER", () => {
    for (const place of ["SALON", "AT_PROVIDER"] as const) {
      const errors = validateBookingForm({ ...baseForm, place });
      expect(errors.clientAddress).toBeUndefined();
    }
  });
});

describe("toLocalISODate / addDays", () => {
  it("formats a local date as AAAA-MM-JJ", () => {
    expect(toLocalISODate(new Date(2026, 0, 1))).toBe("2026-01-01");
  });

  it("adds calendar days without mutating the input", () => {
    const start = new Date(2026, 0, 1);
    const next = addDays(start, 1);
    expect(toLocalISODate(next)).toBe("2026-01-02");
    expect(toLocalISODate(start)).toBe("2026-01-01");
  });

  it("handles month boundaries", () => {
    expect(toLocalISODate(addDays(new Date(2026, 0, 31), 1))).toBe(
      "2026-02-01",
    );
  });
});
