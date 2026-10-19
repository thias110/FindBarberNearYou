import type { TFunction } from "i18next";
import { useTranslation } from "react-i18next";
import type { Booking, BookingDetails } from "@findbarber/shared/types";
import {
  formatCurrency,
  formatDateTime,
  formatDuration,
} from "../../lib/formatters";
import { label } from "../../lib/labels";
import { BookingStatusBadge } from "../BookingStatusBadge";
import { ReviewForm } from "../ReviewForm";
import { Alert } from "../ui/Alert";
import { Button } from "../ui/Button";
import { buttonClasses } from "../ui/buttonStyles";
import { Card } from "../ui/Card";

function cancelledByLabel(cancelledBy: string, t: TFunction<"client">): string {
  if (cancelledBy === "CLIENT") return t("bookings.card.cancelledBy.client");
  if (cancelledBy === "ADMIN") return t("bookings.card.cancelledBy.admin");
  return t("bookings.card.cancelledBy.barber");
}

export interface BookingCardProps {
  booking: Booking;
  detail: BookingDetails | undefined;
  /** Règle métier calculée par la page (PENDING/CONFIRMED). */
  cancellable: boolean;
  /** Annulation en cours pour ce rendez-vous. */
  busy: boolean;
  /** Confirmation inline en deux étapes ouverte. */
  confirming: boolean;
  cancelError: string | null;
  detailLoading: boolean;
  reviewFormOpen: boolean;
  reviewSubmitting: boolean;
  reviewThanks: boolean;
  reviewError: string | null;
  onRequestCancel: () => void;
  onConfirmCancel: () => void;
  onAbortCancel: () => void;
  onShowAddress: () => void;
  onOpenReview: () => void;
  onCloseReview: () => void;
  onSubmitReview: (input: { rating: number; comment: string }) => Promise<void>;
}

