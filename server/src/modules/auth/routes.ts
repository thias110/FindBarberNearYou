import { Router } from "express";
import type { ZodError } from "zod";
import { registerSchema, loginSchema } from "@findbarber/shared/validation";
import { requireAuth } from "../../middleware/auth.js";
import { csrfProtection } from "../../middleware/csrf.js";
import { AppError } from "../../lib/errors.js";
import { AUTH_COOKIE, CSRF_COOKIE } from "../../lib/cookies.js";
import { env } from "../../config/env.js";
import { registerUser, loginUser } from "./service.js";

export const authRouter = Router();

function validationError(err: ZodError): AppError {
  const details = err.issues
    .map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`)
    .join("; ");
  return new AppError(400, "VALIDATION_ERROR", details);
}

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

authRouter.get("/me", requireAuth, (req, res) => {
  res.json({ user: req.user });
});
