import { useTranslation } from "react-i18next";
import type {
  BarberReviewsResponse,
  PublicReview,
} from "@findbarber/shared/types";
import { formatDateTime } from "../../lib/formatters";
import { Alert } from "../ui/Alert";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";

function StarIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="currentColor"
      className="h-3.5 w-3.5 text-brass"
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
    <Card className="p-6">
      <h2 className="text-h3 font-bold text-foreground">{t("public.reviews.title")}</h2>

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
        <div className="mt-3 space-y-1">
          {hasSummary && (
            <p className="flex items-center gap-1 text-sm text-foreground">
              <StarIcon />
              <span className="font-medium">
                {summary.averageRating === null
                  ? "—"
                  : summary.averageRating.toFixed(1)}
              </span>
              <span className="text-foreground-muted">
                {t("common.reviewCount", { count: summary.totalReviews })}
              </span>
            </p>
          )}
          <ul className="divide-y divide-border">
            {reviews.map((review) => (
              <li key={review.id} className="py-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-foreground">
                    {review.clientName ?? t("public.reviews.anonymousClient")}
                  </p>
                  <p className="flex items-center gap-1 text-sm text-foreground">
                    <StarIcon />
                    {review.rating}/5
                  </p>
                </div>
                {review.comment && (
                  <p className="mt-1 whitespace-pre-line text-sm text-foreground-muted">
                    {review.comment}
                  </p>
                )}
                <p className="mt-1 text-xs text-foreground-muted">
                  {formatDateTime(review.createdAt)}
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}
