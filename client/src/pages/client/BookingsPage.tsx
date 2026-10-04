import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { BookingStatus } from "@findbarber/shared/constants";
import type { Booking, BookingDetails } from "@findbarber/shared/types";
import { ApiError, bookingApi } from "../../lib/apiClient";
import { BookingCard } from "../../components/client/BookingCard";
import { Alert } from "../../components/ui/Alert";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { Skeleton } from "../../components/ui/Skeleton";

export function ClientBookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [actionId, setActionId] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [cancelError, setCancelError] = useState<{
    bookingId: string;
    message: string;
  } | null>(null);

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
    setCancelError(null);
    setActionId(bookingId);
    try {
      const res = await bookingApi.cancel(bookingId);
      setBookings((current) =>
        current.map((booking) =>
          booking.id === bookingId ? res.booking : booking,
        ),
      );
    } catch (err) {
      // Erreur contextuelle : on ne recharge pas la liste, le rendez-vous
      // reste visible et l'utilisateur peut réessayer si possible.
      setCancelError({
        bookingId,
        message: err instanceof Error ? err.message : "Annulation échouée.",
      });
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

  const cancellable = (status: BookingStatus) =>
    status === "PENDING" || status === "CONFIRMED";

  // Regroupement purement visuel, côté frontend, sans helper partagé.
  const now = Date.now();
  const isUpcoming = (booking: Booking) =>
    (booking.status === "PENDING" || booking.status === "CONFIRMED") &&
    new Date(booking.startAt).getTime() >= now;
  const upcoming = bookings.filter(isUpcoming);
  const past = bookings.filter((booking) => !isUpcoming(booking));

  function renderCard(booking: Booking) {
    return (
      <li key={booking.id}>
        <BookingCard
          booking={booking}
          detail={details[booking.id]}
          cancellable={cancellable(booking.status)}
          busy={actionId === booking.id}
          confirming={confirmingId === booking.id}
          cancelError={
            cancelError?.bookingId === booking.id ? cancelError.message : null
          }
          detailLoading={detailLoadingId === booking.id}
          reviewFormOpen={reviewFormId === booking.id}
          reviewSubmitting={reviewSubmittingId === booking.id}
          reviewThanks={reviewThanksId === booking.id}
          reviewError={reviewError}
          onRequestCancel={() => setConfirmingId(booking.id)}
          onConfirmCancel={() => void handleCancel(booking.id)}
          onAbortCancel={() => setConfirmingId(null)}
          onShowAddress={() => void handleShowAddress(booking)}
          onOpenReview={() => {
            setReviewError(null);
            setReviewFormId(booking.id);
          }}
          onCloseReview={() => {
            setReviewFormId(null);
            setReviewError(null);
          }}
          onSubmitReview={(input) => handleSubmitReview(booking.id, input)}
        />
      </li>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 sm:p-8">
      <div className="mx-auto max-w-2xl space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">
            Mes rendez-vous
          </h1>
          <p className="mt-1 text-sm text-foreground-muted">
            <Link to="/barbers" className="text-accent underline">
              Rechercher un barbier
            </Link>
          </p>
        </div>

        {loading ? (
          <div aria-busy="true" className="space-y-3">
            <span className="sr-only" role="status">
              Chargement des rendez-vous…
            </span>
            {[0, 1, 2].map((index) => (
              <Skeleton key={index} className="h-44 w-full rounded-2xl" />
            ))}
          </div>
        ) : error ? (
          <Alert variant="danger">
            <p>{error}</p>
            <Button
              type="button"
              variant="secondary"
              className="mt-2 min-h-[44px]"
              onClick={() => void loadBookings()}
            >
              Réessayer
            </Button>
          </Alert>
        ) : bookings.length === 0 ? (
          <Card className="p-6 text-center">
            <p className="text-foreground-muted">
              Aucun rendez-vous pour le moment.
            </p>
            <Link
              to="/barbers"
              className="mt-3 inline-flex min-h-[44px] items-center rounded-lg bg-accent px-4 text-sm font-medium text-accent-foreground transition-colors hover:bg-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              Rechercher un barber
            </Link>
          </Card>
        ) : (
          <div className="space-y-8">
            {detailError && <Alert variant="danger">{detailError}</Alert>}

            {upcoming.length > 0 && (
              <section aria-labelledby="bookings-upcoming-title">
                <h2
                  id="bookings-upcoming-title"
                  className="text-lg font-semibold text-foreground"
                >
                  À venir ({upcoming.length})
                </h2>
                <ul className="mt-3 space-y-3">{upcoming.map(renderCard)}</ul>
              </section>
            )}

            {past.length > 0 && (
              <section aria-labelledby="bookings-past-title">
                <h2
                  id="bookings-past-title"
                  className="text-lg font-semibold text-foreground"
                >
                  Passés ({past.length})
                </h2>
                <ul className="mt-3 space-y-3">{past.map(renderCard)}</ul>
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
