import { randomUUID } from "node:crypto";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { db, type Db } from "../../db/client.js";
import {
  notifications,
  users,
  type NotificationRow,
} from "@findbarber/shared/schema";
import type { NotificationType } from "@findbarber/shared/constants";
import type { Notification } from "@findbarber/shared/types";
import { AppError, isUniqueViolation } from "../../lib/errors.js";

function toNotification(row: NotificationRow): Notification {
  return {
    id: row.id,
    type: row.type,
    bookingId: row.bookingId,
    readAt: row.readAt ? row.readAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
  };
}

/**
 * Crée une notification de réservation, à appeler **dans la même transaction**
 * que la mutation métier qui l'a déclenchée (atomicité + dédoublonnage).
 * - Ne notifie jamais un destinataire SUSPENDED.
 * - Violation d'unicité (user_id, type, booking_id) → no-op propre.
 */
export async function notifyBookingEvent(
  runner: Db,
  input: {
    recipientUserId: string;
    actorUserId: string | null;
    bookingId: string;
    type: NotificationType;
  },
): Promise<void> {
  const [recipient] = await runner
    .select({ status: users.status })
    .from(users)
    .where(eq(users.id, input.recipientUserId))
    .limit(1);
  if (!recipient || recipient.status !== "ACTIVE") {
    return;
  }

  try {
    await runner.insert(notifications).values({
      id: randomUUID(),
      userId: input.recipientUserId,
      actorUserId: input.actorUserId,
      bookingId: input.bookingId,
      type: input.type,
    });
  } catch (err) {
    if (isUniqueViolation(err)) {
      return;
    }
    throw err;
  }
}

export async function listNotifications(
  userId: string,
  limit: number,
): Promise<Notification[]> {
  const rows = await db
    .select()
    .from(notifications)
    .where(eq(notifications.userId, userId))
    .orderBy(desc(notifications.createdAt), desc(notifications.id))
    .limit(limit);
  return rows.map(toNotification);
}

export async function unreadCount(userId: string): Promise<number> {
  const [row] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(notifications)
    .where(
      and(eq(notifications.userId, userId), isNull(notifications.readAt)),
    );
  return Number(row?.total ?? 0);
}

// Marque une notification comme lue. Idempotent (re-marquer une notification
// déjà lue ne renvoie pas d'erreur). Une notification d'autrui → 404, comme si
// elle n'existait pas (aucune fuite d'existence).
export async function markRead(
  userId: string,
  notificationId: string,
): Promise<void> {
  const [updated] = await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(
      and(
        eq(notifications.id, notificationId),
        eq(notifications.userId, userId),
      ),
    )
    .returning({ id: notifications.id });
  if (!updated) {
    throw new AppError(404, "NOTIFICATION_NOT_FOUND", "Notification introuvable.");
  }
}

// Marque toutes les notifications non lues de l'utilisateur comme lues.
// Idempotent : aucune notification non lue → aucun changement, pas d'erreur.
export async function markAllRead(userId: string): Promise<void> {
  await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(
      and(eq(notifications.userId, userId), isNull(notifications.readAt)),
    );
}
