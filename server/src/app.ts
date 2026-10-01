import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { rateLimit } from "express-rate-limit";
import { env } from "./config/env.js";
import { authRouter } from "./modules/auth/routes.js";
import { adminRouter } from "./modules/admin/routes.js";
import { barberRouter } from "./modules/barber/routes.js";
import { barbersRouter } from "./modules/barber/publicRoutes.js";
import { bookingRouter } from "./modules/booking/routes.js";
import { errorHandler } from "./middleware/error.js";

export interface AppOptions {
  authRateLimit?: { windowMs: number; limit: number };
}

export function createApp(options: AppOptions = {}): express.Express {
  const app = express();

  app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));
  app.use(express.json());
  app.use(cookieParser());

  // Rate limiting on the public auth mutations. Skipped by default in tests so
  // the test suite is not throttled; a dedicated test passes an explicit limit.
  const skipRateLimit = !options.authRateLimit && env.NODE_ENV === "test";
  const authLimiter = rateLimit({
    windowMs: options.authRateLimit?.windowMs ?? env.AUTH_RATE_LIMIT_WINDOW_MS,
    limit: options.authRateLimit?.limit ?? env.AUTH_RATE_LIMIT_MAX,
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => skipRateLimit,
    message: {
      error: {
        code: "RATE_LIMITED",
        message: "Too many requests. Please try again later.",
      },
    },
  });

  app.use("/api/auth/login", authLimiter);
  app.use("/api/auth/register", authLimiter);

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true });
  });

  app.use("/api/auth", authRouter);
  app.use("/api/admin", adminRouter);
  app.use("/api/barber", barberRouter);
  app.use("/api/barbers", barbersRouter);
  app.use("/api/bookings", bookingRouter);

  app.use((_req, res) => {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Route not found." } });
  });

  app.use(errorHandler);

  return app;
}
