// --- Validation du formulaire d'avis (côté client) ---
// La validation serveur reste la source de vérité : ces règles servent
// uniquement à guider l'utilisateur avant l'envoi (note 1..5 requise,
// commentaire facultatif borné).
import { LIMITS } from "@findbarber/shared/constants";
import i18n from "../i18n";

export interface ReviewDraft {
  rating: number | null;
  comment: string;
}

export type ReviewDraftField = "rating" | "comment";
export type ReviewDraftErrors = Partial<Record<ReviewDraftField, string>>;

export function validateReviewDraft(draft: ReviewDraft): ReviewDraftErrors {
  const errors: ReviewDraftErrors = {};

  if (
    draft.rating === null ||
    !Number.isInteger(draft.rating) ||
    draft.rating < LIMITS.reviewRatingMin ||
    draft.rating > LIMITS.reviewRatingMax
  ) {
    errors.rating = i18n.t("client:review.validation.rating");
  }

  if (draft.comment.trim().length > LIMITS.reviewComment) {
    errors.comment = i18n.t("client:review.validation.commentTooLong", {
      max: LIMITS.reviewComment,
    });
  }

  return errors;
}

export function hasReviewDraftErrors(errors: ReviewDraftErrors): boolean {
  return Object.keys(errors).length > 0;
}
