import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  SERVICE_PLACE_LABELS,
  type BookingStatus,
} from "@findbarber/shared/constants";
import type { Booking, BookingDetails } from "@findbarber/shared/types";
import { ApiError, bookingApi } from "../../lib/apiClient";
import { formatDateTime } from "../../lib/formatters";
import { BookingStatusBadge } from "../../components/BookingStatusBadge";
import { ReviewForm } from "../../components/ReviewForm";

export function ClientBookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [actionId, setActionId] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  const [details, setDetails] = useState<Record<string, BookingDetails>>({});
  const [detailLoadingId, setDetailLoadingId] = useState<string | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);

  const [reviewFormId, setReviewFormId] = useState<string | null>(null);
  const [reviewSubmittingId, setReviewSubmittingId] = useState<string | null>(
    null,
  );
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [reviewThanksId, setReviewThanksId] = useState<string | null>(null);

  const loadBookings = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await bookingApi.list();
      setBookings(res.bookings);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Chargement impossible.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadBookings();
  }, [loadBookings]);

  async function handleCancel(bookingId: string) {
    setError(null);
    setActionId(bookingId);
    try {
      const res = await bookingApi.cancel(bookingId);
      setBookings((current) =>
        current.map((booking) =>
          booking.id === bookingId ? res.booking : booking,
        ),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Annulation échouée.");
    } finally {
      setActionId(null);
      setConfirmingId(null);
    }
  }

  async function handleSubmitReview(
    bookingId: string,
    input: { rating: number; comment: string },
  ) {
    setReviewError(null);
    setReviewSubmittingId(bookingId);
    try {
      await bookingApi.createReview(bookingId, {
        rating: input.rating,
        comment: input.comment,
      });
      setBookings((current) =>
        current.map((booking) =>
          booking.id === bookingId ? { ...booking, hasReview: true } : booking,
        ),
      );
      setReviewFormId(null);
      setReviewThanksId(bookingId);
    } catch (err) {
      setReviewError(
        err instanceof ApiError ? err.message : "Envoi de l'avis échoué.",
      );
    } finally {
      setReviewSubmittingId(null);
    }
  }

  async function handleShowAddress(booking: Booking) {
    setDetailError(null);
    setDetailLoadingId(booking.id);
    try {
      const res = await bookingApi.getDetails(booking.id);
      setDetails((current) => ({ ...current, [booking.id]: res.booking }));
    } catch (err) {
      setDetailError(
        err instanceof Error
          ? err.message
          : "Impossible de charger le détail.",
      );
    } finally {
      setDetailLoadingId(null);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-brand-50 p-8 text-center text-gray-500">
        Chargement…
      </div>
    );
  }

  const cancellable = (status: BookingStatus) =>
    status === "PENDING" || status === "CONFIRMED";

  return (
    <div className="min-h-screen bg-brand-50 p-4 sm:p-8">
      <div className="mx-auto max-w-2xl space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-brand-900">
            Mes rendez-vous
          </h1>
          <p className="mt-1 text-sm text-gray-600">
            <Link to="/barbers" className="text-brand-700 underline">
              Rechercher un barbier
            </Link>
          </p>
        </div>

        {error && (
          <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
            <p>{error}</p>
            <button
              type="button"
              onClick={() => void loadBookings()}
              className="mt-2 rounded-lg border border-brand-700 px-3 py-1 text-brand-700"
            >
              Réessayer
            </button>
          </div>
        )}
        {detailError && (
          <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
            {detailError}
          </p>
        )}

        {bookings.length === 0 && !error ? (
          <div className="rounded-2xl bg-white p-6 text-center shadow">
            <p className="text-gray-600">Aucun rendez-vous pour le moment.</p>
            <Link
              to="/barbers"
              className="mt-3 inline-block rounded-lg bg-brand-700 px-4 py-2 text-white"
            >
              Trouver un barbier
            </Link>
          </div>
        ) : (
          <ul className="space-y-3">
            {bookings.map((booking) => {
              const detail = details[booking.id];
              const busy = actionId === booking.id;
              return (
                <li key={booking.id} className="rounded-xl bg-white p-4 shadow">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-brand-900">
                        {booking.serviceName}
                      </p>
                      <p className="text-sm text-gray-600">
                        avec {booking.barberDisplayName}
                      </p>
                      <p className="mt-1 text-sm text-gray-700">
                        {formatDateTime(booking.startAt)}
                      </p>
                      <p className="text-sm text-gray-600">
                        {SERVICE_PLACE_LABELS[booking.servicePlace]}
                      </p>
                      {booking.status === "CANCELLED" && booking.cancelledBy && (
                        <p className="mt-1 text-xs text-gray-500">
                          Annulée par{" "}
                          {booking.cancelledBy === "CLIENT"
                            ? "vous"
                            : booking.cancelledBy === "ADMIN"
                              ? "l'administration"
                              : "le professionnel"}
                          .
                        </p>
                      )}
                    </div>
                    <BookingStatusBadge status={booking.status} />
                  </div>

                  {booking.servicePlace === "AT_CLIENT" && (
                    <div className="mt-3 border-t border-gray-100 pt-3">
                      {detail ? (
                        <div>
                          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                            Adresse de la prestation
                          </p>
                          <p className="mt-1 text-sm text-gray-800">
                            {detail.clientAddress ?? "Adresse non renseignée."}
                          </p>
                        </div>
                      ) : (
                        <button
                          type="button"
                          disabled={detailLoadingId === booking.id}
                          onClick={() => void handleShowAddress(booking)}
                          className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 disabled:opacity-50"
                        >
                          {detailLoadingId === booking.id
                            ? "Chargement…"
                            : "Voir l'adresse"}
                        </button>
                      )}
                    </div>
                  )}

                  {booking.status === "COMPLETED" && (
                    <div className="mt-3 border-t border-gray-100 pt-3">
                      {booking.hasReview ? (
                        reviewThanksId === booking.id ? (
                          <p className="text-sm text-gray-600">
                            Merci, votre avis a été enregistré.
                          </p>
                        ) : (
                          <p className="text-sm text-gray-600">
                            Vous avez déjà laissé un avis.
                          </p>
                        )
                      ) : reviewFormId === booking.id ? (
                        <ReviewForm
                          onSubmit={(input) =>
                            handleSubmitReview(booking.id, input)
                          }
                          submitting={reviewSubmittingId === booking.id}
                          onCancel={() => {
                            setReviewFormId(null);
                            setReviewError(null);
                          }}
                          serverError={reviewError}
                        />
                      ) : (
                        <button
                          type="button"
                          disabled={reviewSubmittingId === booking.id}
                          onClick={() => {
                            setReviewError(null);
                            setReviewFormId(booking.id);
                          }}
                          className="rounded-lg border border-brand-700 px-3 py-1.5 text-sm text-brand-700 disabled:opacity-50"
                        >
                          Laisser un avis
                        </button>
                      )}
                    </div>
                  )}

                  {cancellable(booking.status) &&
                    (confirmingId === booking.id ? (
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <span className="text-xs text-red-700">
                          Annuler ce rendez-vous ?
                        </span>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => setConfirmingId(null)}
                          className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 disabled:opacity-50"
                        >
                          Non
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void handleCancel(booking.id)}
                          className="rounded-lg bg-red-600 px-3 py-1.5 text-sm text-white disabled:opacity-50"
                        >
                          {busy ? "Annulation…" : "Confirmer l'annulation"}
                        </button>
                      </div>
                    ) : (
                      <div className="mt-3">
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => setConfirmingId(booking.id)}
                          className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 disabled:opacity-50"
                        >
                          Annuler
                        </button>
                      </div>
                    ))}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
