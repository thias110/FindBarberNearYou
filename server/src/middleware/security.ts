import type { Express, RequestHandler } from "express";
import helmet from "helmet";

/**
 * Configure `trust proxy` UNIQUEMENT si un nombre de hops explicite est fourni.
 * - Absent → on ne touche pas au réglage : Express reste sur `false` (aucune
 *   confiance dans `X-Forwarded-For`), ce qui est le choix sûr par défaut.
 * - Jamais `true` (booléen) : `express-rate-limit` le refuse en prod.
 */
export function configureTrustProxy(app: Express, hops?: number): void {
  if (hops !== undefined) {
    app.set("trust proxy", hops);
  }
}

/**
 * En-têtes de sécurité des pages HTML servies par l'API (pages ville, lot N9).
 * Aucun script : seuls des styles en ligne et les images de l'origine (avatars).
 */
export function seoPageHeaders(isProduction: boolean): RequestHandler {
  return helmet({
    contentSecurityPolicy: {
      useDefaults: false,
      directives: {
        defaultSrc: ["'none'"],
        styleSrc: ["'unsafe-inline'"],
        imgSrc: ["'self'", "data:"],
        frameAncestors: ["'none'"],
        baseUri: ["'none'"],
        formAction: ["'none'"],
      },
    },
    crossOriginEmbedderPolicy: false,
    hsts: isProduction
      ? { maxAge: 31_536_000, includeSubDomains: true, preload: false }
      : false,
    referrerPolicy: { policy: "strict-origin-when-cross-origin" },
    xFrameOptions: { action: "deny" },
  });
}

/**
 * En-têtes de sécurité pour l'API `/api` (JSON uniquement).
 * - HSTS uniquement en production (le dev/test se fait en HTTP).
 * - CSP minimale pour des réponses JSON : `default-src 'none'`.
 * - CORP `cross-origin` : l'API est consommée par un SPA d'une autre origine.
 */
export function securityHeaders(isProduction: boolean): RequestHandler {
  return helmet({
    contentSecurityPolicy: {
      useDefaults: false,
      directives: {
        defaultSrc: ["'none'"],
        frameAncestors: ["'none'"],
        baseUri: ["'none'"],
        formAction: ["'none'"],
      },
    },
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
    hsts: isProduction
      ? { maxAge: 31_536_000, includeSubDomains: true, preload: false }
      : false,
    referrerPolicy: { policy: "no-referrer" },
    xFrameOptions: { action: "deny" },
  });
}
