import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { env } from "./config/env.js";
import { authRouter } from "./modules/auth/routes.js";
import { adminRouter } from "./modules/admin/routes.js";
import { barberRouter } from "./modules/barber/routes.js";
import { barbersRouter } from "./modules/barber/publicRoutes.js";
import { bookingRouter } from "./modules/booking/routes.js";
import { notificationRouter } from "./modules/notification/routes.js";
import { placesRouter } from "./modules/places/routes.js";
import {
  createCityPageRouter,
  createSitemapRouter,
} from "./modules/seo/routes.js";
import { userRouter } from "./modules/user/routes.js";
import { siteRouter } from "./modules/site/routes.js";
import { errorHandler } from "./middleware/error.js";
import { resolveUploadDir } from "./lib/storage.js";
import {
  configureTrustProxy,
  securityHeaders,
  seoPageHeaders,
} from "./middleware/security.js";
import { createRateLimiter, MUTATING_METHODS } from "./middleware/rateLimit.js";
import { kickEmailDispatch } from "./modules/email/outbox.js";
import {
  barberPaymentsRouter,
  stripeWebhookRouter,
} from "./modules/payments/routes.js";
import { kickRefunds } from "./modules/payments/service.js";

export interface RateLimitOverride {
  windowMs: number;
  limit: number;
}

export interface AppOptions {
  rateLimits?: {
    login?: RateLimitOverride;
    register?: RateLimitOverride;
    mutation?: RateLimitOverride;
    resendVerification?: RateLimitOverride;
    verifyEmail?: RateLimitOverride;
    passwordReset?: RateLimitOverride;
    geocode?: RateLimitOverride;
    places?: RateLimitOverride;
    seo?: RateLimitOverride;
  };
  /** Barbers minimum pour qu'une ville ait sa page (défaut : CITY_PAGE_MIN_BARBERS). */
  cityPageMinBarbers?: number;
}

