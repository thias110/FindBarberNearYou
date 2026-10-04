// --- Validation du formulaire d'avis (côté client) ---
// La validation serveur reste la source de vérité : ces règles servent
// uniquement à guider l'utilisateur avant l'envoi (note 1..5 requise,
// commentaire facultatif borné).
import { LIMITS } from "@findbarber/shared/constants";

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
    errors.rating = "Choisissez une note entre 1 et 5.";
  }

  if (draft.comment.trim().length > LIMITS.reviewComment) {
    errors.comment = `Le commentaire ne peut pas dépasser ${LIMITS.reviewComment} caractères.`;
  }

  return errors;
}

export function hasReviewDraftErrors(errors: ReviewDraftErrors): boolean {
  return Object.keys(errors).length > 0;
}
