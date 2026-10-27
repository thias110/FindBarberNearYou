import { and, isNull, notInArray, sql, type SQL } from "drizzle-orm";
import { bookings } from "@findbarber/shared/schema";

// --- Règles de paiement partagées (issue #10) ---

/**
 * Statut de paiement à poser lors d'une annulation, d'un refus ou d'une
 * expiration : un paiement reçu doit être remboursé ; un paiement jamais reçu
 * est abandonné ; sinon inchangé.
 */
export const paymentStatusOnCancel: SQL = sql`CASE ${bookings.paymentStatus}
  WHEN 'PAID' THEN 'REFUND_PENDING'::booking_payment_status
  WHEN 'REQUIRES_PAYMENT' THEN 'CANCELLED'::booking_payment_status
  ELSE ${bookings.paymentStatus} END`;

/**
 * Réservations visibles par le barber (liste, détail, statistiques) : une
 * demande pas encore payée, ou abandonnée faute de paiement, n'existe pas pour
 * lui ; une réservation express dont l'email n'a pas été confirmé non plus
 * (lot N6).
 */
export const visibleToBarber: SQL = and(
  notInArray(bookings.paymentStatus, ["REQUIRES_PAYMENT", "CANCELLED"]),
  isNull(bookings.emailConfirmExpiresAt),
)!;

/** Même règle, sur une ligne déjà lue (détail et transitions). */
export function hiddenFromBarber(row: {
  paymentStatus: string;
  emailConfirmExpiresAt: Date | null;
}): boolean {
  return (
    row.paymentStatus === "REQUIRES_PAYMENT" ||
    row.paymentStatus === "CANCELLED" ||
    row.emailConfirmExpiresAt !== null
  );
}

// Calcul partagé avec le client (annonce du montant avant réservation).
export { amountDueOnline } from "@findbarber/shared/booking";