// Composant présentational : aucun appel API ici, tout l'état et les handlers
// restent dans BookingsPage.
// Lien d'itinéraire universel : ouvre l'application de cartes sur mobile.
function directionsUrl(address: string): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`;
}

export function BookingCard({
  booking,
  detail,
  cancellable,
  busy,
  confirming,
  cancelError,
  detailLoading,
  reviewFormOpen,
  reviewSubmitting,
  reviewThanks,
  reviewError,
  onRequestCancel,
  onConfirmCancel,
  onAbortCancel,
  onShowAddress,
  onOpenReview,
  onCloseReview,
  onSubmitReview,
}: BookingCardProps) {
  const { t } = useTranslation("client");
  return (
    <Card className="p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold text-foreground">{booking.serviceName}</p>
          <p className="text-sm text-foreground-muted">
            {t("bookings.card.with", { name: booking.barberDisplayName })}
          </p>
          <p className="mt-1 text-sm text-foreground">
            {formatDateTime(booking.startAt)}
          </p>
          <p className="text-sm text-foreground-muted">
            {label("servicePlace", booking.servicePlace)} ·{" "}
            {formatDuration(booking.durationMinutes)} ·{" "}
            {formatCurrency(booking.priceMinor, booking.currency)}
          </p>
          {booking.status === "CANCELLED" && booking.cancelledBy && (
            <p className="mt-1 text-xs text-foreground-muted">
              {cancelledByLabel(booking.cancelledBy, t)}
            </p>
          )}
          {booking.status === "DECLINED" && (
            <p className="mt-1 text-xs text-foreground-muted">
              {booking.declineReason
                ? t("bookings.card.declinedWithReason", {
                    reason: booking.declineReason,
                  })
                : t("bookings.card.declined")}
            </p>
          )}
          {booking.status === "NO_SHOW" && (
            <p className="mt-1 text-xs text-foreground-muted">
              {t("bookings.card.noShowReported")}
            </p>
          )}
          {booking.status === "EXPIRED" && (
            <p className="mt-1 text-xs text-foreground-muted">
              {booking.paymentStatus === "CANCELLED"
                ? t("bookings.card.expiredUnpaid")
                : t("bookings.card.expiredNoAnswer")}
            </p>
          )}
          {booking.status === "PENDING" &&
            booking.expiresAt &&
            booking.paymentStatus !== "REQUIRES_PAYMENT" && (
              <p className="mt-1 text-xs text-foreground-muted">
                {t("bookings.card.pendingUntil", {
                  date: formatDateTime(booking.expiresAt),
                })}
              </p>
            )}
          {booking.amountDueMinor !== null &&
            booking.paymentStatus !== "NOT_REQUIRED" && (
              <p className="mt-1 text-xs text-foreground-muted">
                {label("bookingPaymentStatus", booking.paymentStatus)} ·{" "}
                {formatCurrency(booking.amountDueMinor, booking.currency)}
                {booking.amountDueMinor < booking.priceMinor
                  ? ` ${t("bookings.card.deposit")}`
                  : ""}
              </p>
            )}
        </div>
        <BookingStatusBadge status={booking.status} />
      </div>

      {booking.checkoutUrl && (
        <Alert variant="warning" className="mt-3">
          <p>
            {booking.expiresAt
              ? t("bookings.card.paymentPendingBefore", {
                  date: formatDateTime(booking.expiresAt),
                })
              : t("bookings.card.paymentPending")}
          </p>
          <a
            href={booking.checkoutUrl}
            className={buttonClasses("primary", "md", "mt-3")}
          >
            {t("bookings.card.payNow")}
          </a>
        </Alert>
      )}

      {booking.servicePlace === "AT_CLIENT" && (
        <div className="mt-3 border-t border-border pt-3">
          {detail ? (
            <div className="rounded-lg bg-surface-muted p-3">
              <p className="text-xs font-semibold text-foreground-muted">
                {t("bookings.card.address")}
              </p>
              <p className="mt-1 text-sm text-foreground">
                {detail.clientAddress ?? t("bookings.card.addressMissing")}
              </p>
            </div>
          ) : (
            <Button
              type="button"
              variant="secondary"
              className="min-h-[44px]"
              isLoading={detailLoading}
              disabled={detailLoading}
              onClick={onShowAddress}
            >
              {t("bookings.card.showAddress")}
            </Button>
          )}
        </div>
      )}

      {/* Itinéraire (lot N3) : seulement une fois le rendez-vous confirmé et
          si le client se déplace. L'adresse exacte du barber n'est fournie
          que par le détail de la réservation, à son seul client. */}
      {booking.status === "CONFIRMED" &&
        (booking.servicePlace === "SALON" ||
          booking.servicePlace === "AT_PROVIDER") && (
          <div className="mt-3 border-t border-border pt-3">
            {detail ? (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-surface-muted p-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground">
                    {t("bookings.card.barberAddress")}
                  </p>
                  <p className="mt-1 text-sm text-foreground">
                    {detail.barberAddress ?? t("bookings.card.barberAddressMissing")}
                  </p>
                </div>
                {detail.barberAddress && (
                  <a
                    href={directionsUrl(detail.barberAddress)}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={t("bookings.card.directionsAria", {
                      address: detail.barberAddress,
                    })}
                    className={buttonClasses("primary", "sm", "shrink-0")}
                  >
                    {t("bookings.card.directions")}
                  </a>
                )}
              </div>
            ) : (
              <Button
                type="button"
                variant="secondary"
                isLoading={detailLoading}
                onClick={onShowAddress}
              >
                {t("bookings.card.showDirections")}
              </Button>
            )}
          </div>
        )}

      {booking.status === "COMPLETED" && (
        <div className="mt-3 border-t border-border pt-3">
          {booking.hasReview ? (
            <p className="text-sm text-foreground-muted">
              {reviewThanks
                ? t("bookings.card.reviewThanks")
                : t("bookings.card.reviewAlreadyLeft")}
            </p>
          ) : reviewFormOpen ? (
            <ReviewForm
              onSubmit={onSubmitReview}
              submitting={reviewSubmitting}
              onCancel={onCloseReview}
              serverError={reviewError}
            />
          ) : (
            <Button
              type="button"
              variant="secondary"
              className="min-h-[44px]"
              disabled={reviewSubmitting}
              onClick={onOpenReview}
            >
              {t("bookings.card.leaveReview")}
            </Button>
          )}
        </div>
      )}

      {cancellable && (
        <div className="mt-3 border-t border-border pt-3">
          {confirming ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium text-danger">
                {t("bookings.card.cancelConfirmQuestion")}
              </span>
              <Button
                type="button"
                variant="secondary"
                className="min-h-[44px]"
                disabled={busy}
                onClick={onAbortCancel}
              >
                {t("bookings.card.cancelNo")}
              </Button>
              <Button
                type="button"
                variant="danger"
                className="min-h-[44px]"
                isLoading={busy}
                disabled={busy}
                onClick={onConfirmCancel}
              >
                {t("bookings.card.cancelConfirm")}
              </Button>
            </div>
          ) : (
            <Button
              type="button"
              variant="secondary"
              className="min-h-[44px]"
              disabled={busy}
              onClick={onRequestCancel}
            >
              {t("bookings.card.cancel")}
            </Button>
          )}

          {cancelError && (
            <Alert variant="danger" className="mt-2">
              {cancelError}
            </Alert>
          )}
          <p className="mt-2 text-xs text-foreground-muted">
            {t("bookings.card.cancelTerms")}
          </p>
        </div>
      )}
    </Card>
  );
}
