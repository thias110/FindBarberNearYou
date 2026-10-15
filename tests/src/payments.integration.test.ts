// Paiement en ligne (issue #10, Stripe Connect) : passerelle factice (aucun
// appel réseau) mais webhooks réellement signés avec le SDK Stripe.
import request from "supertest";
import Stripe from "stripe";
import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../server/src/app";
import { db } from "../../server/src/db/client";
import { migrateDb } from "../../server/src/db/migrate";
import {
  configurePaymentsForTests,
  type CheckoutSessionInput,
  type PaymentGateway,
} from "../../server/src/lib/payments";
import { processPendingRefunds } from "../../server/src/modules/payments/service";
import { sweepExpiredPendingBookings } from "../../server/src/modules/booking/expiry";
import { barberProfiles, bookings, emailOutbox, notifications } from "@findbarber/shared/schema";
import {
  createUser,
  futureDate,
  login,
  resetBookingTables,
  seedBarber,
  type SeededBarber,
  type Session,
} from "./booking-api-helpers";

const WEBHOOK_SECRET = "whsec_test_findbarber";
const stripe = new Stripe("sk_test_unused");
const app = createApp();

const BARBER_EMAIL = "pay-barber@example.com";
const CLIENT_EMAIL = "pay-client@example.com";

// --- Passerelle factice ---
const calls = {
  accounts: [] as { email: string; country: string }[],
  checkouts: [] as CheckoutSessionInput[],
  refunds: [] as { paymentIntentId: string; idempotencyKey: string }[],
};
let failCheckout = false;
let failRefunds = 0;
const accountState = new Map<string, boolean>();

const fakeGateway: PaymentGateway = {
  async createConnectedAccount(input) {
    calls.accounts.push(input);
    const id = `acct_test_${calls.accounts.length}`;
    accountState.set(id, false);
    return { id };
  },
  async createOnboardingLink({ accountId }) {
    return `https://connect.stripe.test/onboarding/${accountId}`;
  },
  async getAccount(accountId) {
    return { chargesEnabled: accountState.get(accountId) ?? false, detailsSubmitted: true };
  },
  async createCheckoutSession(input) {
    if (failCheckout) throw new Error("Stripe indisponible");
    calls.checkouts.push(input);
    return { id: `cs_test_${input.bookingId}`, url: `https://checkout.stripe.test/${input.bookingId}` };
  },
  async refund(input) {
    if (failRefunds > 0) {
      failRefunds -= 1;
      throw new Error("Refund API down");
    }
    calls.refunds.push(input);
  },
};

beforeAll(async () => {
  await migrateDb();
  configurePaymentsForTests({ gateway: fakeGateway, webhookSecret: WEBHOOK_SECRET });
});

afterAll(() => {
  configurePaymentsForTests(null);
});

beforeEach(async () => {
  await db.delete(emailOutbox);
  await resetBookingTables();
  calls.accounts.length = 0;
  calls.checkouts.length = 0;
  calls.refunds.length = 0;
  failCheckout = false;
  failRefunds = 0;
  accountState.clear();
});

function sendWebhook(event: Record<string, unknown>, secret = WEBHOOK_SECRET) {
  const payload = JSON.stringify({ id: `evt_${Date.now()}`, object: "event", ...event });
  const header = stripe.webhooks.generateTestHeaderString({ payload, secret });
  return request(app)
    .post("/api/payments/stripe/webhook")
    .set("Content-Type", "application/json")
    .set("Stripe-Signature", header)
    .send(payload);
}

function checkoutCompleted(bookingId: string, paymentIntent = `pi_${bookingId}`) {
  return sendWebhook({
    type: "checkout.session.completed",
    data: {
      object: {
        id: `cs_test_${bookingId}`,
        object: "checkout.session",
        payment_status: "paid",
        payment_intent: paymentIntent,
        metadata: { bookingId },
        client_reference_id: bookingId,
      },
    },
  });
}

