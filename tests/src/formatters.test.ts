import { describe, expect, it } from "vitest";
import {
  formatCurrency,
  formatDuration,
  minorToInputValue,
  parsePriceToMinor,
} from "../../client/src/lib/formatters";

describe("parsePriceToMinor", () => {
  it("accepts a dot decimal", () => {
    expect(parsePriceToMinor("25.50")).toBe(2550);
  });

  it("accepts a comma decimal", () => {
    expect(parsePriceToMinor("25,50")).toBe(2550);
  });

  it("accepts a single decimal digit", () => {
    expect(parsePriceToMinor("25.5")).toBe(2550);
  });

  it("accepts a whole number", () => {
    expect(parsePriceToMinor("25")).toBe(2500);
  });

  it("accepts zero", () => {
    expect(parsePriceToMinor("0")).toBe(0);
  });

  it("preserves leading zeros of the amount", () => {
    expect(parsePriceToMinor("0.05")).toBe(5);
  });

  it("rejects more than two decimals", () => {
    expect(parsePriceToMinor("25.505")).toBeNull();
  });

  it("rejects negative values", () => {
    expect(parsePriceToMinor("-25")).toBeNull();
  });

  it("rejects non-numeric input", () => {
    expect(parsePriceToMinor("abc")).toBeNull();
    expect(parsePriceToMinor("")).toBeNull();
  });
});

describe("minorToInputValue", () => {
  it("formats minor units without float", () => {
    expect(minorToInputValue(2550)).toBe("25.50");
    expect(minorToInputValue(5)).toBe("0.05");
    expect(minorToInputValue(0)).toBe("0.00");
    expect(minorToInputValue(1000000)).toBe("10000.00");
  });
});

describe("formatCurrency", () => {
  it("shows CHF with two decimals and the currency code", () => {
    const result = formatCurrency(2550, "CHF");
    expect(result).toContain("25.50");
    expect(result).toContain("CHF");
  });

  it("shows EUR with two decimals and the currency code", () => {
    const result = formatCurrency(2550, "EUR");
    expect(result).toContain("25.50");
    expect(result).toContain("EUR");
  });

  it("shows USD with two decimals and the currency code", () => {
    const result = formatCurrency(2550, "USD");
    expect(result).toContain("25.50");
    expect(result).toContain("USD");
  });

  it("does not force CHF on other currencies", () => {
    expect(formatCurrency(1000, "USD")).not.toContain("CHF");
  });
});

describe("formatDuration", () => {
  it("formats minutes and hours", () => {
    expect(formatDuration(30)).toBe("30 min");
    expect(formatDuration(60)).toBe("1 h");
    expect(formatDuration(90)).toBe("1 h 30");
  });
});
