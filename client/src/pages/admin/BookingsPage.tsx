import { useEffect, useState } from "react";
import {
  BOOKING_STATUSES,
  BOOKING_STATUS_LABELS,
  SERVICE_PLACE_LABELS,
  type BookingStatus,
} from "@findbarber/shared/constants";
import type { AdminBooking } from "@findbarber/shared/types";
import { adminApi } from "../../lib/apiClient";
import { AdminLayout } from "../../components/AdminLayout";
import { AdminPagination } from "../../components/AdminPagination";
import { BookingStatusBadge } from "../../components/BookingStatusBadge";
import { bookingClientLabel, cancellationActorLabel } from "../../lib/admin";
import { formatCurrency, formatDateTime } from "../../lib/formatters";

type StatusFilter = "ALL" | BookingStatus;

const PAGE_SIZE = 20;

// Vue globale admin. L'adresse client privée n'est jamais renvoyée par le DTO
// admin (`AdminBooking`) et n'est donc jamais affichée ici.
export function AdminBookingsPage() {
  const [status, setStatus] = useState<StatusFilter>("ALL");
  const [page, setPage] = useState(1);
  const [bookings, setBookings] = useState<AdminBooking[]>([]);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  // Annulation administrateur en deux étapes (lot 4 rouvert).
  const [cancelId, setCancelId] = useState<string | null>(null);
  const [cancelBusy, setCancelBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  async function handleCancel(bookingId: string) {
    setActionError(null);
    setCancelBusy(true);
    try {
      await adminApi.cancelBooking(bookingId);
      setCancelId(null);
      setReloadKey((key) => key + 1);
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Annulation impossible.",
      );
    } finally {
      setCancelBusy(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    adminApi
      .listBookings({
        page,
        pageSize: PAGE_SIZE,
        status: status === "ALL" ? undefined : status,
      })
      .then((res) => {
        if (cancelled) return;
        setBookings(res.bookings);
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
  }, [status, page, reloadKey]);

  function handleStatusChange(next: StatusFilter) {
    setStatus(next);
    setPage(1);
  }

  return (
    <AdminLayout>
      <div className="space-y-4">
        <h2 className="text-xl font-semibold text-brand-900">Réservations</h2>
        {actionError && (
          <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">
            {actionError}
          </p>
        )}

        <label className="block text-sm text-gray-700">
          Statut
          <select
            value={status}
            onChange={(event) =>
              handleStatusChange(event.target.value as StatusFilter)
            }
            className="mt-1 block rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
          >
            <option value="ALL">Tous les statuts</option>
            {BOOKING_STATUSES.map((value) => (
              <option key={value} value={value}>
                {BOOKING_STATUS_LABELS[value]}
              </option>
            ))}
          </select>
        </label>

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
        ) : bookings.length === 0 ? (
          <div className="rounded-2xl bg-white p-6 text-center text-gray-600">
            Aucune réservation pour ce filtre.
          </div>
        ) : (
          <ul className="space-y-3">
            {bookings.map((booking) => {
              const actor = cancellationActorLabel(booking.cancelledBy);
              return (
                <li key={booking.id} className="rounded-xl bg-white p-4 shadow">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-brand-900">
                        {booking.serviceName}
                      </p>
                      <p className="mt-1 text-sm text-gray-700">
                        {formatDateTime(booking.startAt)}
                      </p>
                      <p className="text-sm text-gray-600">
                        {SERVICE_PLACE_LABELS[booking.servicePlace]} ·{" "}
                        {formatCurrency(booking.priceMinor, booking.currency)}
                      </p>
                      <p className="mt-1 text-sm text-gray-700">
                        Client : {bookingClientLabel(booking)}
                      </p>
                      <p className="text-sm text-gray-700">
                        Professionnel : {booking.barberDisplayName}
                      </p>
                      {booking.status === "CANCELLED" && actor && (
                        <p className="mt-1 text-xs text-gray-500">
                          Annulée par : {actor.toLowerCase()}.
                        </p>
                      )}
                    </div>
                    <BookingStatusBadge status={booking.status} />
                  </div>
                  {(booking.status === "PENDING" ||
                    booking.status === "CONFIRMED") && (
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      {cancelId === booking.id ? (
                        <>
                          <span className="text-sm text-red-700">
                            Annuler cette réservation ? Client et
                            professionnel seront notifiés.
                          </span>
                          <button
                            type="button"
                            className="min-h-[44px] rounded-lg border border-gray-300 px-3 text-sm"
                            disabled={cancelBusy}
                            onClick={() => setCancelId(null)}
                          >
                            Non
                          </button>
                          <button
                            type="button"
                            className="min-h-[44px] rounded-lg bg-red-600 px-3 text-sm text-white"
                            disabled={cancelBusy}
                            onClick={() => void handleCancel(booking.id)}
                          >
                            {cancelBusy ? "Annulation…" : "Confirmer l'annulation"}
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          className="min-h-[44px] rounded-lg border border-gray-300 px-3 text-sm"
                          onClick={() => setCancelId(booking.id)}
                        >
                          Annuler
                        </button>
                      )}
                    </div>
                  )}
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
