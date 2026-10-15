import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { env } from "../config/env.js";

// --- Chiffrement au repos des champs sensibles (issue #14) ---
// AES-256-GCM (confidentialité + intégrité). Format stocké :
//   enc:v1:<iv base64>:<tag base64>:<chiffré base64>
// Une valeur sans préfixe est une donnée héritée en clair : elle est relue
// telle quelle (puis effacée par la purge de rétention).

const PREFIX = "enc:v1:";

function loadKey(): Buffer {
  if (env.FIELD_ENCRYPTION_KEY) {
    const key = Buffer.from(env.FIELD_ENCRYPTION_KEY, "base64");
    if (key.length !== 32) {
      throw new Error("FIELD_ENCRYPTION_KEY must decode to 32 bytes (base64).");
    }
    return key;
  }
  // Développement / tests uniquement (la production exige une vraie clé, voir
  // config/env.ts) : clé fixe, publique, à ne jamais utiliser pour de vraies
  // données.
  return createHash("sha256").update("findbarber-dev-only-field-key").digest();
}

const KEY = loadKey();

export function encryptField(value: string): string;
export function encryptField(value: string | null): string | null;
export function encryptField(value: string | null): string | null {
  if (value === null) return null;
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", KEY, iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return `${PREFIX}${iv.toString("base64")}:${cipher.getAuthTag().toString("base64")}:${encrypted.toString("base64")}`;
}

export function decryptField(value: string | null): string | null {
  if (value === null || !value.startsWith(PREFIX)) return value;
  const [iv, tag, data] = value.slice(PREFIX.length).split(":");
  const decipher = createDecipheriv("aes-256-gcm", KEY, Buffer.from(iv, "base64"));
  decipher.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(data, "base64")),
    decipher.final(),
  ]).toString("utf8");
}
