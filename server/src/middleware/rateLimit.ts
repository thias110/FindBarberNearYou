import type { Request } from "express";
import { rateLimit } from "express-rate-limit";

export interface RateLimiterInput {
  windowMs: number;
  limit: number;
  /** `true` désactive le limiteur (utilisé par les tests sans option). */
  skip?: boolean;
  /** Filtre supplémentaire (ex. ne compter que les méthodes mutantes). */
  skipWhen?: (req: { method: string }) => boolean;
  /**
   * Clé du compteur autre que l'IP (compte visé, barber…). Une clé absente
   * (champ manquant) laisse passer : la validation de la route répondra.
   */
  key?: (req: Request) => string | undefined;
  /** Ne compter que les échecs (réponse >= 400). */
  skipSuccessfulRequests?: boolean;
}

/** Champ texte du corps JSON, normalisé (minuscules, sans espaces autour). */
export function bodyField(name: string) {
  return (req: Request): string | undefined => {
    const value = (req.body as Record<string, unknown> | undefined)?.[name];
    return typeof value === "string" && value.trim() ? value.trim().toLowerCase() : undefined;
  };
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
  key,
  skipSuccessfulRequests,
}: RateLimiterInput) {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests,
    ...(key ? { keyGenerator: (req) => key(req as Request) ?? "" } : {}),
    skip: (req, _res) => {
      if (skip) return true;
      if (skipWhen && skipWhen(req)) return true;
      if (key && key(req as Request) === undefined) return true;
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
