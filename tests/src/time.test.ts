import { describe, expect, it } from "vitest";
import {
  extractIntervalIndex,
  formatIntervalError,
  formatMinutes,
  formatMinutesRange,
  joinEndMinute,
  minutesToTimeValue,
  parseTimeToMinutes,
  splitEndMinute,
} from "../../client/src/lib/time";

describe("parseTimeToMinutes", () => {
  it("parses a valid time", () => {
    expect(parseTimeToMinutes("09:00")).toBe(540);
    expect(parseTimeToMinutes("00:00")).toBe(0);
    expect(parseTimeToMinutes("23:59")).toBe(1439);
    expect(parseTimeToMinutes("09:05")).toBe(545);
    expect(parseTimeToMinutes(" 14:30 ")).toBe(870);
  });

  it("rejects invalid inputs", () => {
    expect(parseTimeToMinutes("")).toBeNull();
    expect(parseTimeToMinutes("24:00")).toBeNull(); // jamais une valeur d'input
    expect(parseTimeToMinutes("9:00")).toBeNull();
    expect(parseTimeToMinutes("09:60")).toBeNull();
    expect(parseTimeToMinutes("9h00")).toBeNull();
    expect(parseTimeToMinutes("abc")).toBeNull();
    expect(parseTimeToMinutes("25:00")).toBeNull();
  });
});

describe("minutesToTimeValue", () => {
  it("formats a value for a time input", () => {
    expect(minutesToTimeValue(540)).toBe("09:00");
    expect(minutesToTimeValue(0)).toBe("00:00");
    expect(minutesToTimeValue(1439)).toBe("23:59");
    expect(minutesToTimeValue(545)).toBe("09:05");
  });

  it("never returns 24:00 for an input", () => {
    expect(minutesToTimeValue(1440)).toBeNull();
    expect(minutesToTimeValue(1441)).toBeNull();
    expect(minutesToTimeValue(-1)).toBeNull();
    expect(minutesToTimeValue(1.5)).toBeNull();
  });
});

describe("formatMinutes (display only)", () => {
  it("displays 24:00 for the end of day", () => {
    expect(formatMinutes(1440)).toBe("24:00");
    expect(formatMinutes(540)).toBe("09:00");
    expect(formatMinutes(0)).toBe("00:00");
  });

  it("throws on out-of-range values", () => {
    expect(() => formatMinutes(1441)).toThrow();
    expect(() => formatMinutes(-1)).toThrow();
    expect(() => formatMinutes(1.5)).toThrow();
  });
});

describe("formatMinutesRange", () => {
  it("renders a range", () => {
    expect(formatMinutesRange(540, 720)).toBe("09:00 – 12:00");
    expect(formatMinutesRange(1200, 1440)).toBe("20:00 – 24:00");
  });
});

describe("splitEndMinute / joinEndMinute (round-trip de la fin de journée)", () => {
  it("splits 1440 into the explicit end-of-day flag", () => {
    expect(splitEndMinute(1440)).toEqual({ endOfDay: true, timeValue: "" });
  });

  it("splits a regular time", () => {
    expect(splitEndMinute(1080)).toEqual({ endOfDay: false, timeValue: "18:00" });
  });

  it("rejoins the end-of-day flag into 1440", () => {
    expect(joinEndMinute(true, "")).toBe(1440);
  });

  it("rejoins a regular input", () => {
    expect(joinEndMinute(false, "18:00")).toBe(1080);
  });

  it("rejects an invalid regular input", () => {
    expect(joinEndMinute(false, "")).toBeNull();
    expect(joinEndMinute(false, "24:00")).toBeNull();
  });

  it("round-trips every representation", () => {
    for (const endMinute of [1, 60, 540, 1439, 1440]) {
      const { endOfDay, timeValue } = splitEndMinute(endMinute);
      expect(joinEndMinute(endOfDay, timeValue)).toBe(endMinute);
    }
  });
});

describe("extractIntervalIndex", () => {
  it("extracts the index from an interval path", () => {
    expect(extractIntervalIndex(["intervals", 2])).toBe(2);
    expect(extractIntervalIndex(["intervals", 0, "endMinute"])).toBe(0);
    expect(extractIntervalIndex(["body", "intervals", 4, "startMinute"])).toBe(4);
  });

  it("returns null when no interval index is present", () => {
    expect(extractIntervalIndex(["intervals"])).toBeNull();
    expect(extractIntervalIndex(["body"])).toBeNull();
    expect(extractIntervalIndex([])).toBeNull();
    expect(extractIntervalIndex(["intervals", "x"])).toBeNull();
  });
});

describe("formatIntervalError", () => {
  it("prefixes with the day label and interval number", () => {
    expect(
      formatIntervalError(2, 3, "heure de début invalide."),
    ).toBe("Mardi, plage 3 : heure de début invalide.");
    expect(
      formatIntervalError(7, 1, "plages qui se chevauchent."),
    ).toBe("Dimanche, plage 1 : plages qui se chevauchent.");
  });
});
