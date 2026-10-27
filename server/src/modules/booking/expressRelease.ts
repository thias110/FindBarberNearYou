import { and, desc, eq, gt, isNotNull } from "drizzle-orm";
import { db } from "../../db/client.js";
import { barberProfiles, bookings } from "@findbarber/shared/schema";
import type { ExpressBookingOutcome } from "@findbarber/shared/types";
import { notifyBookingEvent } from "../notification/service.js";

// --- Réservation express : confirmation de l'email (lot N6) ---
// Au clic sur le lien, la demande en attente devient une demande ordinaire :
// l'échéance d'email est effacée (le barber la voit) et le barber est prévenu,
// exactement comme à la création d'une demande. Passé l'échéance, la demande a
// expiré (le créneau est déjà libéré) : rien n'est envoyé au barber.

/**
 * Transmet les demandes express encore valables du compte `userId` et rend le
 * sort de la plus récente (ou `null` si le compte n'en a pas). L'UPDATE gardé
 * par le statut et l'échéance est idempotent : une demande n'est transmise
 * qu'une fois, même si deux vérifications se croisent.
 */
export async function releaseExpressBookings(
  userId: string,
  now: Date = new Date(),
): Promise<ExpressBookingOutcome | null> {
  return db.transaction(async (tx) => {
    const runner = tx as unknown as typeof db;
    const awaiting = await runner
      .select({
        id: bookings.id,
        barberId: bookings.barberProfileId,
        barberName: bookings.barberDisplayName,
        barberUserId: barberProfiles.userId,
      })
      .from(bookings)
      .innerJoin(barberProfiles, eq(barberProfiles.id, bookings.barberProfileId))
      .where(
        and(
          eq(bookings.clientUserId, userId),
          isNotNull(bookings.emailConfirmExpiresAt),
        ),
      )
      .orderBy(desc(bookings.createdAt));
    if (awaiting.length === 0) return null;

    let latest: ExpressBookingOutcome | null = null;
    for (const booking of awaiting) {
      const [released] = await runner
        .update(bookings)
        .set({ emailConfirmExpiresAt: null, updatedAt: now })
        .where(
          and(
            eq(bookings.id, booking.id),
            eq(bookings.status, "PENDING"),
            gt(bookings.emailConfirmExpiresAt, now),
            // Le rendez-vous ne doit pas avoir commencé entre-temps.
            gt(bookings.startAt, now),
          ),
        )
        .returning({ id: bookings.id });
      if (released) {
        await notifyBookingEvent(runner, {
          recipientUserId: booking.barberUserId,
          actorUserId: userId,
          bookingId: booking.id,
          type: "BOOKING_REQUESTED",
        });
      }
      latest ??= {
        status: released ? "SENT" : "EXPIRED",
        barberName: booking.barberName,
        barberId: booking.barberId,
      };
    }
    return latest;
  });
}
