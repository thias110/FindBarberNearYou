import { useState, type FormEvent } from "react";
import { LIMITS } from "@findbarber/shared/constants";
import {
  hasReviewDraftErrors,
  validateReviewDraft,
  type ReviewDraftErrors,
} from "../lib/review";
import { Alert } from "./ui/Alert";
import { Button } from "./ui/Button";
import { chipClasses } from "./ui/chipStyles";
import { CONTROL_CLASS } from "./ui/control";

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
      className="mt-3 rounded-xl border border-border bg-surface-muted p-3"
    >
      <p className="text-sm font-medium text-foreground">Votre avis</p>

      <div className="mt-2">
        <span className="text-sm text-foreground-muted">Note</span>
        <div className="mt-1 flex gap-1">
          {RATING_OPTIONS.map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setRating(value)}
              disabled={submitting}
              aria-pressed={rating === value}
              className={chipClasses(rating === value, {
                tone: "accent",
                square: true,
              })}
            >
              {value}
            </button>
          ))}
        </div>
        {errors.rating && (
          <p role="alert" className="mt-1 text-xs text-danger">
            {errors.rating}
          </p>
        )}
      </div>

      <div className="mt-2">
        <label
          htmlFor="review-comment"
          className="text-sm text-foreground-muted"
        >
          Commentaire (facultatif)
        </label>
        <textarea
          id="review-comment"
          value={comment}
          onChange={(event) => setComment(event.target.value)}
          disabled={submitting}
          rows={3}
          maxLength={LIMITS.reviewComment}
          className={`mt-1 resize-y ${CONTROL_CLASS}`}
        />
        {errors.comment && (
          <p role="alert" className="mt-1 text-xs text-danger">
            {errors.comment}
          </p>
        )}
      </div>

      {serverError && (
        <Alert variant="danger" className="mt-2">
          {serverError}
        </Alert>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          type="submit"
          isLoading={submitting}
          className="min-h-[44px]"
        >
          {submitting ? "Envoi…" : "Envoyer mon avis"}
        </Button>
        <Button
          type="button"
          variant="secondary"
          disabled={submitting}
          className="min-h-[44px]"
          onClick={onCancel}
        >
          Annuler
        </Button>
      </div>
    </form>
  );
}
