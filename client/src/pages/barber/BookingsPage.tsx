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

export function BarberBookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [profileMissing, setProfileMissing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [actionId, setActionId] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

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
      <div className="min-h-screen bg-brand-50 p-8 text-center text-gray-500">
        Chargement…
      </div>
    );
  }

  if (profileMissing) {
    return (
      <div className="min-h-screen bg-brand-50 p-4 sm:p-8">
        <div className="mx-auto max-w-xl rounded-2xl bg-white p-6 text-center shadow">
          <h1 className="text-xl font-semibold text-brand-900">
            Mes réservations
          </h1>
          <p className="mt-2 text-gray-700">
            Créez d'abord votre profil professionnel pour gérer vos
            réservations.
          </p>
          <Link
            to="/pro/profile"
            className="mt-4 inline-block rounded-lg bg-brand-700 px-4 py-2 text-white"
          >
            Créer mon profil
          </Link>
        </div>
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
            Mes réservations
          </h1>
          <p className="mt-1 text-sm text-gray-600">
            <Link to="/pro/dashboard" className="text-brand-700 underline">
              Retour au tableau de bord
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
            <p className="text-gray-600">Aucune réservation pour le moment.</p>
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
                      {booking.clientName && (
                        <p className="text-sm text-gray-600">
                          Client : {booking.clientName}
                        </p>
                      )}
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
                            ? "le client"
                            : "vous"}
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
                            Adresse du client
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

                  {cancellable(booking.status) && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {booking.status === "PENDING" && (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void handleConfirm(booking.id)}
                          className="rounded-lg bg-brand-700 px-3 py-1.5 text-sm text-white disabled:opacity-50"
                        >
                          {busy ? "Confirmation…" : "Confirmer"}
                        </button>
                      )}
                      {cancellable(booking.status) &&
                        (confirmingId === booking.id ? (
                          <>
                            <span className="self-center text-xs text-red-700">
                              Annuler cette réservation ?
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
                          </>
                        ) : (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => setConfirmingId(booking.id)}
                            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 disabled:opacity-50"
                          >
                            Annuler
                          </button>
                        ))}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
