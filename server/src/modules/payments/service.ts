import { and, eq } from "drizzle-orm";
import type Stripe from "stripe";
import { db, type Db } from "../../db/client.js";
import { barberProfiles, bookings, users } from "@findbarber/shared/schema";
import { LIMITS, type PaymentMode } from "@findbarber/shared/constants";
import type { BarberPaymentSettings } from "@findbarber/shared/types";
import { env } from "../../config/env.js";
import { AppError } from "../../lib/errors.js";
import { appUrl } from "../../lib/emailTemplates.js";
import { paymentGateway, paymentsEnabled, platformFee } from "../../lib/payments.js";
import { notifyBookingEvent } from "../notification/service.js";
import { amountDueOnline } from "./rules.js";

// --- Paiement en ligne (issue #10, Stripe Connect) ---
// Flux : demande créée en attente de paiement (créneau bloqué, invisible du
// barber) → Checkout Stripe → webhook « payé » → le barber est prévenu. En cas
// de refus, d'expiration ou d'annulation, le paiement passe REFUND_PENDING et
// le répartiteur rembourse (commission et virement annulés).

function paymentsUnavailable(): AppError {
  return new AppError(
    503,
    "PAYMENTS_UNAVAILABLE",
    "Le paiement en ligne n'est pas disponible pour le moment.",
  );
}

// --- Politique de paiement à la création d'une réservation ---

export interface PaymentRequirement {
  amountDueMinor: number;
  platformFeeMinor: number;
}

/** Paiement à exiger pour une réservation, ou null (paiement sur place). */
export function paymentRequirementFor(
  profile: {
    paymentMode: PaymentMode;
    depositPercent: number;
    stripeAccountId: string | null;
    stripeChargesEnabled: boolean;
  },
  priceMinor: number,
): PaymentRequirement | null {
  if (!paymentsEnabled() || !profile.stripeAccountId || !profile.stripeChargesEnabled) {
    return null;
  }
  const amount = amountDueOnline(profile.paymentMode, profile.depositPercent, priceMinor);
  if (amount <= 0) return null;
  return { amountDueMinor: amount, platformFeeMinor: platformFee(amount) };
}

/**
 * Ouvre la session Checkout d'une réservation en attente de paiement (après
 * commit). En cas d'échec Stripe, la demande est abandonnée (créneau libéré)
 * et l'erreur remonte au client.
 */
export async function openCheckout(bookingId: string): Promise<string> {
  const [row] = await db
    .select({
      booking: bookings,
      accountId: barberProfiles.stripeAccountId,
      clientEmail: users.email,
    })
    .from(bookings)
    .innerJoin(barberProfiles, eq(bookings.barberProfileId, barberProfiles.id))
    .innerJoin(users, eq(bookings.clientUserId, users.id))
    .where(eq(bookings.id, bookingId))
    .limit(1);
  if (!row || !row.accountId || row.booking.amountDueMinor === null) {
    throw paymentsUnavailable();
  }
  const { booking } = row;
  try {
    // Stripe impose au moins 30 min de validité ; le créneau est tenu un peu
    // plus longtemps pour absorber la latence du webhook.
    const session = await paymentGateway().createCheckoutSession({
      bookingId: booking.id,
      connectedAccountId: row.accountId,
      amountMinor: booking.amountDueMinor!,
      applicationFeeMinor: booking.platformFeeMinor ?? 0,
      currency: booking.currency,
      description: `${booking.serviceName} — ${booking.barberDisplayName}`,
      customerEmail: row.clientEmail,
      successUrl: appUrl(`/appointments?payment=success&booking=${booking.id}`),
      cancelUrl: appUrl(`/appointments?payment=cancelled&booking=${booking.id}`),
      expiresAt: new Date(Date.now() + 31 * 60_000),
    });
    await db
      .update(bookings)
      .set({
        stripeCheckoutSessionId: session.id,
        stripeCheckoutUrl: session.url,
        updatedAt: new Date(),
      })
      .where(eq(bookings.id, booking.id));
    return session.url;
  } catch (err) {
    const now = new Date();
    await db
      .update(bookings)
      .set({
        status: "CANCELLED",
        cancelledBy: "SYSTEM",
        cancelledAt: now,
        paymentStatus: "CANCELLED",
        paymentExpiresAt: null,
        paymentError: (err instanceof Error ? err.message : String(err)).slice(0, 500),
        updatedAt: now,
      })
      .where(and(eq(bookings.id, booking.id), eq(bookings.paymentStatus, "REQUIRES_PAYMENT")));
    console.error("[payments] échec de création de la session Checkout", err);
    throw paymentsUnavailable();
  }
}

