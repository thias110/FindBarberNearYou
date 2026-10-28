import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";
import { z } from "zod";

// Load the first existing .env file. Paths are resolved from this file so they
// work both in dev (tsx from src/) and in the compiled bundle (dist/index.js).
const envFileCandidates = [
  fileURLToPath(new URL("../../../.env", import.meta.url)), // dev: src/config/env.ts -> repo root
  fileURLToPath(new URL("../../.env", import.meta.url)), // compiled: dist/index.js -> repo root
  path.resolve(process.cwd(), ".env"), // fallback: current working directory
];

for (const file of envFileCandidates) {
  if (existsSync(file)) {
    config({ path: file });
    break;
  }
}

// Variable facultative : vide (`VAR=` comme dans .env.example) équivaut à absente.
function optionalString<T extends z.ZodTypeAny>(schema: T) {
  return z.preprocess(
    (value) =>
      typeof value === "string" && value.trim() === "" ? undefined : value,
    schema.optional(),
  );
}

const httpsUrl = z
  .string()
  .url()
  .refine((value) => value.startsWith("https://"), "URL https:// attendue.");

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  CORS_ORIGIN: z.string().min(1).default("http://localhost:5173"),
  DATABASE_URL: z.string().optional(),
  PGLITE_DATA_DIR: z.string().optional(),
  // Pilote de base de données. Absent → déduit de NODE_ENV (postgres en
  // production, pglite sinon). Sert à exécuter PostgreSQL sans activer les
  // comportements de production (cookies Secure, HSTS…) — utile pour la démo
  // Docker locale en HTTP.
  // Vide (`DB_DRIVER=` comme dans .env.example) équivaut à absent.
  DB_DRIVER: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.enum(["pglite", "postgres"]).optional(),
  ),
  // Répertoire racine des fichiers uploadés (avatars, galerie), servi sous
  // `/uploads`. Relatif à la racine d'exécution par défaut.
  UPLOAD_DIR: z.string().min(1).default("./data/uploads"),
  JWT_SECRET: z.string().min(16, "JWT_SECRET must be at least 16 characters."),
  JWT_EXPIRES_IN_SECONDS: z.coerce
    .number()
    .int()
    .positive()
    .max(30 * 24 * 60 * 60)
    .default(7 * 24 * 60 * 60),
  // Rate limiting anti-brute-force (issue #12) : buckets distincts. Login court
  // (anti brute-force), inscription moyen, mutations sensibles global.
  LOGIN_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60_000),
  LOGIN_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(5),
  REGISTER_RATE_LIMIT_WINDOW_MS: z.coerce
    .number()
    .int()
    .positive()
    .default(600_000),
  REGISTER_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(5),
  MUTATION_RATE_LIMIT_WINDOW_MS: z.coerce
    .number()
    .int()
    .positive()
    .default(900_000),
  MUTATION_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(60),
  // Vérification d'email (mission A). Origine du SPA pour construire le lien de
  // vérification (jamais un secret), expéditeur affiché, TTL du jeton et
  // cooldown de renvoi par compte.
  FRONTEND_URL: z.string().min(1).default("http://localhost:5173"),
  // Pages ville pour le référencement (lot N9) : nombre minimal de barbers
  // visibles pour qu'une ville ait sa page (et figure au plan du site).
  CITY_PAGE_MIN_BARBERS: z.coerce.number().int().min(1).default(3),
  EMAIL_FROM: z
    .string()
    .min(1)
    .default("FindBarber <no-reply@findbarber.local>"),
  EMAIL_VERIFICATION_TOKEN_TTL_SECONDS: z.coerce
    .number()
    .int()
    .positive()
    .default(24 * 60 * 60),
  EMAIL_RESEND_COOLDOWN_SECONDS: z.coerce
    .number()
    .int()
    .positive()
    .default(60),
  // Rate limiting du renvoi (bucket IP) et de la consommation du jeton.
  EMAIL_RESEND_RATE_LIMIT_WINDOW_MS: z.coerce
    .number()
    .int()
    .positive()
    .default(600_000),
  EMAIL_RESEND_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(5),
  EMAIL_VERIFY_RATE_LIMIT_WINDOW_MS: z.coerce
    .number()
    .int()
    .positive()
    .default(900_000),
  EMAIL_VERIFY_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(20),
  // Emails (issue #9). Transport : `log` (console, défaut en dev), `smtp`
  // (obligatoire en production), `memory` (tests, défaut quand NODE_ENV=test).
  MAIL_TRANSPORT: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.enum(["log", "smtp", "memory"]).optional(),
  ),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  // true = TLS implicite (port 465) ; false = STARTTLS (port 587).
  SMTP_SECURE: z.preprocess(
    (value) => (value === "" || value === undefined ? undefined : value),
    z.enum(["true", "false"]).default("false"),
  ),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  // Mot de passe oublié : durée de validité du lien et rate limiting IP.
  PASSWORD_RESET_TOKEN_TTL_SECONDS: z.coerce
    .number()
    .int()
    .positive()
    .default(60 * 60),
  PASSWORD_RESET_RATE_LIMIT_WINDOW_MS: z.coerce
    .number()
    .int()
    .positive()
    .default(600_000),
  PASSWORD_RESET_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(5),
  // Paiement en ligne (issue #10, Stripe Connect). Les deux clés absentes =
  // paiement en ligne désactivé (toutes les réservations se paient sur place).
  STRIPE_SECRET_KEY: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.string().optional(),
  ),
  STRIPE_WEBHOOK_SECRET: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.string().optional(),
  ),
  // Commission de la plateforme, en % du montant payé en ligne (0 à 50).
  STRIPE_PLATFORM_FEE_PERCENT: z.coerce.number().min(0).max(50).default(0),
  // Chiffrement au repos des champs sensibles (issue #14), AES-256-GCM.
  // 32 octets encodés en base64. Obligatoire en production ; en dev/test, une
  // clé de développement fixe est utilisée (jamais pour de vraies données).
  FIELD_ENCRYPTION_KEY: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.string().optional(),
  ),
  // Nombre de hops de proxy de confiance (entier, 0 = aucun proxy).
  // Absent ou vide → aucun trust proxy (défaut Express `false`, jamais `true`).
  // Obligatoire en production (voir plus bas).
  TRUST_PROXY_HOPS: z.preprocess(
    (value) => (value === "" || value === undefined ? undefined : value),
    z.coerce.number().int().min(0).max(10).optional(),
  ),
  // Clé API MapTiler côté SERVEUR pour géocoder l'adresse client (AT_CLIENT).
  // Secret serveur : jamais exposé au navigateur. Absente → géocodage
  // indisponible et réservations AT_CLIENT refusées.
  MAPTILER_GEOCODING_API_KEY: z.string().optional(),
  // Informations publiques du site (issues #58, #59) : affichées dans le
  // footer et les mentions légales, servies par GET /api/site-config. Vide =
  // non configuré (le lien correspondant n'est pas affiché).
  SUPPORT_EMAIL: optionalString(z.string().email()),
  SOCIAL_INSTAGRAM_URL: optionalString(httpsUrl),
  SOCIAL_FACEBOOK_URL: optionalString(httpsUrl),
  SOCIAL_TIKTOK_URL: optionalString(httpsUrl),
  SOCIAL_LINKEDIN_URL: optionalString(httpsUrl),
  // Éditeur du site pour les mentions légales (raison sociale ou nom, adresse).
  LEGAL_OPERATOR_NAME: optionalString(z.string().max(200)),
  LEGAL_OPERATOR_ADDRESS: optionalString(z.string().max(500)),
});

