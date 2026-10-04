import { useState, type FormEvent } from "react";
import { LIMITS } from "@findbarber/shared/constants";
import {
  hasReviewDraftErrors,
  validateReviewDraft,
  type ReviewDraftErrors,
} from "../lib/review";

const RATING_OPTIONS = [1, 2, 3, 4, 5] as const;

export interface ReviewFormProps {
  onSubmit: (input: { rating: number; comment: string }) => Promise<void>;
  submitting: boolean;
  onCancel: () => void;
  serverError?: string | null;
}

export function ReviewForm({
  onSubmit,
  submitting,
  onCancel,
  serverError,
}: ReviewFormProps) {
  const [rating, setRating] = useState<number | null>(null);
  const [comment, setComment] = useState("");
  const [errors, setErrors] = useState<ReviewDraftErrors>({});

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const draftErrors = validateReviewDraft({ rating, comment });
    if (hasReviewDraftErrors(draftErrors)) {
      setErrors(draftErrors);
      return;
    }
    setErrors({});
    await onSubmit({ rating: rating as number, comment: comment.trim() });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-3 rounded-lg border border-gray-200 bg-gray-50 p-3"
    >
      <p className="text-sm font-medium text-brand-900">Votre avis</p>

      <div className="mt-2">
        <span className="text-sm text-gray-600">Note</span>
        <div className="mt-1 flex gap-1">
          {RATING_OPTIONS.map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setRating(value)}
              disabled={submitting}
              className={`h-9 w-9 rounded-lg border text-sm disabled:opacity-50 ${
                rating === value
                  ? "border-brand-700 bg-brand-700 text-white"
                  : "border-gray-300 bg-white text-gray-700"
              }`}
            >
              {value}
            </button>
          ))}
        </div>
        {errors.rating && (
          <p className="mt-1 text-xs text-red-700">{errors.rating}</p>
        )}
      </div>

      <div className="mt-2">
        <label htmlFor="review-comment" className="text-sm text-gray-600">
          Commentaire (facultatif)
        </label>
        <textarea
          id="review-comment"
          value={comment}
          onChange={(event) => setComment(event.target.value)}
          disabled={submitting}
          rows={3}
          maxLength={LIMITS.reviewComment}
          className="mt-1 w-full rounded-lg border border-gray-300 p-2 text-sm disabled:opacity-50"
        />
        {errors.comment && (
          <p className="mt-1 text-xs text-red-700">{errors.comment}</p>
        )}
      </div>

      {serverError && (
        <p className="mt-2 text-xs text-red-700">{serverError}</p>
      )}

      <div className="mt-3 flex gap-2">
        <button
          type="submit"
          disabled={submitting}
          className="rounded-lg bg-brand-700 px-3 py-1.5 text-sm text-white disabled:opacity-50"
        >
          {submitting ? "Envoi…" : "Envoyer mon avis"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={submitting}
          className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 disabled:opacity-50"
        >
          Annuler
        </button>
      </div>
    </form>
  );
}
