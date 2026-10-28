// Configuration de production (audit de sécurité) : `TRUST_PROXY_HOPS` doit
// être explicite. Absent derrière Nginx, toutes les requêtes semblent venir de
// la même IP (une seule personne bloque la connexion de tous) ; trop grand,
// l'IP se falsifie et les limites de débit tombent. 0 = aucun proxy.
// La validation s'exécute au chargement du module : un processus par cas.
import { spawnSync } from "node:child_process";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(__dirname, "../..");
const envModule = path.join(root, "server/src/config/env.ts");

const PRODUCTION = {
  NODE_ENV: "production",
  DATABASE_URL: "postgres://user:pass@localhost:5432/db",
  FIELD_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString("base64"),
  JWT_SECRET: "a".repeat(16) + "b".repeat(16) + "c".repeat(8),
  MAIL_TRANSPORT: "smtp",
  SMTP_HOST: "smtp.example.com",
};

function loadEnv(extra: Record<string, string>) {
  const result = spawnSync(
    process.execPath,
    ["--import", "tsx", "-e", `await import(${JSON.stringify(`file://${envModule.replace(/\\/g, "/")}`)})`],
    {
      cwd: root,
      encoding: "utf8",
      // Isolé de l'environnement local (.env compris : dotenv n'écrase pas).
      env: { PATH: process.env.PATH ?? "", SYSTEMROOT: process.env.SYSTEMROOT ?? "", ...PRODUCTION, ...extra },
    },
  );
  return { ok: result.status === 0, stderr: result.stderr };
}

describe("TRUST_PROXY_HOPS en production", () => {
  it("refuse de démarrer sans valeur explicite", () => {
    const { ok, stderr } = loadEnv({});
    expect(ok).toBe(false);
    expect(stderr).toContain("TRUST_PROXY_HOPS");
  });

  it("accepte 1 (derrière Nginx) et 0 (aucun proxy)", () => {
    expect(loadEnv({ TRUST_PROXY_HOPS: "1" }).ok).toBe(true);
    expect(loadEnv({ TRUST_PROXY_HOPS: "0" }).ok).toBe(true);
  });
});
