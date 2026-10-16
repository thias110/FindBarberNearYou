import { randomUUID } from "node:crypto";
import { and, asc, eq, gt, inArray, isNull, lt, lte, or } from "drizzle-orm";
import { db, type Db } from "../../db/client.js";
import {
  barberProfiles,
  bookings,
  emailOutbox,
  users,
} from "@findbarber/shared/schema";
import {
  LIMITS,
  type EmailKind,
  type NotificationType,
} from "@findbarber/shared/constants";
import { bookingEmail } from "../../lib/emailTemplates.js";
import { sendMail } from "../../lib/mailer.js";

// --- File d'envoi des emails de réservation (issue #9) ---
// 1. `enqueueBookingEmail` est appelé DANS la transaction de la mutation : pas
//    d'email pour une action annulée, pas d'action réussie sans email.
// 2. `dispatchEmailOutbox` envoie après commit, hors de toute transaction : un
//    échec SMTP ne casse jamais une réservation ; la ligne est retentée avec un
//    délai croissant puis marquée FAILED.
// 3. `enqueueDueReminders` met en file le rappel J-1, une seule fois.

const MAX_ATTEMPTS = 6;
// Délais avant nouvelle tentative (après l'échec n°1, n°2, …).
const RETRY_DELAYS_MS = [
  60_000,
  5 * 60_000,
  30 * 60_000,
  2 * 3_600_000,
  6 * 3_600_000,
];
// Une ligne SENDING plus ancienne est considérée abandonnée (process tué).
const STALE_SENDING_MS = 10 * 60_000;
// Rétention : données personnelles (adresse, contenu), purgées rapidement.
const SENT_RETENTION_MS = 7 * 86_400_000;
const FAILED_RETENTION_MS = 30 * 86_400_000;

const DEFAULT_TIMEZONE = "Europe/Zurich";

/** Type de notification → email envoyé au même destinataire (ou aucun). */
function emailKindFor(
  type: NotificationType,
  recipientIsClient: boolean,
): EmailKind | null {
  switch (type) {
    case "BOOKING_REQUESTED":
    case "BOOKING_CONFIRMED":
    case "BOOKING_DECLINED":
    case "BOOKING_CANCELLED_BY_CLIENT":
    case "BOOKING_CANCELLED_BY_BARBER":
    case "BOOKING_CANCELLED_BY_ADMIN":
      return type;
    case "BOOKING_EXPIRED":
      // L'expiration n'est envoyée par email qu'au client (le barber garde la
      // notification dans l'application).
      return recipientIsClient ? "BOOKING_EXPIRED" : null;
    case "BOOKING_COMPLETED":
      return null;
  }
}

/**
 * Met en file l'email correspondant à une notification de réservation, dans
 * la transaction appelante. Ne fait rien pour un compte non actif ou un type
 * sans email. Idempotent grâce à `dedupe_key`.
 */
export async function enqueueEmailForNotification(
  runner: Db,
  input: { recipientUserId: string; bookingId: string; type: NotificationType },
): Promise<void> {
  const [booking] = await runner
    .select({ clientUserId: bookings.clientUserId })
    .from(bookings)
    .where(eq(bookings.id, input.bookingId))
    .limit(1);
  if (!booking) return;
  const kind = emailKindFor(
    input.type,
    booking.clientUserId === input.recipientUserId,
  );
  if (!kind) return;
  await enqueueBookingEmail(runner, {
    kind,
    recipientUserId: input.recipientUserId,
    bookingId: input.bookingId,
  });
}

export async function enqueueBookingEmail(
  runner: Db,
  input: { kind: EmailKind; recipientUserId: string; bookingId: string },
): Promise<void> {
  const [recipient] = await runner
    .select({
      email: users.email,
      name: users.name,
      status: users.status,
      locale: users.locale,
    })
    .from(users)
    .where(eq(users.id, input.recipientUserId))
    .limit(1);
  if (!recipient || recipient.status !== "ACTIVE") return;

  const [row] = await runner
    .select({
      booking: bookings,
      timezone: barberProfiles.timezone,
      barberUserId: barberProfiles.userId,
    })
    .from(bookings)
    .innerJoin(barberProfiles, eq(bookings.barberProfileId, barberProfiles.id))
    .where(eq(bookings.id, input.bookingId))
    .limit(1);
  if (!row) return;

  const [client] = await runner
    .select({ name: users.name })
    .from(users)
    .where(eq(users.id, row.booking.clientUserId))
    .limit(1);

  const message = bookingEmail(
    input.kind,
    {
      to: recipient.email,
      // Langue du DESTINATAIRE, jamais celle de l'auteur de l'action.
      locale: recipient.locale,
      recipientName: recipient.name,
      barberName: row.booking.barberDisplayName,
      barberProfileId: row.booking.barberProfileId,
      clientName: client?.name ?? null,
      serviceName: row.booking.serviceName,
      servicePlace: row.booking.servicePlace,
      startAt: row.booking.startAt,
      timeZone: row.timezone ?? DEFAULT_TIMEZONE,
      declineReason: row.booking.declineReason,
    },
    row.barberUserId === input.recipientUserId,
  );

  await runner
    .insert(emailOutbox)
    .values({
      id: randomUUID(),
      recipientUserId: input.recipientUserId,
      toEmail: message.to,
      kind: input.kind,
      bookingId: input.bookingId,
      dedupeKey: `${input.bookingId}:${input.kind}:${input.recipientUserId}`,
      subject: message.subject,
      textBody: message.text,
      htmlBody: message.html,
    })
    .onConflictDoNothing({ target: emailOutbox.dedupeKey });
}

