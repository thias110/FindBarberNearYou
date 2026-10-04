import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { env } from "./config/env.js";
import { authRouter } from "./modules/auth/routes.js";
import { adminRouter } from "./modules/admin/routes.js";
import { barberRouter } from "./modules/barber/routes.js";
import { barbersRouter } from "./modules/barber/publicRoutes.js";
import { bookingRouter } from "./modules/booking/routes.js";
import { userRouter } from "./modules/user/routes.js";
import { errorHandler } from "./middleware/error.js";
import { resolveUploadDir } from "./lib/storage.js";
import { configureTrustProxy, securityHeaders } from "./middleware/security.js";
import { createRateLimiter, MUTATING_METHODS } from "./middleware/rateLimit.js";

export interface RateLimitOverride {
  windowMs: number;
  limit: number;
}

export interface AppOptions {
  rateLimits?: {
    login?: RateLimitOverride;
    register?: RateLimitOverride;
    mutation?: RateLimitOverride;
  };
}

export function createApp(options: AppOptions = {}): express.Express {
  const app = express();

  app.disable("x-powered-by");
  // Uniquement si un nombre de hops explicite est fourni (jamais `true`).
  configureTrustProxy(app, env.TRUST_PROXY_HOPS);

  app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));
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

  app.use("/api/auth/login", loginLimiter);
  app.use("/api/auth/register", registerLimiter);
  app.use("/api/bookings", mutationLimiter);
  app.use("/api/barber", mutationLimiter);
  // Modérations admin (suspend/reactivate/hide) : même bucket mutations que
  // les autres écritures sensibles ; les GET admin ne sont pas comptés.
  app.use("/api/admin", mutationLimiter);
  // Avatar (PUT/DELETE /api/users/me/avatar) : même bucket mutations.
  app.use("/api/users", mutationLimiter);

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true });
  });

  app.use("/api/auth", authRouter);
  app.use("/api/admin", adminRouter);
  app.use("/api/users", userRouter);
  app.use("/api/barber", barberRouter);
  app.use("/api/barbers", barbersRouter);
  app.use("/api/bookings", bookingRouter);

  app.use((_req, res) => {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Route not found." } });
  });

  app.use(errorHandler);

  return app;
}
