import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  SERVICE_PLACE_LABELS,
  type BookingStatus,
} from "@findbarber/shared/constants";
import { isBookingEnded } from "@findbarber/shared/booking";
import type { Booking, BookingDetails } from "@findbarber/shared/types";
import { ApiError, bookingApi } from "../../lib/apiClient";
import { formatDateTime } from "../../lib/formatters";
import { BookingStatusBadge } from "../../components/BookingStatusBadge";
import { Alert } from "../../components/ui/Alert";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { Skeleton } from "../../components/ui/Skeleton";
import { ProPageHeader } from "../../components/barber/ProPageHeader";

// Lien stylé comme le bouton primaire du design system (aucun `ButtonLink`).
const PRIMARY_LINK_CLASS =
  "inline-flex min-h-[44px] items-center justify-center rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground transition-colors hover:bg-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background";

export function BarberBookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [profileMissing, setProfileMissing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [actionId, setActionId] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [completingId, setCompletingId] = useState<string | null>(null);

  const [details, setDetails] = useState<Record<string, BookingDetails>>({});
  const [detailLoadingId, setDetailLoadingId] = useState<string | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);

  const loadBookings = useCallback(async () => {
    setLoading(true);
    setError(null);
    setProfileMissing(false);
    try {
      const res = await bookingApi.list();
      setBookings(res.bookings);
    } catch (err) {
      if (err instanceof ApiError && err.code === "BARBER_PROFILE_NOT_FOUND") {
        setProfileMissing(true);
      } else {
        setError(err instanceof Error ? err.message : "Chargement impossible.");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadBookings();
  }, [loadBookings]);

  async function handleConfirm(bookingId: string) {
    setError(null);
    setActionId(bookingId);
    try {
      const res = await bookingApi.confirm(bookingId);
      setBookings((current) =>
        current.map((booking) =>
          booking.id === bookingId ? res.booking : booking,
        ),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Confirmation échouée.");
    } finally {
      setActionId(null);
    }
  }

  async function handleComplete(bookingId: string) {
    setError(null);
    setActionId(bookingId);
    setCompletingId(bookingId);
    try {
      const res = await bookingApi.complete(bookingId);
      setBookings((current) =>
        current.map((booking) =>
          booking.id === bookingId ? res.booking : booking,
        ),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Terminaison échouée.");
    } finally {
      setActionId(null);
      setCompletingId(null);
    }
  }

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
      <div className="min-h-screen bg-background p-4 sm:p-8">
        <div className="mx-auto max-w-3xl space-y-6">
          <div className="flex items-center justify-between gap-3">
            <Skeleton className="h-8 w-52" />
            <Skeleton className="h-11 w-44" />
          </div>
          <Card className="space-y-4 p-6" aria-busy="true">
            <span className="sr-only" role="status">
              Chargement des réservations…
            </span>
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </Card>
        </div>
      </div>
    );
  }

  if (profileMissing) {
    return (
      <div className="min-h-screen bg-background p-4 sm:p-8">
        <div className="mx-auto max-w-2xl space-y-6">
          <ProPageHeader title="Mes réservations" />
          <Card className="p-6 text-center">
            <p className="text-foreground">
              Créez d'abord votre profil professionnel pour gérer vos
              réservations.
            </p>
            <Link to="/pro/profile" className={`${PRIMARY_LINK_CLASS} mt-4`}>
              Créer mon profil
            </Link>
          </Card>
        </div>
      </div>
    );
  }

  const cancellable = (status: BookingStatus) =>
    status === "PENDING" || status === "CONFIRMED";

  return (
    <div className="min-h-screen bg-background p-4 sm:p-8">
      <div className="mx-auto max-w-3xl space-y-6">
        <ProPageHeader
          title="Mes réservations"
          description="Demandes en attente, confirmations et annulations."
        />

        {error && (
          <Alert variant="danger">
            <p>{error}</p>
            <Button
              variant="secondary"
              className="mt-3 min-h-[44px]"
              onClick={() => void loadBookings()}
            >
              Réessayer
            </Button>
          </Alert>
        )}
        {detailError && <Alert variant="danger">{detailError}</Alert>}

        {bookings.length === 0 && !error ? (
          <Card className="p-6 text-center">
            <p className="text-foreground-muted">
              Aucune réservation pour le moment.
            </p>
          </Card>
        ) : (
          <ul className="space-y-3">
            {bookings.map((booking) => {
              const detail = details[booking.id];
              const busy = actionId === booking.id;
              return (
                <li key={booking.id}>
                  <Card className="p-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-semibold text-foreground">
                          {booking.serviceName}
                        </p>
                        {booking.clientName && (
                          <p className="text-sm text-foreground-muted">
                            Client : {booking.clientName}
                          </p>
                        )}
                        <p className="mt-1 text-sm text-foreground">
                          {formatDateTime(booking.startAt)}
                        </p>
                        <p className="text-sm text-foreground-muted">
                          {SERVICE_PLACE_LABELS[booking.servicePlace]}
                        </p>
                        {booking.status === "CANCELLED" &&
                          booking.cancelledBy && (
                            <p className="mt-1 text-xs text-foreground-muted">
                              Annulée par{" "}
                              {booking.cancelledBy === "CLIENT"
                                ? "le client"
                                : booking.cancelledBy === "ADMIN"
                                  ? "l'administration"
                                  : "vous"}
                              .
                            </p>
                          )}
                      </div>
                      <BookingStatusBadge status={booking.status} />
                    </div>

                    {booking.servicePlace === "AT_CLIENT" && (
                      <div className="mt-3 border-t border-border pt-3">
                        {detail ? (
                          <div>
                            <p className="text-xs font-medium uppercase tracking-wide text-foreground-muted">
                              Adresse du client
                            </p>
                            <p className="mt-1 text-sm text-foreground">
                              {detail.clientAddress ??
                                "Adresse non renseignée."}
                            </p>
                          </div>
                        ) : (
                          <Button
                            variant="secondary"
                            className="min-h-[44px]"
                            disabled={detailLoadingId === booking.id}
                            isLoading={detailLoadingId === booking.id}
                            onClick={() => void handleShowAddress(booking)}
                          >
                            {detailLoadingId === booking.id
                              ? "Chargement…"
                              : "Voir l'adresse"}
                          </Button>
                        )}
                      </div>
                    )}

                    {cancellable(booking.status) && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {booking.status === "PENDING" && (
                          <Button
                            className="min-h-[44px]"
                            disabled={busy}
                            onClick={() => void handleConfirm(booking.id)}
                          >
                            {busy ? "Confirmation…" : "Confirmer"}
                          </Button>
                        )}
                        {booking.status === "CONFIRMED" &&
                          (isBookingEnded(booking.endAt, new Date()) ? (
                            <Button
                              className="min-h-[44px]"
                              disabled={busy}
                              onClick={() => void handleComplete(booking.id)}
                            >
                              {completingId === booking.id
                                ? "Terminaison…"
                                : "Marquer comme terminé"}
                            </Button>
                          ) : (
                            <span className="self-center text-sm text-foreground-muted">
                              Pourra être marquée comme terminée après la fin
                              du rendez-vous.
                            </span>
                          ))}
                        {cancellable(booking.status) &&
                          (confirmingId === booking.id ? (
                            <>
                              <span className="self-center text-sm text-danger">
                                Annuler cette réservation ?
                              </span>
                              <Button
                                variant="secondary"
                                className="min-h-[44px]"
                                disabled={busy}
                                onClick={() => setConfirmingId(null)}
                              >
                                Non
                              </Button>
                              <Button
                                variant="danger"
                                className="min-h-[44px]"
                                disabled={busy}
                                onClick={() => void handleCancel(booking.id)}
                              >
                                {busy ? "Annulation…" : "Confirmer l'annulation"}
                              </Button>
                            </>
                          ) : (
                            <Button
                              variant="secondary"
                              className="min-h-[44px]"
                              disabled={busy}
                              onClick={() => setConfirmingId(booking.id)}
                            >
                              Annuler
                            </Button>
                          ))}
                      </div>
                    )}
                  </Card>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
