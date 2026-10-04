import { SERVICE_PLACE_LABELS } from "@findbarber/shared/constants";
import type { Booking, BookingDetails } from "@findbarber/shared/types";
import {
  formatCurrency,
  formatDateTime,
  formatDuration,
} from "../../lib/formatters";
import { BookingStatusBadge } from "../BookingStatusBadge";
import { ReviewForm } from "../ReviewForm";
import { Alert } from "../ui/Alert";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";

function cancelledByLabel(cancelledBy: string): string {
  if (cancelledBy === "CLIENT") return "vous";
  if (cancelledBy === "ADMIN") return "l'administration";
  return "le professionnel";
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
  onSubmitReview: (input: {
    rating: number;
    comment: string;
  }) => Promise<void>;
}

// Composant présentational : aucun appel API ici, tout l'état et les handlers
// restent dans BookingsPage.
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
  return (
    <Card className="p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold text-foreground">{booking.serviceName}</p>
          <p className="text-sm text-foreground-muted">
            avec {booking.barberDisplayName}
          </p>
          <p className="mt-1 text-sm text-foreground">
            {formatDateTime(booking.startAt)}
          </p>
          <p className="text-sm text-foreground-muted">
            {SERVICE_PLACE_LABELS[booking.servicePlace]} ·{" "}
            {formatDuration(booking.durationMinutes)} ·{" "}
            {formatCurrency(booking.priceMinor, booking.currency)}
          </p>
          {booking.status === "CANCELLED" && booking.cancelledBy && (
            <p className="mt-1 text-xs text-foreground-muted">
              Annulée par {cancelledByLabel(booking.cancelledBy)}.
            </p>
          )}
        </div>
        <BookingStatusBadge status={booking.status} />
      </div>

      {booking.servicePlace === "AT_CLIENT" && (
        <div className="mt-3 border-t border-border pt-3">
          {detail ? (
            <div className="rounded-lg bg-surface-muted p-3">
              <p className="text-xs font-medium uppercase tracking-wide text-foreground-muted">
                Adresse de la prestation
              </p>
              <p className="mt-1 text-sm text-foreground">
                {detail.clientAddress ?? "Adresse non renseignée."}
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
              Voir l'adresse
            </Button>
          )}
        </div>
      )}

      {booking.status === "COMPLETED" && (
        <div className="mt-3 border-t border-border pt-3">
          {booking.hasReview ? (
            <p className="text-sm text-foreground-muted">
              {reviewThanks
                ? "Merci, votre avis a été enregistré."
                : "Vous avez déjà laissé un avis."}
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
              Laisser un avis
            </Button>
          )}
        </div>
      )}

      {cancellable && (
        <div className="mt-3 border-t border-border pt-3">
          {confirming ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium text-danger">
                Annuler ce rendez-vous ?
              </span>
              <Button
                type="button"
                variant="secondary"
                className="min-h-[44px]"
                disabled={busy}
                onClick={onAbortCancel}
              >
                Non
              </Button>
              <Button
                type="button"
                variant="danger"
                className="min-h-[44px]"
                isLoading={busy}
                disabled={busy}
                onClick={onConfirmCancel}
              >
                Confirmer l'annulation
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
              Annuler
            </Button>
          )}

          {cancelError && (
            <Alert variant="danger" className="mt-2">
              {cancelError}
            </Alert>
          )}
          <p className="mt-2 text-xs text-foreground-muted">
            L'annulation est soumise aux conditions applicables.
          </p>
        </div>
      )}
    </Card>
  );
}
