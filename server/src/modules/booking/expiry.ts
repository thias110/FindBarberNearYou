import { and, eq, lte, or, sql } from "drizzle-orm";
import { db } from "../../db/client.js";
import { barberProfiles, bookings } from "@findbarber/shared/schema";
import { LIMITS } from "@findbarber/shared/constants";
import { notifyBookingEvent } from "../notification/service.js";

// --- Expiration des demandes PENDING (lot 4 rouvert) ---
// Une demande sans réponse expire 24 h après sa création, ou au début du
// rendez-vous s'il arrive avant (`pendingBookingExpiresAt`). La JUSTESSE ne
// dépend pas de ce balayage : une demande échue ne bloque plus le créneau
// (`loadBusy`), ne peut plus être confirmée ni refusée, et s'affiche EXPIRED.
// Le balayage PERSISTE seulement le statut et notifie client et barber.
// L'UPDATE gardé par `status = 'PENDING'` est idempotent et sûr entre
// plusieurs instances (une ligne n'expire qu'une fois).

const SWEEP_INTERVAL_MS = 5 * 60_000;

function stalePendingCondition(now: Date) {
  const ttlStart = new Date(
    now.getTime() - LIMITS.bookingPendingTtlHours * 3_600_000,
  );
  return and(
    eq(bookings.status, "PENDING"),
    or(lte(bookings.createdAt, ttlStart), lte(bookings.startAt, now)),
  );
}

/**
 * Passe en EXPIRED les demandes PENDING échues (toutes, ou celles d'un barber)
 * et notifie client et barber. `runner` doit être une transaction : l'appelant
 * garantit l'atomicité statut + notifications. Retourne le nombre expiré.
 */
export async function expireStalePendingBookings(
  runner: typeof db,
  now: Date,
  barberProfileId?: string,
): Promise<number> {
  const condition = barberProfileId
    ? and(stalePendingCondition(now), eq(bookings.barberProfileId, barberProfileId))
    : stalePendingCondition(now);

  const expired = await runner
    .update(bookings)
    .set({ status: "EXPIRED", updatedAt: now })
    .where(condition)
    .returning({
      id: bookings.id,
      clientUserId: bookings.clientUserId,
      barberUserId: sql<string>`(select ${barberProfiles.userId} from ${barberProfiles} where ${barberProfiles.id} = ${bookings.barberProfileId})`,
    });

  for (const row of expired) {
    for (const recipientUserId of [row.clientUserId, row.barberUserId]) {
      if (!recipientUserId) continue;
      await notifyBookingEvent(runner, {
        recipientUserId,
        actorUserId: null,
        bookingId: row.id,
        type: "BOOKING_EXPIRED",
      });
    }
  }
  return expired.length;
}

/** Balayage global, dans sa propre transaction. */
export async function sweepExpiredPendingBookings(
  now: Date = new Date(),
): Promise<number> {
  return db.transaction((tx) =>
    expireStalePendingBookings(tx as unknown as typeof db, now),
  );
}

/**
 * Démarre le balayage périodique dans le process serveur (hébergement réel :
 * process Node long, cf. docker-compose). Un premier passage a lieu au
 * démarrage. Le timer n'empêche pas l'arrêt du process.
 */
export function startPendingExpirySweeper(
  intervalMs: number = SWEEP_INTERVAL_MS,
): () => void {
  const run = () => {
    sweepExpiredPendingBookings().catch((err: unknown) => {
      console.error("[booking-expiry] échec du balayage", err);
    });
  };
  run();
  const timer = setInterval(run, intervalMs);
  timer.unref();
  return () => clearInterval(timer);
}