// --- Webhook Stripe ---

/** Paiement reçu : la demande devient visible et le barber est prévenu. */
async function markPaid(bookingId: string, paymentIntentId: string | null): Promise<void> {
  await db.transaction(async (tx) => {
    const runner = tx as unknown as Db;
    const now = new Date();
    const [paid] = await runner
      .update(bookings)
      .set({
        paymentStatus: "PAID",
        paidAt: now,
        paymentExpiresAt: null,
        stripePaymentIntentId: paymentIntentId,
        updatedAt: now,
      })
      .where(
        and(
          eq(bookings.id, bookingId),
          eq(bookings.status, "PENDING"),
          eq(bookings.paymentStatus, "REQUIRES_PAYMENT"),
        ),
      )
      .returning();
    if (paid) {
      const [profile] = await runner
        .select({ userId: barberProfiles.userId })
        .from(barberProfiles)
        .where(eq(barberProfiles.id, paid.barberProfileId))
        .limit(1);
      if (profile) {
        await notifyBookingEvent(runner, {
          recipientUserId: profile.userId,
          actorUserId: paid.clientUserId,
          bookingId: paid.id,
          type: "BOOKING_REQUESTED",
        });
      }
      return;
    }
    // Paiement arrivé trop tard (demande déjà expirée ou annulée) : on
    // rembourse aussitôt.
    await runner
      .update(bookings)
      .set({
        paymentStatus: "REFUND_PENDING",
        paidAt: now,
        stripePaymentIntentId: paymentIntentId,
        updatedAt: now,
      })
      .where(
        and(
          eq(bookings.id, bookingId),
          eq(bookings.paymentStatus, "CANCELLED"),
        ),
      );
  });
}

function intentId(session: Stripe.Checkout.Session): string | null {
  const intent = session.payment_intent;
  if (!intent) return null;
  return typeof intent === "string" ? intent : intent.id;
}

/** Traite un événement Stripe vérifié. Idempotent (mises à jour gardées). */
export async function handleStripeEvent(event: Stripe.Event): Promise<void> {
  switch (event.type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded": {
      const session = event.data.object;
      const bookingId = session.metadata?.bookingId ?? session.client_reference_id;
      if (bookingId && session.payment_status === "paid") {
        await markPaid(bookingId, intentId(session));
      }
      return;
    }
    case "checkout.session.expired":
    case "checkout.session.async_payment_failed": {
      // La demande non payée expirera d'elle-même (`payment_expires_at`) ;
      // on libère le créneau tout de suite.
      const session = event.data.object;
      const bookingId = session.metadata?.bookingId ?? session.client_reference_id;
      if (!bookingId) return;
      const now = new Date();
      await db
        .update(bookings)
        .set({
          status: "EXPIRED",
          paymentStatus: "CANCELLED",
          paymentExpiresAt: null,
          updatedAt: now,
        })
        .where(
          and(
            eq(bookings.id, bookingId),
            eq(bookings.status, "PENDING"),
            eq(bookings.paymentStatus, "REQUIRES_PAYMENT"),
          ),
        );
      return;
    }
    case "account.updated": {
      const account = event.data.object;
      await db
        .update(barberProfiles)
        .set({
          stripeChargesEnabled: account.charges_enabled,
          updatedAt: new Date(),
        })
        .where(eq(barberProfiles.stripeAccountId, account.id));
      return;
    }
    default:
      return;
  }
}

// --- Remboursements (répartiteur) ---

/** Rembourse les paiements en attente de remboursement. */
export async function processPendingRefunds(limit = 20): Promise<{ refunded: number; failed: number }> {
  const due = await db
    .select({ id: bookings.id, paymentIntentId: bookings.stripePaymentIntentId })
    .from(bookings)
    .where(eq(bookings.paymentStatus, "REFUND_PENDING"))
    .limit(limit);
  let refunded = 0;
  let failed = 0;
  for (const { id, paymentIntentId } of due) {
    try {
      if (paymentIntentId) {
        await paymentGateway().refund({ paymentIntentId, idempotencyKey: `refund-${id}` });
      }
      await db
        .update(bookings)
        .set({ paymentStatus: "REFUNDED", refundedAt: new Date(), paymentError: null, updatedAt: new Date() })
        .where(and(eq(bookings.id, id), eq(bookings.paymentStatus, "REFUND_PENDING")));
      refunded += 1;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await db
        .update(bookings)
        .set({ paymentError: message.slice(0, 500), updatedAt: new Date() })
        .where(eq(bookings.id, id));
      console.error(`[payments] échec du remboursement ${id} : ${message}`);
      failed += 1;
    }
  }
  return { refunded, failed };
}

