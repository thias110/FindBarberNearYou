import { describe, expect, it } from "vitest";
import {
  hasReviewDraftErrors,
  validateReviewDraft,
} from "../../client/src/lib/review";
import { LIMITS } from "@findbarber/shared/constants";

describe("validateReviewDraft", () => {
  it("accepts a valid rating and a short comment", () => {
    const errors = validateReviewDraft({ rating: 5, comment: "Super !" });
    expect(errors).toEqual({});
    expect(hasReviewDraftErrors(errors)).toBe(false);
  });

  it("requires an integer rating between 1 and 5", () => {
    for (const rating of [null, 0, 6, 2.5]) {
      const errors = validateReviewDraft({ rating: rating as number | null, comment: "" });
      expect(errors.rating).toBe("Choisissez une note entre 1 et 5.");
    }
    for (const rating of [1, 5]) {
      const errors = validateReviewDraft({ rating, comment: "" });
      expect(errors.rating).toBeUndefined();
    }
  });

  it("rejects a comment longer than the shared limit", () => {
    const errors = validateReviewDraft({
      rating: 5,
      comment: "a".repeat(LIMITS.reviewComment + 1),
    });
    expect(errors.comment).toBe(
      `Le commentaire ne peut pas dépasser ${LIMITS.reviewComment} caractères.`,
    );
    expect(hasReviewDraftErrors(errors)).toBe(true);
  });

  it("accepts a comment exactly at the limit (server trims later)", () => {
    const errors = validateReviewDraft({
      rating: 5,
      comment: "a".repeat(LIMITS.reviewComment),
    });
    expect(errors.comment).toBeUndefined();
  });
});
