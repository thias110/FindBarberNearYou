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
import { AdminListState } from "../../components/admin/AdminListState";
import { Alert } from "../../components/ui/Alert";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import { Field } from "../../components/ui/Field";
import { Select } from "../../components/ui/Select";
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
  // Annulation administrateur (PENDING/CONFIRMED), confirmée par dialogue.
  const [pendingCancel, setPendingCancel] = useState<AdminBooking | null>(null);
  const [cancelBusy, setCancelBusy] = useState(false);
  const [message, setMessage] = useState<{
    kind: "success" | "error";
    text: string;
  } | null>(null);

  async function handleCancel() {
    if (!pendingCancel) return;
    setMessage(null);
    setCancelBusy(true);
    try {
      await adminApi.cancelBooking(pendingCancel.id);
      setMessage({ kind: "success", text: "Réservation annulée." });
      setReloadKey((key) => key + 1);
    } catch (err) {
      setMessage({
        kind: "error",
        text: err instanceof Error ? err.message : "Annulation impossible.",
      });
    } finally {
      setCancelBusy(false);
      setPendingCancel(null);
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
        <h2 className="text-xl font-semibold text-foreground">Réservations</h2>

        {message && (
          <Alert variant={message.kind === "success" ? "success" : "danger"}>
            {message.text}
          </Alert>
        )}

        <Field label="Statut" className="max-w-xs">
          {(control) => (
            <Select
              {...control}
              value={status}
              onChange={(event) =>
                handleStatusChange(event.target.value as StatusFilter)
              }
            >
              <option value="ALL">Tous les statuts</option>
              {BOOKING_STATUSES.map((value) => (
                <option key={value} value={value}>
                  {BOOKING_STATUS_LABELS[value]}
                </option>
              ))}
            </Select>
          )}
        </Field>

        <AdminListState
          loading={loading}
          error={error}
          onRetry={() => setReloadKey((key) => key + 1)}
          isEmpty={bookings.length === 0}
          emptyTitle="Aucune réservation pour ce filtre."
          loadingLabel="Chargement des réservations…"
        >
          <ul className="space-y-3">
            {bookings.map((booking) => {
              const actor = cancellationActorLabel(booking.cancelledBy);
              return (
                <li key={booking.id}>
                  <Card className="p-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-semibold text-foreground">
                          {booking.serviceName}
                        </p>
                        <p className="mt-1 text-sm text-foreground">
                          {formatDateTime(booking.startAt)}
                        </p>
                        <p className="text-sm text-foreground-muted">
                          {SERVICE_PLACE_LABELS[booking.servicePlace]} ·{" "}
                          {formatCurrency(booking.priceMinor, booking.currency)}
                        </p>
                        <p className="mt-1 text-sm text-foreground">
                          Client : {bookingClientLabel(booking)}
                        </p>
                        <p className="text-sm text-foreground">
                          Professionnel : {booking.barberDisplayName}
                        </p>
                        {booking.status === "CANCELLED" && actor && (
                          <p className="mt-1 text-xs text-foreground-muted">
                            Annulée par : {actor.toLowerCase()}.
                          </p>
                        )}
                      </div>
                      <BookingStatusBadge status={booking.status} />
                    </div>
                    {(booking.status === "PENDING" ||
                      booking.status === "CONFIRMED") && (
                      <div className="mt-3 flex justify-end">
                        <Button
                          variant="danger"
                          className="min-h-11"
                          onClick={() => setPendingCancel(booking)}
                        >
                          Annuler la réservation
                        </Button>
                      </div>
                    )}
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
        open={pendingCancel !== null}
        title="Annuler cette réservation ?"
        confirmLabel="Annuler la réservation"
        cancelLabel="Garder"
        tone="danger"
        isLoading={cancelBusy}
        onConfirm={() => void handleCancel()}
        onCancel={() => setPendingCancel(null)}
      >
        <p>Le client et le professionnel seront notifiés.</p>
      </ConfirmDialog>
    </AdminLayout>
  );
}
