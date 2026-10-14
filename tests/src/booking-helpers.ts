// Helpers partagés des tests d'intégration de réservation. Une réservation ne
// peut être marquée COMPLETED qu'après sa fin réelle : les suites qui testent
// la terminaison déplacent donc la réservation (créée dans le futur via l'API)
// dans le passé, directement en base.
import { eq } from "drizzle-orm";
import { db } from "../../server/src/db/client";
import { bookings } from "@findbarber/shared/schema";

export async function moveBookingToPast(bookingId: string): Promise<void> {
  const now = Date.now();
  await db
    .update(bookings)
    .set({
      startAt: new Date(now - 2 * 60 * 60 * 1000),
      endAt: new Date(now - 60 * 60 * 1000),
    })
    .where(eq(bookings.id, bookingId));
}
