import Stripe from "stripe";
import { env } from "../config/env.js";

// --- Passerelle de paiement (issue #10, Stripe Connect) ---
// Interface étroite pour isoler Stripe : l'implémentation réelle appelle
// l'API Stripe ; les tests injectent une fausse passerelle (aucun appel
// réseau). La vérification de signature des webhooks utilise toujours le SDK
// Stripe (hors ligne), avec le vrai secret ou celui des tests.

export interface CheckoutSessionInput {
  bookingId: string;
  connectedAccountId: string;
  amountMinor: number;
  applicationFeeMinor: number;
  currency: string;
  description: string;
  customerEmail: string;
  successUrl: string;
  cancelUrl: string;
  expiresAt: Date;
}

export interface PaymentGateway {
  createConnectedAccount(input: { email: string; country: string }): Promise<{ id: string }>;
  createOnboardingLink(input: {
    accountId: string;
    returnUrl: string;
    refreshUrl: string;
  }): Promise<string>;
  getAccount(accountId: string): Promise<{ chargesEnabled: boolean; detailsSubmitted: boolean }>;
  createCheckoutSession(input: CheckoutSessionInput): Promise<{ id: string; url: string }>;
  /** Rembourse intégralement, en annulant la commission et le virement. */
  refund(input: { paymentIntentId: string; idempotencyKey: string }): Promise<void>;
}

let stripeClient: Stripe | null = null;
function stripe(): Stripe {
  if (!stripeClient) {
    stripeClient = new Stripe(env.STRIPE_SECRET_KEY ?? "sk_test_unconfigured");
  }
  return stripeClient;
}

const stripeGateway: PaymentGateway = {
  async createConnectedAccount({ email, country }) {
    const account = await stripe().accounts.create({
      type: "express",
      country,
      email,
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
    });
    return { id: account.id };
  },
  async createOnboardingLink({ accountId, returnUrl, refreshUrl }) {
    const link = await stripe().accountLinks.create({
      account: accountId,
      type: "account_onboarding",
      return_url: returnUrl,
      refresh_url: refreshUrl,
    });
    return link.url;
  },
  async getAccount(accountId) {
    const account = await stripe().accounts.retrieve(accountId);
    return {
      chargesEnabled: account.charges_enabled,
      detailsSubmitted: account.details_submitted,
    };
  },
  async createCheckoutSession(input) {
    // Charge « destination » : le client paie la plateforme, Stripe vire
    // automatiquement le montant (moins la commission) au barber.
    const session = await stripe().checkout.sessions.create(
      {
        mode: "payment",
        customer_email: input.customerEmail,
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: input.currency.toLowerCase(),
              unit_amount: input.amountMinor,
              product_data: { name: input.description },
            },
          },
        ],
        payment_intent_data: {
          application_fee_amount: input.applicationFeeMinor || undefined,
          transfer_data: { destination: input.connectedAccountId },
          metadata: { bookingId: input.bookingId },
        },
        metadata: { bookingId: input.bookingId },
        client_reference_id: input.bookingId,
        success_url: input.successUrl,
        cancel_url: input.cancelUrl,
        expires_at: Math.floor(input.expiresAt.getTime() / 1000),
      },
      { idempotencyKey: `checkout-${input.bookingId}` },
    );
    if (!session.url) throw new Error("Stripe n'a pas renvoyé d'URL de paiement.");
    return { id: session.id, url: session.url };
  },
  async refund({ paymentIntentId, idempotencyKey }) {
    await stripe().refunds.create(
      {
        payment_intent: paymentIntentId,
        refund_application_fee: true,
        reverse_transfer: true,
      },
      { idempotencyKey },
    );
  },
};

// --- Configuration (surcharge possible en tests) ---

let gatewayOverride: PaymentGateway | null = null;
let webhookSecretOverride: string | null = null;

export function configurePaymentsForTests(
  config: { gateway: PaymentGateway; webhookSecret: string } | null,
): void {
  gatewayOverride = config?.gateway ?? null;
  webhookSecretOverride = config?.webhookSecret ?? null;
}

/** Paiement en ligne disponible (clés Stripe configurées, ou tests). */
export function paymentsEnabled(): boolean {
  return (
    gatewayOverride !== null ||
    Boolean(env.STRIPE_SECRET_KEY && env.STRIPE_WEBHOOK_SECRET)
  );
}

export function paymentGateway(): PaymentGateway {
  return gatewayOverride ?? stripeGateway;
}

/** Vérifie la signature et décode un événement webhook Stripe. */
export function constructWebhookEvent(rawBody: Buffer, signature: string): Stripe.Event {
  const secret = webhookSecretOverride ?? env.STRIPE_WEBHOOK_SECRET;
  if (!secret) throw new Error("STRIPE_WEBHOOK_SECRET non configuré.");
  return stripe().webhooks.constructEvent(rawBody, signature, secret);
}

/** Commission de la plateforme sur un montant (unités mineures). */
export function platformFee(amountMinor: number): number {
  return Math.round((amountMinor * env.STRIPE_PLATFORM_FEE_PERCENT) / 100);
}
