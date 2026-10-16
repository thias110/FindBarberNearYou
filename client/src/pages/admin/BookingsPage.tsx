import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  BOOKING_STATUSES,
  type BookingStatus,
} from "@findbarber/shared/constants";
import type { AdminBooking } from "@findbarber/shared/types";
import i18n from "../../i18n";
import { adminApi } from "../../lib/apiClient";
import { label } from "../../lib/labels";
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
  const { t } = useTranslation("admin");
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
      setMessage({ kind: "success", text: t("bookings.cancelSuccess") });
      setReloadKey((key) => key + 1);
    } catch (err) {
      setMessage({
        kind: "error",
        text: err instanceof Error ? err.message : t("bookings.cancelFailure"),
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
  }, [status, page, reloadKey]);

  function handleStatusChange(next: StatusFilter) {
    setStatus(next);
    setPage(1);
  }

  return (
    <AdminLayout>
      <div className="space-y-4">
        <h2 className="text-xl font-bold text-foreground">
          {t("bookings.title")}
        </h2>

        {message && (
          <Alert variant={message.kind === "success" ? "success" : "danger"}>
            {message.text}
          </Alert>
        )}

        <Field label={t("bookings.statusLabel")} className="max-w-xs">
          {(control) => (
            <Select
              {...control}
              value={status}
              onChange={(event) =>
                handleStatusChange(event.target.value as StatusFilter)
              }
            >
              <option value="ALL">{t("bookings.allStatuses")}</option>
              {BOOKING_STATUSES.map((value) => (
                <option key={value} value={value}>
                  {label("bookingStatus", value)}
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
          emptyTitle={t("bookings.empty")}
          loadingLabel={t("bookings.loading")}
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
                          {label("servicePlace", booking.servicePlace)} ·{" "}
                          {formatCurrency(booking.priceMinor, booking.currency)}
                        </p>
                        <p className="mt-1 text-sm text-foreground">
                          {t("bookings.client", {
                            name: bookingClientLabel(booking),
                          })}
                        </p>
                        <p className="text-sm text-foreground">
                          {t("bookings.barber", {
                            name: booking.barberDisplayName,
                          })}
                        </p>
                        {booking.status === "CANCELLED" && actor && (
                          <p className="mt-1 text-xs text-foreground-muted">
                            {t("bookings.cancelledBy", {
                              actor: actor.toLowerCase(),
                            })}
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
                          {t("bookings.cancel")}
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
        title={t("bookings.confirm.title")}
        confirmLabel={t("bookings.cancel")}
        cancelLabel={t("bookings.confirm.keep")}
        tone="danger"
        isLoading={cancelBusy}
        onConfirm={() => void handleCancel()}
        onCancel={() => setPendingCancel(null)}
      >
        <p>{t("bookings.confirm.body")}</p>
      </ConfirmDialog>
    </AdminLayout>
  );
}
