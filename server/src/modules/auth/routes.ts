import { Router } from "express";
import {
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
  resendVerificationSchema,
  verifyEmailSchema,
} from "@findbarber/shared/validation";
import { requireAuth } from "../../middleware/auth.js";
import { csrfProtection } from "../../middleware/csrf.js";
import { AUTH_COOKIE, CSRF_COOKIE } from "../../lib/cookies.js";
import { env } from "../../config/env.js";
import {
  loginUser,
  registerUser,
  requestPasswordReset,
  resendVerification,
  resetPassword,
  verifyEmail,
} from "./service.js";
import { validationError } from "../../lib/validation.js";

export const authRouter = Router();

function cookieBaseOptions() {
  return {
    sameSite: "lax" as const,
    secure: env.NODE_ENV === "production",
    // Durée du cookie, en millisecondes
    maxAge: env.JWT_EXPIRES_IN_SECONDS * 1000,
    path: "/",
  };
}

authRouter.post("/register", async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    throw validationError(parsed.error);
  }
  const user = await registerUser(parsed.data);
  res.status(201).json({ user });
});

authRouter.post("/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    throw validationError(parsed.error);
  }
  const { user, token, csrfToken } = await loginUser(parsed.data);

  res.cookie(AUTH_COOKIE, token, { ...cookieBaseOptions(), httpOnly: true });
  res.cookie(CSRF_COOKIE, csrfToken, { ...cookieBaseOptions(), httpOnly: false });

  res.json({ user, csrfToken });
});

authRouter.post("/logout", requireAuth, csrfProtection, (_req, res) => {
  res.clearCookie(AUTH_COOKIE, { path: "/" });
  res.clearCookie(CSRF_COOKIE, { path: "/" });
  res.status(204).end();
});

// Vérification d'email : endpoint public (aucun CSRF, aucune session). Le
// jeton est le secret porteur d'intention ; il est consommé une seule fois.
authRouter.post("/verify-email", async (req, res) => {
  const parsed = verifyEmailSchema.safeParse(req.body);
  if (!parsed.success) {
    throw validationError(parsed.error);
  }
  const { expressBooking } = await verifyEmail(parsed.data.token);
  res.json({ verified: true, expressBooking });
});

// Renvoi du lien de vérification : réponse générique anti-énumération.
authRouter.post("/resend-verification", async (req, res) => {
  const parsed = resendVerificationSchema.safeParse(req.body);
  if (!parsed.success) {
    throw validationError(parsed.error);
  }
  await resendVerification(parsed.data.email);
  res.json({ ok: true });
});

authRouter.get("/me", requireAuth, (req, res) => {
  res.json({ user: req.user });
});

// Mot de passe oublié (issue #9) : réponse neutre, que l'adresse existe ou non.
authRouter.post("/forgot-password", async (req, res) => {
  const parsed = forgotPasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    throw validationError(parsed.error);
  }
  await requestPasswordReset(parsed.data.email);
  res.status(202).json({ ok: true });
});

// Réinitialisation par jeton : public (le jeton est le secret porteur). Toutes
// les sessions existantes sont révoquées ; celle de ce navigateur est effacée.
authRouter.post("/reset-password", async (req, res) => {
  const parsed = resetPasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    throw validationError(parsed.error);
  }
  await resetPassword(parsed.data.token, parsed.data.password);
  res.clearCookie(AUTH_COOKIE, { path: "/" });
  res.clearCookie(CSRF_COOKIE, { path: "/" });
  res.json({ reset: true });
});
