import { useTranslation } from "react-i18next";
import type {
  BarberReviewsResponse,
  PublicReview,
} from "@findbarber/shared/types";
import { formatDateTime, formatRating } from "../../lib/formatters";
import { Alert } from "../ui/Alert";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";

function StarIcon({ filled = true }: { filled?: boolean }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={filled ? 0 : 1.8}
      className={filled ? "h-3.5 w-3.5 text-brass" : "h-3.5 w-3.5 text-border-strong"}
    >
      <path d="M12 2.5l2.9 6.1 6.6.9-4.8 4.6 1.2 6.6L12 17.6l-5.9 3.1 1.2-6.6L2.5 9.5l6.6-.9z" />
    </svg>
  );
}

interface BarberReviewsProps {
  summary: BarberReviewsResponse["summary"] | null;
  reviews: PublicReview[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
}

// Lecture seule : aucun formulaire d'avis dans ce lot.
export function BarberReviews({
  summary,
  reviews,
  loading,
  error,
  onRetry,
}: BarberReviewsProps) {
  const { t } = useTranslation("barber");
  const hasSummary = summary !== null && summary.totalReviews > 0;

  return (
    <Card className="rounded-3xl border-border/80 p-6 shadow-card-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-h3 font-bold text-foreground">{t("public.reviews.title")}</h2>
        {hasSummary && summary.averageRating !== null && (
          <p className="inline-flex items-center gap-1.5 rounded-full border border-brass/35 bg-brass-soft px-3 py-1 text-sm text-foreground">
            <StarIcon />
            <span className="font-display font-extrabold tabular-nums">
              {formatRating(summary.averageRating)}
            </span>
            <span className="text-foreground-muted">
              {t("common.reviewCount", { count: summary.totalReviews })}
            </span>
          </p>
        )}
      </div>

      {loading ? (
        <p className="mt-2 text-foreground-muted">{t("public.reviews.loading")}</p>
      ) : error ? (
        <Alert variant="danger" className="mt-3">
          <p>{error}</p>
          <Button
            type="button"
            variant="secondary"
            className="mt-2 min-h-[44px]"
            onClick={onRetry}
          >
            {t("common.retry")}
          </Button>
        </Alert>
      ) : reviews.length === 0 ? (
        <p className="mt-2 text-foreground-muted">
          {t("public.reviews.empty")}
        </p>
      ) : (
        <ul className="mt-4 space-y-3">
          {reviews.map((review) => {
            const author = review.clientName ?? t("public.reviews.anonymousClient");
            return (
              <li
                key={review.id}
                className="rounded-xl border border-border/70 bg-surface-muted/35 p-4"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <span
                      aria-hidden="true"
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent-soft font-display text-xs font-bold text-accent-strong"
                    >
                      {author.charAt(0).toUpperCase()}
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-foreground">{author}</p>
                      <p className="text-xs text-foreground-muted">
                        {formatDateTime(review.createdAt)}
                      </p>
                    </div>
                  </div>
                  <p className="inline-flex items-center gap-1 rounded-full bg-surface px-2.5 py-1 text-xs font-bold tabular-nums text-foreground shadow-1">
                    <StarIcon />
                    {review.rating}/5
                  </p>
                </div>
                {review.comment && (
                  <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-foreground">
                    {review.comment}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
