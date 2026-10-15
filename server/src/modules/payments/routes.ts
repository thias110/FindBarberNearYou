import express, { Router } from "express";
import { paymentSettingsSchema } from "@findbarber/shared/validation";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { csrfProtection } from "../../middleware/csrf.js";
import { AppError } from "../../lib/errors.js";
import { constructWebhookEvent } from "../../lib/payments.js";
import { validationError } from "../../lib/validation.js";
import {
  getPaymentSettings,
  handleStripeEvent,
  kickRefunds,
  startOnboarding,
  updatePaymentSettings,
} from "./service.js";

// Webhook Stripe : monté AVANT `express.json()` (la signature porte sur le
// corps brut). Public, authentifié par la signature `Stripe-Signature`.
export const stripeWebhookRouter = Router();

stripeWebhookRouter.post(
  "/",
  express.raw({ type: "application/json", limit: "1mb" }),
  async (req, res) => {
    const signature = req.header("stripe-signature");
    if (!signature || !Buffer.isBuffer(req.body)) {
      throw new AppError(400, "INVALID_SIGNATURE", "Signature Stripe absente.");
    }
    let event;
    try {
      event = constructWebhookEvent(req.body, signature);
    } catch {
      throw new AppError(400, "INVALID_SIGNATURE", "Signature Stripe invalide.");
    }
    await handleStripeEvent(event);
    kickRefunds();
    res.json({ received: true });
  },
);

// Espace barber : Stripe Connect et politique de paiement (issue #10).
export const barberPaymentsRouter = Router();

barberPaymentsRouter.get("/", requireAuth, requireRole("BARBER"), async (req, res) => {
  res.json({ settings: await getPaymentSettings(req.user!.id) });
});

barberPaymentsRouter.put(
  "/",
  requireAuth,
  requireRole("BARBER"),
  csrfProtection,
  async (req, res) => {
    const parsed = paymentSettingsSchema.safeParse(req.body);
    if (!parsed.success) throw validationError(parsed.error);
    res.json({ settings: await updatePaymentSettings(req.user!.id, parsed.data) });
  },
);

// Lien d'inscription Stripe (création du compte Connect au premier appel).
barberPaymentsRouter.post(
  "/onboarding",
  requireAuth,
  requireRole("BARBER"),
  csrfProtection,
  async (req, res) => {
    res.json({ url: await startOnboarding(req.user!.id) });
  },
);