/**
 * Rappels J-1 : réservations CONFIRMED qui commencent dans moins de 24 h (et
 * plus d'une heure). `reminder_sent_at` est posé dans la même transaction que
 * la mise en file : un seul rappel par réservation, même avec plusieurs
 * instances. Retourne le nombre de rappels mis en file.
 */
export async function enqueueDueReminders(
  now: Date = new Date(),
): Promise<number> {
  const windowStart = new Date(
    now.getTime() + LIMITS.bookingReminderMinMinutesBefore * 60_000,
  );
  const windowEnd = new Date(
    now.getTime() + LIMITS.bookingReminderHoursBefore * 3_600_000,
  );
  return db.transaction(async (tx) => {
    const runner = tx as unknown as Db;
    const due = await runner
      .update(bookings)
      .set({ reminderSentAt: now })
      .where(
        and(
          eq(bookings.status, "CONFIRMED"),
          isNull(bookings.reminderSentAt),
          gt(bookings.startAt, windowStart),
          lte(bookings.startAt, windowEnd),
        ),
      )
      .returning({ id: bookings.id, clientUserId: bookings.clientUserId });
    for (const booking of due) {
      await enqueueBookingEmail(runner, {
        kind: "BOOKING_REMINDER",
        recipientUserId: booking.clientUserId,
        bookingId: booking.id,
      });
    }
    return due.length;
  });
}

function retryDelay(attempts: number): number {
  return RETRY_DELAYS_MS[Math.min(attempts - 1, RETRY_DELAYS_MS.length - 1)];
}

/**
 * Envoie les emails dus. Chaque ligne est d'abord réservée (PENDING → SENDING,
 * UPDATE gardé) pour qu'aucune autre instance ne l'envoie en double.
 */
export async function dispatchEmailOutbox(
  now: Date = new Date(),
  limit = 25,
): Promise<{ sent: number; failed: number }> {
  // Lignes abandonnées en SENDING (process arrêté pendant l'envoi).
  await db
    .update(emailOutbox)
    .set({ status: "PENDING", updatedAt: now })
    .where(
      and(
        eq(emailOutbox.status, "SENDING"),
        lt(emailOutbox.updatedAt, new Date(now.getTime() - STALE_SENDING_MS)),
      ),
    );

  const due = await db
    .select({ id: emailOutbox.id })
    .from(emailOutbox)
    .where(
      and(
        eq(emailOutbox.status, "PENDING"),
        lte(emailOutbox.nextAttemptAt, now),
      ),
    )
    .orderBy(asc(emailOutbox.createdAt))
    .limit(limit);

  let sent = 0;
  let failed = 0;
  for (const { id } of due) {
    const [claimed] = await db
      .update(emailOutbox)
      .set({ status: "SENDING", updatedAt: now })
      .where(and(eq(emailOutbox.id, id), eq(emailOutbox.status, "PENDING")))
      .returning();
    if (!claimed) continue;

    try {
      await sendMail({
        to: claimed.toEmail,
        subject: claimed.subject,
        text: claimed.textBody,
        html: claimed.htmlBody,
      });
      await db
        .update(emailOutbox)
        .set({
          status: "SENT",
          sentAt: new Date(),
          lastError: null,
          updatedAt: new Date(),
        })
        .where(eq(emailOutbox.id, id));
      sent += 1;
    } catch (err) {
      const attempts = claimed.attempts + 1;
      const message = err instanceof Error ? err.message : String(err);
      await db
        .update(emailOutbox)
        .set({
          status: attempts >= MAX_ATTEMPTS ? "FAILED" : "PENDING",
          attempts,
          lastError: message.slice(0, 500),
          nextAttemptAt: new Date(now.getTime() + retryDelay(attempts)),
          updatedAt: new Date(),
        })
        .where(eq(emailOutbox.id, id));
      console.error(
        `[email] échec d'envoi (${claimed.kind}, tentative ${attempts}) : ${message}`,
      );
      failed += 1;
    }
  }
  return { sent, failed };
}

/** Purge les emails envoyés (7 j) et abandonnés (30 j). */
export async function purgeEmailOutbox(now: Date = new Date()): Promise<void> {
  await db
    .delete(emailOutbox)
    .where(
      or(
        and(
          eq(emailOutbox.status, "SENT"),
          lt(emailOutbox.sentAt, new Date(now.getTime() - SENT_RETENTION_MS)),
        ),
        and(
          inArray(emailOutbox.status, ["FAILED"]),
          lt(
            emailOutbox.updatedAt,
            new Date(now.getTime() - FAILED_RETENTION_MS),
          ),
        ),
      ),
    );
}

// --- Répartiteur périodique (process serveur) ---

let workerStarted = false;
let running = false;
let rerun = false;

async function runCycle(): Promise<void> {
  if (running) {
    rerun = true;
    return;
  }
  running = true;
  try {
    do {
      rerun = false;
      await enqueueDueReminders();
      await dispatchEmailOutbox();
      await purgeEmailOutbox();
    } while (rerun);
  } catch (err) {
    console.error("[email] échec du cycle d'envoi", err);
  } finally {
    running = false;
  }
}

/**
 * Déclenche un cycle immédiat après une mutation (sans attendre l'intervalle).
 * Sans effet tant que le répartiteur n'est pas démarré (tests).
 */
export function kickEmailDispatch(): void {
  if (!workerStarted) return;
  setImmediate(() => void runCycle());
}

export function startEmailWorker(intervalMs = 30_000): () => void {
  workerStarted = true;
  void runCycle();
  const timer = setInterval(() => void runCycle(), intervalMs);
  timer.unref();
  return () => {
    clearInterval(timer);
    workerStarted = false;
  };
}
