import { describe, expect, it } from "vitest";
import { barberSearchQuerySchema } from "@findbarber/shared/validation";
import { escapeLikePattern } from "../../server/src/lib/like";

describe("escapeLikePattern", () => {
  it("escapes %, _ and backslash", () => {
    expect(escapeLikePattern("a%b_c\\d")).toBe("a\\%b\\_c\\\\d");
  });

  it("leaves plain text untouched", () => {
    expect(escapeLikePattern("barbier")).toBe("barbier");
  });
});

describe("barberSearchQuerySchema", () => {
  it("applies defaults when no params are provided", () => {
    const parsed = barberSearchQuerySchema.safeParse({});
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.page).toBe(1);
      expect(parsed.data.pageSize).toBe(12);
      expect(parsed.data.q).toBeUndefined();
      expect(parsed.data.city).toBeUndefined();
    }
  });

  it("trims textual filters and ignores empty strings", () => {
    const parsed = barberSearchQuerySchema.safeParse({
      q: "  ",
      city: "",
      countryCode: " ",
      audience: " ",
      technique: "",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.q).toBeUndefined();
      expect(parsed.data.city).toBeUndefined();
      expect(parsed.data.countryCode).toBeUndefined();
      expect(parsed.data.audience).toBeUndefined();
      expect(parsed.data.technique).toBeUndefined();
    }
  });

  it("normalizes filters to trim + uppercase", () => {
    const parsed = barberSearchQuerySchema.safeParse({
      audience: " femme ",
      technique: " degrade ",
      countryCode: " ch ",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.audience).toBe("FEMME");
      expect(parsed.data.technique).toBe("DEGRADE");
      expect(parsed.data.countryCode).toBe("CH");
    }
  });

  it("rejects unknown audience, technique and countryCode", () => {
    expect(barberSearchQuerySchema.safeParse({ audience: "XYZ" }).success).toBe(false);
    expect(barberSearchQuerySchema.safeParse({ technique: "XYZ" }).success).toBe(false);
    expect(barberSearchQuerySchema.safeParse({ countryCode: "XX" }).success).toBe(false);
  });

  it("rejects repeated parameters (arrays)", () => {
    expect(barberSearchQuerySchema.safeParse({ q: ["a", "b"] }).success).toBe(false);
    expect(barberSearchQuerySchema.safeParse({ city: ["a", "b"] }).success).toBe(false);
    expect(barberSearchQuerySchema.safeParse({ audience: ["FEMME", "HOMME"] }).success).toBe(false);
    expect(barberSearchQuerySchema.safeParse({ page: ["1", "2"] }).success).toBe(false);
    expect(barberSearchQuerySchema.safeParse({ pageSize: ["12", "24"] }).success).toBe(false);
  });

  it("rejects empty or non-integer pagination before coercion", () => {
    expect(barberSearchQuerySchema.safeParse({ page: "" }).success).toBe(false);
    expect(barberSearchQuerySchema.safeParse({ pageSize: " " }).success).toBe(false);
    expect(barberSearchQuerySchema.safeParse({ page: "abc" }).success).toBe(false);
    expect(barberSearchQuerySchema.safeParse({ page: "1.5" }).success).toBe(false);
    expect(barberSearchQuerySchema.safeParse({ page: 0 }).success).toBe(false);
    expect(barberSearchQuerySchema.safeParse({ pageSize: 0 }).success).toBe(false);
    expect(barberSearchQuerySchema.safeParse({ page: 10001 }).success).toBe(false);
    expect(barberSearchQuerySchema.safeParse({ pageSize: 51 }).success).toBe(false);
  });

  it("accepts pagination boundaries", () => {
    const parsed = barberSearchQuerySchema.safeParse({ page: 10000, pageSize: 50 });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.page).toBe(10000);
      expect(parsed.data.pageSize).toBe(50);
    }
  });

  it("rejects unknown keys", () => {
    expect(barberSearchQuerySchema.safeParse({ foo: "bar" }).success).toBe(false);
  });

  it("bounds q and city lengths", () => {
    expect(barberSearchQuerySchema.safeParse({ q: "a".repeat(121) }).success).toBe(false);
    expect(barberSearchQuerySchema.safeParse({ city: "a".repeat(101) }).success).toBe(false);
    expect(barberSearchQuerySchema.safeParse({ q: "a".repeat(120) }).success).toBe(true);
    expect(barberSearchQuerySchema.safeParse({ city: "a".repeat(100) }).success).toBe(true);
  });
});