/** Barber avec compte Stripe activé et politique de paiement donnée. */
async function payingBarber(mode: "DEPOSIT" | "FULL", depositPercent = 30) {
  const barber = await seedBarber(BARBER_EMAIL, { timezone: "UTC" });
  await db
    .update(barberProfiles)
    .set({
      stripeAccountId: "acct_ready",
      stripeChargesEnabled: true,
      paymentMode: mode,
      depositPercent,
    })
    .where(eq(barberProfiles.id, barber.profileId));
  accountState.set("acct_ready", true);
  await createUser(CLIENT_EMAIL, "CLIENT");
  return barber;
}

function book(session: Session, barber: SeededBarber, date: string, startMinute: number) {
  return session.agent
    .post("/api/bookings")
    .set("X-CSRF-Token", session.csrf)
    .send({ barberId: barber.profileId, serviceId: barber.serviceId, date, startMinute, place: "SALON" });
}

async function slotOffered(barber: SeededBarber, date: string, minute: number) {
  const res = await request(app).get(
    `/api/barbers/${barber.profileId}/slots?serviceId=${barber.serviceId}&date=${date}&place=SALON`,
  );
  return (res.body.slots as { startMinute: number }[]).some((s) => s.startMinute === minute);
}

async function row(id: string) {
  const [b] = await db.select().from(bookings).where(eq(bookings.id, id));
  return b;
}

describe("espace barber : Stripe Connect et politique de paiement", () => {
  it("inscription Stripe, activation par webhook, puis acompte", async () => {
    const barber = await seedBarber(BARBER_EMAIL);
    const pro = await login(app, BARBER_EMAIL);

    const initial = await pro.agent.get("/api/barber/payments");
    expect(initial.body.settings).toMatchObject({
      available: true,
      connected: false,
      chargesEnabled: false,
      paymentMode: "NONE",
    });

    const early = await pro.agent
      .put("/api/barber/payments")
      .set("X-CSRF-Token", pro.csrf)
      .send({ paymentMode: "DEPOSIT", depositPercent: 30 });
    expect(early.status).toBe(409);
    expect(early.body.error.code).toBe("PAYMENTS_NOT_ACTIVATED");

    const onboarding = await pro.agent
      .post("/api/barber/payments/onboarding")
      .set("X-CSRF-Token", pro.csrf);
    expect(onboarding.body.url).toBe("https://connect.stripe.test/onboarding/acct_test_1");
    expect(calls.accounts).toEqual([{ email: BARBER_EMAIL, country: "CH" }]);

    const updated = await sendWebhook({
      type: "account.updated",
      data: { object: { id: "acct_test_1", object: "account", charges_enabled: true } },
    });
    expect(updated.status).toBe(200);
    const [profile] = await db.select().from(barberProfiles).where(eq(barberProfiles.id, barber.profileId));
    expect(profile.stripeChargesEnabled).toBe(true);

    accountState.set("acct_test_1", true);
    const saved = await pro.agent
      .put("/api/barber/payments")
      .set("X-CSRF-Token", pro.csrf)
      .send({ paymentMode: "DEPOSIT", depositPercent: 30 });
    expect(saved.status).toBe(200);
    expect(saved.body.settings).toMatchObject({ chargesEnabled: true, paymentMode: "DEPOSIT", depositPercent: 30 });

    const invalid = await pro.agent
      .put("/api/barber/payments")
      .set("X-CSRF-Token", pro.csrf)
      .send({ paymentMode: "DEPOSIT", depositPercent: 5 });
    expect(invalid.status).toBe(400);
  });

  it("réservé au barber ; webhook à signature invalide refusé", async () => {
    await createUser(CLIENT_EMAIL, "CLIENT");
    const client = await login(app, CLIENT_EMAIL);
    expect((await client.agent.get("/api/barber/payments")).status).toBe(403);
    const forged = await sendWebhook({ type: "account.updated", data: { object: {} } }, "whsec_wrong");
    expect(forged.status).toBe(400);
    expect(forged.body.error.code).toBe("INVALID_SIGNATURE");
  });
});

