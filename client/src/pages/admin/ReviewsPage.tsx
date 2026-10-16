import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { AdminReview } from "@findbarber/shared/types";
import i18n from "../../i18n";
import { adminApi } from "../../lib/apiClient";
import { AdminLayout } from "../../components/AdminLayout";
import { AdminPagination } from "../../components/AdminPagination";
import { AdminListState } from "../../components/admin/AdminListState";
import { Alert } from "../../components/ui/Alert";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import { formatDateTime } from "../../lib/formatters";

const PAGE_SIZE = 20;

function RatingStars({ rating }: { rating: number }) {
  const { t } = useTranslation("admin");
  const full = Math.max(0, Math.min(5, rating));
  return (
    <span className="text-sm">
      <span aria-hidden="true" className="text-brass">
        {"★".repeat(full)}
        {"☆".repeat(5 - full)}
      </span>{" "}
      <span className="text-foreground">
        {t("reviews.rating", { rating })}
      </span>
    </span>
  );
}

export function AdminReviewsPage() {
  const { t } = useTranslation("admin");
  const [page, setPage] = useState(1);
  const [reviews, setReviews] = useState<AdminReview[]>([]);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<AdminReview | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{
    kind: "success" | "error";
    text: string;
  } | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    adminApi
      .listReviews({ page, pageSize: PAGE_SIZE })
      .then((res) => {
        if (cancelled) return;
        setReviews(res.reviews);
        setTotalPages(res.pagination.totalPages);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : i18n.t("admin:common.loadError"),
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [page, reloadKey]);

  async function handleHide() {
    if (!pending) return;
    setBusy(true);
    setMessage(null);
    try {
      await adminApi.hideReview(pending.id);
      setMessage({ kind: "success", text: t("reviews.hideSuccess") });
      setReloadKey((key) => key + 1);
    } catch (err) {
      setMessage({
        kind: "error",
        text: err instanceof Error ? err.message : t("reviews.hideFailure"),
      });
    } finally {
      setBusy(false);
      setPending(null);
    }
  }

  return (
    <AdminLayout>
      <div className="space-y-4">
        <h2 className="text-xl font-bold text-foreground">
          {t("reviews.title")}
        </h2>

        {message && (
          <Alert variant={message.kind === "success" ? "success" : "danger"}>
            {message.text}
          </Alert>
        )}

        <AdminListState
          loading={loading}
          error={error}
          onRetry={() => setReloadKey((key) => key + 1)}
          isEmpty={reviews.length === 0}
          emptyTitle={t("reviews.empty")}
          loadingLabel={t("reviews.loading")}
        >
          <ul className="space-y-3">
            {reviews.map((review) => {
              const hidden = review.hiddenAt !== null;
              return (
                <li key={review.id}>
                  <Card className="p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <RatingStars rating={review.rating} />
                          <Badge variant={hidden ? "danger" : "success"}>
                            {hidden ? t("reviews.hidden") : t("reviews.visible")}
                          </Badge>
                        </div>
                        <p className="mt-2 text-sm text-foreground">
                          {review.comment?.trim()
                            ? review.comment
                            : t("reviews.noComment")}
                        </p>
                        <p className="mt-2 text-xs text-foreground-muted">
                          {t("reviews.meta", {
                            barber: review.barberDisplayName ?? "—",
                            client: review.clientName ?? "—",
                          })}
                        </p>
                        <p className="text-xs text-foreground-muted">
                          {formatDateTime(review.createdAt)}
                        </p>
                      </div>

                      {!hidden && (
                        <Button
                          variant="danger"
                          className="min-h-11"
                          onClick={() => setPending(review)}
                        >
                          {t("reviews.hide")}
                        </Button>
                      )}
                    </div>
                  </Card>
                </li>
              );
            })}
          </ul>
        </AdminListState>

        <AdminPagination
          page={page}
          totalPages={totalPages}
          onPageChange={setPage}
        />
      </div>

      <ConfirmDialog
        open={pending !== null}
        title={t("reviews.confirm.title")}
        confirmLabel={t("reviews.hide")}
        tone="danger"
        isLoading={busy}
        onConfirm={() => void handleHide()}
        onCancel={() => setPending(null)}
      >
        <p>{t("reviews.confirm.body")}</p>
      </ConfirmDialog>
    </AdminLayout>
  );
}
