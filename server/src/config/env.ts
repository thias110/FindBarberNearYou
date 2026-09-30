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

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  CORS_ORIGIN: z.string().min(1).default("http://localhost:5173"),
  DATABASE_URL: z.string().optional(),
  PGLITE_DATA_DIR: z.string().optional(),
  JWT_SECRET: z.string().min(16, "JWT_SECRET must be at least 16 characters."),
  JWT_EXPIRES_IN_SECONDS: z.coerce
    .number()
    .int()
    .positive()
    .max(30 * 24 * 60 * 60)
    .default(7 * 24 * 60 * 60),
  AUTH_RATE_LIMIT_WINDOW_MS: z.coerce
    .number()
    .int()
    .positive()
    .default(15 * 60 * 1000),
  AUTH_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(20),
});

export const env = envSchema.parse(process.env);

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
    env.JWT_SECRET.length < 32 ||
    EXAMPLE_SECRETS.includes(env.JWT_SECRET.trim().toLowerCase())
  ) {
    throw new Error(
      "JWT_SECRET must be a strong random value (>= 32 chars) and must not be an example/placeholder value in production.",
    );
  }
}