describe("réservation avec paiement à la demande", () => {
  it("acompte : Checkout, demande invisible du barber, puis visible et notifiée une fois payée", async () => {
    const barber = await payingBarber("DEPOSIT", 30);
    const client = await login(app, CLIENT_EMAIL);
    const date = futureDate(3);

    const created = await book(client, barber, date, 600);
    expect(created.status).toBe(201);
    const id = created.body.booking.id;
    expect(created.body.checkoutUrl).toBe(`https://checkout.stripe.test/${id}`);
    expect(created.body.booking).toMatchObject({ paymentStatus: "REQUIRES_PAYMENT", amountDueMinor: 750 });
    expect(calls.checkouts[0]).toMatchObject({
      bookingId: id,
      connectedAccountId: "acct_ready",
      amountMinor: 750,
      currency: "CHF",
      customerEmail: CLIENT_EMAIL,
    });

    // Créneau tenu, demande invisible du barber, aucune notification.
    expect(await slotOffered(barber, date, 600)).toBe(false);
    const pro = await login(app, BARBER_EMAIL);
    expect((await pro.agent.get("/api/bookings")).body.bookings).toHaveLength(0);
    expect((await pro.agent.get(`/api/bookings/${id}`)).status).toBe(404);
    expect(await db.select().from(notifications)).toHaveLength(0);

    // Paiement reçu (webhook) : visible et notifiée ; rejouer est sans effet.
    expect((await checkoutCompleted(id)).status).toBe(200);
    expect((await checkoutCompleted(id)).status).toBe(200);
    expect(await row(id)).toMatchObject({
      paymentStatus: "PAID",
      stripePaymentIntentId: `pi_${id}`,
      paymentExpiresAt: null,
    });
    expect((await pro.agent.get("/api/bookings")).body.bookings).toHaveLength(1);
    const notes = await db
      .select()
      .from(notifications)
      .where(and(eq(notifications.userId, barber.userId), eq(notifications.bookingId, id)));
    expect(notes.map((n) => n.type)).toEqual(["BOOKING_REQUESTED"]);
  });

  it("prix complet ; sans politique ou sans Stripe configuré : paiement sur place", async () => {
    const barber = await payingBarber("FULL");
    const client = await login(app, CLIENT_EMAIL);
    const full = await book(client, barber, futureDate(3), 600);
    expect(full.body.booking.amountDueMinor).toBe(2500);

    await db.update(barberProfiles).set({ paymentMode: "NONE" }).where(eq(barberProfiles.id, barber.profileId));
    const none = await book(client, barber, futureDate(3), 660);
    expect(none.body).toMatchObject({ checkoutUrl: null, booking: { paymentStatus: "NOT_REQUIRED" } });

    await db.update(barberProfiles).set({ paymentMode: "FULL" }).where(eq(barberProfiles.id, barber.profileId));
    configurePaymentsForTests(null);
    try {
      const disabled = await book(client, barber, futureDate(3), 720);
      expect(disabled.body.booking.paymentStatus).toBe("NOT_REQUIRED");
    } finally {
      configurePaymentsForTests({ gateway: fakeGateway, webhookSecret: WEBHOOK_SECRET });
    }
  });

  it("panne Stripe à la création : 503, demande annulée, créneau libéré", async () => {
    const barber = await payingBarber("DEPOSIT");
    const client = await login(app, CLIENT_EMAIL);
    const date = futureDate(3);
    failCheckout = true;
    const res = await book(client, barber, date, 600);
    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe("PAYMENTS_UNAVAILABLE");
    expect(await slotOffered(barber, date, 600)).toBe(true);
    const [b] = await db.select().from(bookings);
    expect(b).toMatchObject({ status: "CANCELLED", paymentStatus: "CANCELLED" });
  });

  it("non payée dans le délai : créneau libéré, expirée sans notification ni statistique", async () => {
    const barber = await payingBarber("DEPOSIT");
    const client = await login(app, CLIENT_EMAIL);
    const date = futureDate(3);
    const id = (await book(client, barber, date, 600)).body.booking.id;

    await db
      .update(bookings)
      .set({ paymentExpiresAt: new Date(Date.now() - 1000) })
      .where(eq(bookings.id, id));
    expect(await slotOffered(barber, date, 600)).toBe(true);

    expect(await sweepExpiredPendingBookings()).toBe(1);
    expect(await row(id)).toMatchObject({ status: "EXPIRED", paymentStatus: "CANCELLED" });
    expect(await db.select().from(notifications)).toHaveLength(0);
    const pro = await login(app, BARBER_EMAIL);
    expect((await pro.agent.get("/api/bookings")).body.bookings).toHaveLength(0);

    // Paiement arrivé trop tard : remboursé aussitôt.
    await checkoutCompleted(id, "pi_late");
    expect(await row(id)).toMatchObject({ paymentStatus: "REFUND_PENDING", stripePaymentIntentId: "pi_late" });
    await processPendingRefunds();
    expect(calls.refunds).toEqual([{ paymentIntentId: "pi_late", idempotencyKey: `refund-${id}` }]);
  });

  it("annulation par le client d'une demande non payée : rien à rembourser, barber non prévenu", async () => {
    const barber = await payingBarber("DEPOSIT");
    const client = await login(app, CLIENT_EMAIL);
    const id = (await book(client, barber, futureDate(3), 600)).body.booking.id;
    const res = await client.agent.post(`/api/bookings/${id}/cancel`).set("X-CSRF-Token", client.csrf);
    expect(res.status).toBe(200);
    expect(await row(id)).toMatchObject({ status: "CANCELLED", paymentStatus: "CANCELLED" });
    expect(await db.select().from(notifications)).toHaveLength(0);
    await processPendingRefunds();
    expect(calls.refunds).toHaveLength(0);
  });
});

