import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import {
  LIMITS,
  type BookingStatus,
} from "@findbarber/shared/constants";
import { canMarkNoShow, isBookingEnded } from "@findbarber/shared/booking";
import type { Booking, BookingDetails } from "@findbarber/shared/types";
import { ApiError, bookingApi } from "../../lib/apiClient";
import { formatCurrency, formatDateTime } from "../../lib/formatters";
import { label } from "../../lib/labels";
import { BookingStatusBadge } from "../../components/BookingStatusBadge";
import { Alert } from "../../components/ui/Alert";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import { Input } from "../../components/ui/Input";
import { Skeleton } from "../../components/ui/Skeleton";
import { ProPageHeader } from "../../components/barber/ProPageHeader";
import { buttonClasses } from "../../components/ui/buttonStyles";
import { PageContainer } from "../../components/ui/PageContainer";

// Lien stylé comme le bouton primaire du design system (aucun `ButtonLink`).
const PRIMARY_LINK_CLASS = buttonClasses("primary");

export function BarberBookingsPage() {
  const { t } = useTranslation("barber");
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [profileMissing, setProfileMissing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [actionId, setActionId] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [completingId, setCompletingId] = useState<string | null>(null);
  const [decliningId, setDecliningId] = useState<string | null>(null);
  const [declineReason, setDeclineReason] = useState("");
  // Absence du client (lot N8) : réservation dont le dialogue est ouvert,
  // et erreur affichée près de l'action de cette réservation.
  const [noShowId, setNoShowId] = useState<string | null>(null);
  const [noShowSubmitting, setNoShowSubmitting] = useState(false);
  const [noShowError, setNoShowError] = useState<{
    id: string;
    message: string;
  } | null>(null);

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
        setError(err instanceof Error ? err.message : t("common.loadFailed"));
      }
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `t` : texte de repli seulement.
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
      setError(err instanceof Error ? err.message : t("bookings.errors.confirm"));
    } finally {
      setActionId(null);
    }
  }

  async function handleDecline(bookingId: string) {
    setError(null);
    setActionId(bookingId);
    try {
      const res = await bookingApi.decline(bookingId, declineReason);
      setBookings((current) =>
        current.map((booking) =>
          booking.id === bookingId ? res.booking : booking,
        ),
      );
      setDecliningId(null);
      setDeclineReason("");
    } catch (err) {
      setError(err instanceof Error ? err.message : t("bookings.errors.decline"));
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
      setError(err instanceof Error ? err.message : t("bookings.errors.complete"));
    } finally {
      setActionId(null);
      setCompletingId(null);
    }
  }

  async function handleNoShow(bookingId: string) {
    setNoShowError(null);
    setNoShowSubmitting(true);
    try {
      const res = await bookingApi.markNoShow(bookingId);
      setBookings((current) =>
        current.map((booking) =>
          booking.id === bookingId ? res.booking : booking,
        ),
      );
    } catch (err) {
      setNoShowError({
        id: bookingId,
        message:
          err instanceof Error ? err.message : t("bookings.errors.noShow"),
      });
    } finally {
      setNoShowSubmitting(false);
      setNoShowId(null);
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
      setError(err instanceof Error ? err.message : t("bookings.errors.cancel"));
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
        err instanceof Error ? err.message : t("bookings.errors.details"),
      );
    } finally {
      setDetailLoadingId(null);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-4 sm:p-8">
        <PageContainer width="reading">
          <div className="flex items-center justify-between gap-3">
            <Skeleton className="h-8 w-52" />
            <Skeleton className="h-11 w-44" />
          </div>
          <Card className="space-y-4 p-6" aria-busy="true">
            <span className="sr-only" role="status">
              {t("bookings.loading")}
            </span>
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </Card>
        </PageContainer>
      </div>
    );
  }

  if (profileMissing) {
    return (
      <div className="min-h-screen bg-background p-4 sm:p-8">
        <PageContainer width="reading">
          <ProPageHeader title={t("bookings.title")} />
          <Card className="p-6 text-center">
            <p className="text-foreground">
              {t("bookings.profileMissing")}
            </p>
            <Link to="/pro/profile" className={`${PRIMARY_LINK_CLASS} mt-4`}>
              {t("common.createProfile")}
            </Link>
          </Card>
        </PageContainer>
      </div>
    );
  }

  const cancellable = (status: BookingStatus) =>
    status === "PENDING" || status === "CONFIRMED";

  return (
    <div className="min-h-screen bg-background p-4 sm:p-8">
      <PageContainer width="reading">
        <ProPageHeader
          title={t("bookings.title")}
          description={t("bookings.description")}
        />

        {error && (
          <Alert variant="danger">
            <p>{error}</p>
            <Button
              variant="secondary"
              className="mt-3 min-h-[44px]"
              onClick={() => void loadBookings()}
            >
              {t("common.retry")}
            </Button>
          </Alert>
        )}
        {detailError && <Alert variant="danger">{detailError}</Alert>}

        {bookings.length === 0 && !error ? (
          <Card className="p-6 text-center">
            <p className="text-foreground-muted">
              {t("bookings.empty")}
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
                            {t("bookings.client", { name: booking.clientName })}
                          </p>
                        )}
                        <p className="mt-1 text-sm text-foreground">
                          {formatDateTime(booking.startAt)}
                        </p>
                        <p className="text-sm text-foreground-muted">
                          {label("servicePlace", booking.servicePlace)}
                        </p>
                        {booking.amountDueMinor !== null &&
                          booking.paymentStatus !== "NOT_REQUIRED" && (
                            <p className="text-sm text-foreground-muted">
                              {t(
                                booking.amountDueMinor < booking.priceMinor
                                  ? "bookings.amountDuePartial"
                                  : "bookings.amountDue",
                                {
                                  status: label(
                                    "bookingPaymentStatus",
                                    booking.paymentStatus,
                                  ),
                                  amount: formatCurrency(
                                    booking.amountDueMinor,
                                    booking.currency,
                                  ),
                                  total: formatCurrency(
                                    booking.priceMinor,
                                    booking.currency,
                                  ),
                                },
                              )}
                            </p>
                          )}
                        {booking.status === "CANCELLED" &&
                          booking.cancelledBy && (
                            <p className="mt-1 text-xs text-foreground-muted">
                              {booking.cancelledBy === "CLIENT"
                                ? t("bookings.cancelledBy.CLIENT")
                                : booking.cancelledBy === "ADMIN"
                                  ? t("bookings.cancelledBy.ADMIN")
                                  : t("bookings.cancelledBy.BARBER")}
                            </p>
                          )}
                        {booking.status === "DECLINED" &&
                          booking.declineReason && (
                            <p className="mt-1 text-xs text-foreground-muted">
                              {t("bookings.declineReasonShown", {
                                reason: booking.declineReason,
                              })}
                            </p>
                          )}
                        {booking.status === "PENDING" && booking.expiresAt && (
                          <p className="mt-1 text-xs text-foreground-muted">
                            {t("bookings.expiresAt", {
                              date: formatDateTime(booking.expiresAt),
                            })}
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
                              {t("bookings.clientAddress")}
                            </p>
                            <p className="mt-1 text-sm text-foreground">
                              {detail.clientAddress ??
                                t("bookings.noAddress")}
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
                              ? t("bookings.loadingShort")
                              : t("bookings.showAddress")}
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
                            {busy ? t("bookings.confirming") : t("bookings.confirm")}
                          </Button>
                        )}
                        {booking.status === "PENDING" &&
                          (decliningId === booking.id ? (
                            <div className="flex w-full flex-wrap items-center gap-2">
                              <Input
                                aria-label={t("bookings.declineReasonLabel")}
                                placeholder={t("bookings.declineReasonPlaceholder")}
                                maxLength={LIMITS.bookingDeclineReason}
                                value={declineReason}
                                onChange={(event) =>
                                  setDeclineReason(event.target.value)
                                }
                                className="min-w-0 flex-1"
                              />
                              <Button
                                variant="secondary"
                                className="min-h-[44px]"
                                disabled={busy}
                                onClick={() => {
                                  setDecliningId(null);
                                  setDeclineReason("");
                                }}
                              >
                                {t("bookings.no")}
                              </Button>
                              <Button
                                variant="danger"
                                className="min-h-[44px]"
                                disabled={busy}
                                onClick={() => void handleDecline(booking.id)}
                              >
                                {busy
                                  ? t("bookings.declining")
                                  : t("bookings.confirmDecline")}
                              </Button>
                            </div>
                          ) : (
                            <Button
                              variant="secondary"
                              className="min-h-[44px]"
                              disabled={busy}
                              onClick={() => {
                                setDecliningId(booking.id);
                                setDeclineReason("");
                              }}
                            >
                              {t("bookings.decline")}
                            </Button>
                          ))}
                        {booking.status === "CONFIRMED" &&
                          (isBookingEnded(booking.endAt, new Date()) ? (
                            <Button
                              className="min-h-[44px]"
                              disabled={busy}
                              onClick={() => void handleComplete(booking.id)}
                            >
                              {completingId === booking.id
                                ? t("bookings.completing")
                                : t("bookings.markCompleted")}
                            </Button>
                          ) : (
                            <span className="self-center text-sm text-foreground-muted">
                              {t("bookings.completeLater")}
                            </span>
                          ))}
                        {booking.status === "CONFIRMED" &&
                          canMarkNoShow(booking.startAt, new Date()) && (
                            <Button
                              variant="secondary"
                              className="min-h-[44px]"
                              disabled={busy}
                              onClick={() => setNoShowId(booking.id)}
                            >
                              {t("bookings.markNoShow")}
                            </Button>
                          )}
                        {cancellable(booking.status) &&
                          (confirmingId === booking.id ? (
                            <>
                              <span className="self-center text-sm text-danger">
                                {t("bookings.cancelQuestion")}
                              </span>
                              <Button
                                variant="secondary"
                                className="min-h-[44px]"
                                disabled={busy}
                                onClick={() => setConfirmingId(null)}
                              >
                                {t("bookings.no")}
                              </Button>
                              <Button
                                variant="danger"
                                className="min-h-[44px]"
                                disabled={busy}
                                onClick={() => void handleCancel(booking.id)}
                              >
                                {busy
                                  ? t("bookings.cancelling")
                                  : t("bookings.confirmCancel")}
                              </Button>
                            </>
                          ) : (
                            <Button
                              variant="secondary"
                              className="min-h-[44px]"
                              disabled={busy}
                              onClick={() => setConfirmingId(booking.id)}
                            >
                              {t("bookings.cancel")}
                            </Button>
                          ))}
                        {noShowError?.id === booking.id && (
                          <p
                            role="alert"
                            className="w-full text-sm text-danger"
                          >
                            {noShowError.message}
                          </p>
                        )}
                      </div>
                    )}
                  </Card>
                </li>
              );
            })}
          </ul>
        )}
      </PageContainer>
      <ConfirmDialog
        open={noShowId !== null}
        title={t("bookings.noShowDialog.title")}
        confirmLabel={t("bookings.noShowDialog.confirm")}
        tone="danger"
        isLoading={noShowSubmitting}
        onConfirm={() => noShowId && void handleNoShow(noShowId)}
        onCancel={() => setNoShowId(null)}
      >
        {t("bookings.noShowDialog.body")}
      </ConfirmDialog>
    </div>
  );
}