export function createApp(options: AppOptions = {}): express.Express {
  const app = express();

  app.disable("x-powered-by");
  // Uniquement si un nombre de hops explicite est fourni (jamais `true`).
  configureTrustProxy(app, env.TRUST_PROXY_HOPS);

  app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));
  // Webhook Stripe (issue #10) : corps brut requis pour vérifier la signature,
  // donc monté avant le parseur JSON.
  app.use("/api/payments/stripe/webhook", stripeWebhookRouter);
  app.use(express.json());
  app.use(cookieParser());

  // Fichiers uploadés (avatars, galerie) servis publiquement sous `/uploads`.
  // Les noms sont générés côté serveur (UUID) ; aucun listing n'est exposé.
  // En-têtes explicites : nosniff + cache immuable (le nom change à chaque
  // upload, donc l'immutabilité est sûre).
  app.use(
    "/uploads",
    express.static(resolveUploadDir(), {
      setHeaders: (res) => {
        res.setHeader("X-Content-Type-Options", "nosniff");
        res.setHeader(
          "Cache-Control",
          "public, max-age=31536000, immutable",
        );
      },
    }),
  );

  // En-têtes de sécurité uniquement sur l'API JSON (le SPA est servi à part).
  app.use("/api", securityHeaders(env.NODE_ENV === "production"));

  // Rate limiting : buckets distincts. En test, chaque bucket reste désactivé
  // tant qu'aucune option `rateLimits.*` n'est fournie.
  const loginLimiter = createRateLimiter({
    windowMs:
      options.rateLimits?.login?.windowMs ?? env.LOGIN_RATE_LIMIT_WINDOW_MS,
    limit: options.rateLimits?.login?.limit ?? env.LOGIN_RATE_LIMIT_MAX,
    skip: !options.rateLimits?.login && env.NODE_ENV === "test",
  });

  const registerLimiter = createRateLimiter({
    windowMs:
      options.rateLimits?.register?.windowMs ??
      env.REGISTER_RATE_LIMIT_WINDOW_MS,
    limit: options.rateLimits?.register?.limit ?? env.REGISTER_RATE_LIMIT_MAX,
    skip: !options.rateLimits?.register && env.NODE_ENV === "test",
  });

  const mutationLimiter = createRateLimiter({
    windowMs:
      options.rateLimits?.mutation?.windowMs ??
      env.MUTATION_RATE_LIMIT_WINDOW_MS,
    limit: options.rateLimits?.mutation?.limit ?? env.MUTATION_RATE_LIMIT_MAX,
    skip: !options.rateLimits?.mutation && env.NODE_ENV === "test",
    skipWhen: (req) => !MUTATING_METHODS.has(req.method),
  });

  const resendVerificationLimiter = createRateLimiter({
    windowMs:
      options.rateLimits?.resendVerification?.windowMs ??
      env.EMAIL_RESEND_RATE_LIMIT_WINDOW_MS,
    limit:
      options.rateLimits?.resendVerification?.limit ??
      env.EMAIL_RESEND_RATE_LIMIT_MAX,
    skip:
      !options.rateLimits?.resendVerification && env.NODE_ENV === "test",
  });

  const verifyEmailLimiter = createRateLimiter({
    windowMs:
      options.rateLimits?.verifyEmail?.windowMs ??
      env.EMAIL_VERIFY_RATE_LIMIT_WINDOW_MS,
    limit:
      options.rateLimits?.verifyEmail?.limit ?? env.EMAIL_VERIFY_RATE_LIMIT_MAX,
    skip: !options.rateLimits?.verifyEmail && env.NODE_ENV === "test",
  });

  // Mot de passe oublié / réinitialisation : un bucket IP partagé.
  const passwordResetLimiter = createRateLimiter({
    windowMs:
      options.rateLimits?.passwordReset?.windowMs ??
      env.PASSWORD_RESET_RATE_LIMIT_WINDOW_MS,
    limit:
      options.rateLimits?.passwordReset?.limit ??
      env.PASSWORD_RESET_RATE_LIMIT_MAX,
    skip: !options.rateLimits?.passwordReset && env.NODE_ENV === "test",
  });

  // Autocomplétion d'adresse (issue #45) : chaque requête appelle le
  // fournisseur de géocodage (quota payant), d'où un bucket dédié.
  const geocodeLimiter = createRateLimiter({
    windowMs: options.rateLimits?.geocode?.windowMs ?? 60_000,
    limit: options.rateLimits?.geocode?.limit ?? 30,
    skip: !options.rateLimits?.geocode && env.NODE_ENV === "test",
  });

  // Autocomplétion de ville (lot N4) : route publique qui appelle le même
  // fournisseur payant, donc un bucket plus strict que celui du barber.
  const placesLimiter = createRateLimiter({
    windowMs: options.rateLimits?.places?.windowMs ?? 60_000,
    limit: options.rateLimits?.places?.limit ?? 20,
    skip: !options.rateLimits?.places && env.NODE_ENV === "test",
  });

  // Pages ville, plan du site et robots.txt (lot N9) : publics et mis en cache,
  // mais chaque page non cachée interroge la base.
  const seoLimiter = createRateLimiter({
    windowMs: options.rateLimits?.seo?.windowMs ?? 60_000,
    limit: options.rateLimits?.seo?.limit ?? 120,
    skip: !options.rateLimits?.seo && env.NODE_ENV === "test",
  });

  // Emails de réservation (issue #9) : après toute mutation réussie, la file
  // `email_outbox` est traitée sans attendre l'intervalle du répartiteur.
  app.use("/api", (req, res, next) => {
    if (MUTATING_METHODS.has(req.method)) {
      res.on("finish", () => {
        if (res.statusCode < 400) {
          kickEmailDispatch();
          kickRefunds();
        }
      });
    }
    next();
  });

  app.use("/api/auth/login", loginLimiter);
  app.use("/api/auth/forgot-password", passwordResetLimiter);
  app.use("/api/auth/reset-password", passwordResetLimiter);
  app.use("/api/auth/register", registerLimiter);
  app.use("/api/auth/resend-verification", resendVerificationLimiter);
  app.use("/api/auth/verify-email", verifyEmailLimiter);
  // Réservation express (lot N6) : crée un compte, donc même bucket que
  // l'inscription (en plus de celui des mutations).
  app.use("/api/bookings/express", registerLimiter);
  app.use("/api/bookings", mutationLimiter);
  app.use("/api/barber/address-suggestions", geocodeLimiter);
  app.use("/api/places", placesLimiter);
  app.use("/api/barber", mutationLimiter);
  // Modérations admin (suspend/reactivate/hide) : même bucket mutations que
  // les autres écritures sensibles ; les GET admin ne sont pas comptés.
  app.use("/api/admin", mutationLimiter);
  // Avatar (PUT/DELETE /api/users/me/avatar) : même bucket mutations.
  app.use("/api/users", mutationLimiter);
  // Marquage lu / tout lu des notifications : même bucket mutations.
  app.use("/api/notifications", mutationLimiter);

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true });
  });

  app.use("/api/site-config", siteRouter);
  app.use("/api/auth", authRouter);
  app.use("/api/admin", adminRouter);
  app.use("/api/users", userRouter);
  app.use("/api/barber/payments", barberPaymentsRouter);
  app.use("/api/barber", barberRouter);
  app.use("/api/barbers", barbersRouter);
  app.use("/api/places", placesRouter);
  // Pages HTML publiques (lot N9) : hors de /api, relayées par Nginx.
  const seoOptions = {
    minBarbers: options.cityPageMinBarbers ?? env.CITY_PAGE_MIN_BARBERS,
  };
  app.use(
    "/barbers/ville",
    seoLimiter,
    seoPageHeaders(env.NODE_ENV === "production"),
    createCityPageRouter(seoOptions),
  );
  app.use(createSitemapRouter(seoOptions, seoLimiter));
  app.use("/api/bookings", bookingRouter);
  app.use("/api/notifications", notificationRouter);

  app.use((_req, res) => {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Route not found." } });
  });

  app.use(errorHandler);

  return app;
}