describe("remboursements automatiques", () => {
  async function paidBooking(minute = 600) {
    const barber = await payingBarber("FULL");
    const client = await login(app, CLIENT_EMAIL);
    const id = (await book(client, barber, futureDate(3), minute)).body.booking.id;
    await checkoutCompleted(id);
    return { barber, client, id };
  }

  it("refus par le barber : remboursement intégral (commission et virement annulés)", async () => {
    const { id } = await paidBooking();
    const pro = await login(app, BARBER_EMAIL);
    await pro.agent
      .post(`/api/bookings/${id}/decline`)
      .set("X-CSRF-Token", pro.csrf)
      .send({})
      .expect(200);
    expect(await row(id)).toMatchObject({ status: "DECLINED", paymentStatus: "REFUND_PENDING" });

    expect(await processPendingRefunds()).toEqual({ refunded: 1, failed: 0 });
    expect(calls.refunds).toEqual([{ paymentIntentId: `pi_${id}`, idempotencyKey: `refund-${id}` }]);
    const refunded = await row(id);
    expect(refunded.paymentStatus).toBe("REFUNDED");
    expect(refunded.refundedAt).not.toBeNull();
  });

  it("annulation par le client dans les délais, et échec de l'API retenté", async () => {
    const { client, id } = await paidBooking();
    await client.agent.post(`/api/bookings/${id}/cancel`).set("X-CSRF-Token", client.csrf).expect(200);

    failRefunds = 1;
    expect(await processPendingRefunds()).toEqual({ refunded: 0, failed: 1 });
    const pending = await row(id);
    expect(pending.paymentStatus).toBe("REFUND_PENDING");
    expect(pending.paymentError).toContain("Refund API down");

    expect(await processPendingRefunds()).toEqual({ refunded: 1, failed: 0 });
    expect((await row(id)).paymentStatus).toBe("REFUNDED");
  });

  it("une demande payée qui expire faute de réponse est remboursée", async () => {
    const { id } = await paidBooking();
    await db
      .update(bookings)
      .set({ createdAt: new Date(Date.now() - 25 * 3_600_000) })
      .where(eq(bookings.id, id));
    expect(await sweepExpiredPendingBookings()).toBe(1);
    expect(await row(id)).toMatchObject({ status: "EXPIRED", paymentStatus: "REFUND_PENDING" });
  });

  it("confirmée puis terminée : le paiement reste acquis", async () => {
    const { id } = await paidBooking();
    const pro = await login(app, BARBER_EMAIL);
    await pro.agent.post(`/api/bookings/${id}/confirm`).set("X-CSRF-Token", pro.csrf).expect(200);
    expect(await row(id)).toMatchObject({ status: "CONFIRMED", paymentStatus: "PAID" });
    await processPendingRefunds();
    expect(calls.refunds).toHaveLength(0);
  });
});
