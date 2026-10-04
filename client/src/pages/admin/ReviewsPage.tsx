import { useEffect, useState } from "react";
import type { AdminReview } from "@findbarber/shared/types";
import { adminApi } from "../../lib/apiClient";
import { AdminLayout } from "../../components/AdminLayout";
import { AdminPagination } from "../../components/AdminPagination";
import { formatDateTime } from "../../lib/formatters";

const PAGE_SIZE = 20;

function RatingStars({ rating }: { rating: number }) {
  const full = Math.max(0, Math.min(5, rating));
  return (
    <span className="text-sm text-amber-600">
      <span aria-hidden="true">
        {"★".repeat(full)}
        {"☆".repeat(5 - full)}
      </span>{" "}
      <span className="text-gray-700">{rating} / 5</span>
    </span>
  );
}

export function AdminReviewsPage() {
  const [page, setPage] = useState(1);
  const [reviews, setReviews] = useState<AdminReview[]>([]);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionId, setActionId] = useState<string | null>(null);
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

  async function handleHide(review: AdminReview) {
    if (
      !window.confirm(
        "Masquer cet avis ? Il ne sera plus visible publiquement.",
      )
    ) {
      return;
    }
    setActionId(review.id);
    setMessage(null);
    try {
      await adminApi.hideReview(review.id);
      setMessage({ kind: "success", text: "Avis masqué." });
      setReloadKey((key) => key + 1);
    } catch (err) {
      setMessage({
        kind: "error",
        text: err instanceof Error ? err.message : "Masquage impossible.",
      });
    } finally {
      setActionId(null);
    }
  }

  return (
    <AdminLayout>
      <div className="space-y-4">
        <h2 className="text-xl font-semibold text-brand-900">Avis</h2>

        {message && (
          <p
            className={`rounded-lg p-3 text-sm ${
              message.kind === "success"
                ? "bg-green-50 text-green-700"
                : "bg-red-50 text-red-700"
            }`}
          >
            {message.text}
          </p>
        )}

        {loading ? (
          <div className="rounded-2xl bg-white p-6 text-center text-gray-500">
            Chargement…
          </div>
        ) : error ? (
          <div className="rounded-lg bg-red-50 p-4 text-sm text-red-700">
            <p>{error}</p>
            <button
              type="button"
              onClick={() => setReloadKey((key) => key + 1)}
              className="mt-2 rounded-lg border border-brand-700 px-3 py-1 text-brand-700"
            >
              Réessayer
            </button>
          </div>
        ) : reviews.length === 0 ? (
          <div className="rounded-2xl bg-white p-6 text-center text-gray-600">
            Aucun avis pour le moment.
          </div>
        ) : (
          <ul className="space-y-3">
            {reviews.map((review) => {
              const hidden = review.hiddenAt !== null;
              const busy = actionId === review.id;
              return (
                <li key={review.id} className="rounded-xl bg-white p-4 shadow">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <RatingStars rating={review.rating} />
                      <p className="mt-1 text-sm text-gray-800">
                        {review.comment?.trim()
                          ? review.comment
                          : "Sans commentaire."}
                      </p>
                      <p className="mt-1 text-xs text-gray-500">
                        Professionnel : {review.barberDisplayName ?? "—"} ·
                        Client : {review.clientName ?? "—"}
                      </p>
                      <p className="text-xs text-gray-500">
                        {formatDateTime(review.createdAt)}
                      </p>
                      <p className="mt-1 text-xs font-medium">
                        {hidden ? (
                          <span className="text-red-700">Masqué</span>
                        ) : (
                          <span className="text-green-700">Visible</span>
                        )}
                      </p>
                    </div>

                    {!hidden && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void handleHide(review)}
                        className="rounded-lg border border-red-300 px-3 py-1.5 text-sm text-red-700 disabled:opacity-50"
                      >
                        {busy ? "Masquage…" : "Masquer"}
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        <AdminPagination
          page={page}
          totalPages={totalPages}
          onPageChange={setPage}
        />
      </div>
    </AdminLayout>
  );
}
