import { notInArray, sql, type SQL } from "drizzle-orm";
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
 * lui.
 */
export const visibleToBarber: SQL = notInArray(bookings.paymentStatus, [
  "REQUIRES_PAYMENT",
  "CANCELLED",
]);

// Calcul partagé avec le client (annonce du montant avant réservation).
export { amountDueOnline } from "@findbarber/shared/booking";