const parsedEnv = envSchema.parse(process.env);

export const env = {
  ...parsedEnv,
  MAIL_TRANSPORT:
    parsedEnv.MAIL_TRANSPORT ??
    (parsedEnv.NODE_ENV === "test" ? ("memory" as const) : ("log" as const)),
};

const EXAMPLE_SECRETS = [
  "change-me",
  "change-me-to-a-long-random-secret",
  "your-secret-key-here",
  "secret",
  "changeme",
  "password",
];

if (env.NODE_ENV === "production") {
  if (!env.DATABASE_URL) {
    throw new Error(
      "DATABASE_URL is required when NODE_ENV=production (PostgreSQL driver).",
    );
  }
  if (
    !env.FIELD_ENCRYPTION_KEY ||
    Buffer.from(env.FIELD_ENCRYPTION_KEY, "base64").length !== 32
  ) {
    throw new Error(
      "FIELD_ENCRYPTION_KEY (32 bytes, base64) is required when NODE_ENV=production.",
    );
  }
  // Mal réglé, soit toutes les requêtes semblent venir du proxy (une seule
  // personne bloque la connexion de tous), soit l'IP se falsifie par
  // `X-Forwarded-For` et les limites de débit ne servent plus à rien.
  if (env.TRUST_PROXY_HOPS === undefined) {
    throw new Error(
      "TRUST_PROXY_HOPS is required when NODE_ENV=production: the number of reverse proxies in front of Node (1 behind Nginx, 0 without proxy).",
    );
  }
  if (env.MAIL_TRANSPORT !== "smtp" || !env.SMTP_HOST) {
    throw new Error(
      "MAIL_TRANSPORT=smtp and SMTP_HOST are required when NODE_ENV=production (verification, password reset and booking emails).",
    );
  }
  if (
    env.JWT_SECRET.length < 32 ||
    EXAMPLE_SECRETS.includes(env.JWT_SECRET.trim().toLowerCase())
  ) {
    throw new Error(
      "JWT_SECRET must be a strong random value (>= 32 chars) and must not be an example/placeholder value in production.",
    );
  }
}
