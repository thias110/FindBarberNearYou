import { rateLimit } from "express-rate-limit";

export interface RateLimiterInput {
  windowMs: number;
  limit: number;
  /** `true` désactive le limiteur (utilisé par les tests sans option). */
  skip?: boolean;
  /** Filtre supplémentaire (ex. ne compter que les méthodes mutantes). */
  skipWhen?: (req: { method: string }) => boolean;
}

export const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/**
 * Fabrique de limiteur avec la réponse 429 normalisée du projet
 * (`{ error: { code: "RATE_LIMITED", message } }`) et les en-têtes standards
 * `RateLimit-*` / `Retry-After`.
 */
export function createRateLimiter({
  windowMs,
  limit,
  skip,
  skipWhen,
}: RateLimiterInput) {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req, _res) => {
      if (skip) return true;
      if (skipWhen && skipWhen(req)) return true;
      return false;
    },
    message: {
      error: {
        code: "RATE_LIMITED",
        message: "Too many requests. Please try again later.",
      },
    },
  });
}
