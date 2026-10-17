import { and, eq, gt, inArray, isNull, or } from "drizzle-orm";
import { bookings } from "@findbarber/shared/schema";
import { ACTIVE_BOOKING_STATUSES, LIMITS } from "@findbarber/shared/constants";

const MS_PER_HOUR = 3_600_000;

// Réservations qui occupent un créneau à l'instant `now` : CONFIRMED, et
// PENDING non échues. Une demande échue (24 h ou début atteint) libère le
// créneau dès la lecture, avant même que le balayage ne persiste son statut
// EXPIRED. Règle unique, partagée par le calcul des créneaux d'un jour et par
// la disponibilité affichée dans la recherche (lot N1).
export function occupiesSlotCondition(now: Date) {
  const ttlStart = new Date(
    now.getTime() - LIMITS.bookingPendingTtlHours * MS_PER_HOUR,
  );
  return and(
    inArray(bookings.status, [...ACTIVE_BOOKING_STATUSES]),
    or(
      eq(bookings.status, "CONFIRMED"),
      and(
        gt(bookings.createdAt, ttlStart),
        gt(bookings.startAt, now),
        // Demande non payée (issue #10) : bloque seulement jusqu'à
        // l'échéance du paiement.
        or(isNull(bookings.paymentExpiresAt), gt(bookings.paymentExpiresAt, now)),
      ),
    ),
  );
}