let workerStarted = false;
let running = false;

async function runRefunds(): Promise<void> {
  if (running) return;
  running = true;
  try {
    await processPendingRefunds();
  } catch (err) {
    console.error("[payments] échec du cycle de remboursement", err);
  } finally {
    running = false;
  }
}

/** Rembourse sans attendre après une mutation (sans effet hors serveur). */
export function kickRefunds(): void {
  if (!workerStarted) return;
  setImmediate(() => void runRefunds());
}

export function startRefundWorker(intervalMs = 60_000): () => void {
  if (!paymentsEnabled()) return () => {};
  workerStarted = true;
  void runRefunds();
  const timer = setInterval(() => void runRefunds(), intervalMs);
  timer.unref();
  return () => {
    clearInterval(timer);
    workerStarted = false;
  };
}

// --- Espace barber : Stripe Connect et politique de paiement ---

async function ownProfile(userId: string) {
  const [row] = await db
    .select({ profile: barberProfiles, email: users.email })
    .from(barberProfiles)
    .innerJoin(users, eq(users.id, barberProfiles.userId))
    .where(eq(barberProfiles.userId, userId))
    .limit(1);
  if (!row) {
    throw new AppError(404, "BARBER_PROFILE_NOT_FOUND", "Aucun profil professionnel.");
  }
  return row;
}

function toSettings(profile: typeof barberProfiles.$inferSelect): BarberPaymentSettings {
  return {
    available: paymentsEnabled(),
    connected: profile.stripeAccountId !== null,
    chargesEnabled: profile.stripeChargesEnabled,
    paymentMode: profile.paymentMode,
    depositPercent: profile.depositPercent,
    platformFeePercent: env.STRIPE_PLATFORM_FEE_PERCENT,
  };
}

/** Réglages + état Stripe, rafraîchi auprès de Stripe si un compte existe. */
export async function getPaymentSettings(userId: string): Promise<BarberPaymentSettings> {
  const { profile } = await ownProfile(userId);
  if (paymentsEnabled() && profile.stripeAccountId) {
    try {
      const account = await paymentGateway().getAccount(profile.stripeAccountId);
      if (account.chargesEnabled !== profile.stripeChargesEnabled) {
        const [updated] = await db
          .update(barberProfiles)
          .set({ stripeChargesEnabled: account.chargesEnabled, updatedAt: new Date() })
          .where(eq(barberProfiles.id, profile.id))
          .returning();
        return toSettings(updated);
      }
    } catch (err) {
      console.error("[payments] lecture du compte Stripe impossible", err);
    }
  }
  return toSettings(profile);
}

/** Crée (si besoin) le compte Connect et renvoie le lien d'inscription Stripe. */
export async function startOnboarding(userId: string): Promise<string> {
  if (!paymentsEnabled()) throw paymentsUnavailable();
  const { profile, email } = await ownProfile(userId);
  let accountId = profile.stripeAccountId;
  if (!accountId) {
    const account = await paymentGateway().createConnectedAccount({
      email,
      country: profile.countryCode,
    });
    accountId = account.id;
    await db
      .update(barberProfiles)
      .set({ stripeAccountId: accountId, updatedAt: new Date() })
      .where(eq(barberProfiles.id, profile.id));
  }
  return paymentGateway().createOnboardingLink({
    accountId,
    returnUrl: appUrl("/pro/payments?stripe=return"),
    refreshUrl: appUrl("/pro/payments?stripe=refresh"),
  });
}

export async function updatePaymentSettings(
  userId: string,
  input: { paymentMode: PaymentMode; depositPercent?: number },
): Promise<BarberPaymentSettings> {
  const { profile } = await ownProfile(userId);
  if (input.paymentMode !== "NONE" && !(paymentsEnabled() && profile.stripeChargesEnabled)) {
    throw new AppError(
      409,
      "PAYMENTS_NOT_ACTIVATED",
      "Activez d'abord les paiements avec Stripe avant d'exiger un paiement en ligne.",
    );
  }
  const [updated] = await db
    .update(barberProfiles)
    .set({
      paymentMode: input.paymentMode,
      depositPercent: input.depositPercent ?? profile.depositPercent,
      updatedAt: new Date(),
    })
    .where(eq(barberProfiles.id, profile.id))
    .returning();
  return toSettings(updated);
}

export const PAYMENT_HOLD_MS = LIMITS.paymentHoldMinutes * 60_000;
