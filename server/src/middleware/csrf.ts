import type { RequestHandler } from "express";
import { timingSafeEqual } from "node:crypto";
import { AppError } from "../lib/errors.js";

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export const csrfProtection: RequestHandler = (req, _res, next) => {
  if (!MUTATING_METHODS.has(req.method)) {
    return next();
  }
  // Only enforce when authenticated (must be chained after requireAuth).
  if (!req.auth) {
    return next();
  }
  const header = req.header("x-csrf-token");
  if (!header || !req.auth.csrf || !safeEqual(header, req.auth.csrf)) {
    return next(new AppError(403, "CSRF_INVALID", "Missing or invalid CSRF token."));
  }
  next();
};

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}
