import { useEffect, useState } from "react";
import type { AdminReview } from "@findbarber/shared/types";
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
  const full = Math.max(0, Math.min(5, rating));
  return (
    <span className="text-sm">
      <span aria-hidden="true" className="text-gold">
        {"★".repeat(full)}
        {"☆".repeat(5 - full)}
      </span>{" "}
      <span className="text-foreground">{rating} / 5</span>
    </span>
  );
}

export function AdminReviewsPage() {
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
            err instanceof Error ? err.message : "Chargement impossible.",
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
      setMessage({ kind: "success", text: "Avis masqué." });
      setReloadKey((key) => key + 1);
    } catch (err) {
      setMessage({
        kind: "error",
        text: err instanceof Error ? err.message : "Masquage impossible.",
      });
    } finally {
      setBusy(false);
      setPending(null);
    }
  }

  return (
    <AdminLayout>
      <div className="space-y-4">
        <h2 className="text-xl font-semibold text-foreground">Avis</h2>

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
          emptyTitle="Aucun avis pour le moment."
          loadingLabel="Chargement des avis…"
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
                            {hidden ? "Masqué" : "Visible"}
                          </Badge>
                        </div>
                        <p className="mt-2 text-sm text-foreground">
                          {review.comment?.trim()
                            ? review.comment
                            : "Sans commentaire."}
                        </p>
                        <p className="mt-2 text-xs text-foreground-muted">
                          Professionnel : {review.barberDisplayName ?? "—"} ·
                          Client : {review.clientName ?? "—"}
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
                          Masquer
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
        title="Masquer cet avis ?"
        confirmLabel="Masquer"
        tone="danger"
        isLoading={busy}
        onConfirm={() => void handleHide()}
        onCancel={() => setPending(null)}
      >
        <p>
          Il ne sera plus visible publiquement. Cette action ne peut pas être
          annulée depuis l'interface.
        </p>
      </ConfirmDialog>
    </AdminLayout>
  );
}
