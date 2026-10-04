import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import {
  configureTrustProxy,
  securityHeaders,
} from "../../server/src/middleware/security";

function appWithHeaders(isProduction: boolean): express.Express {
  const app = express();
  app.disable("x-powered-by");
  app.use("/api", securityHeaders(isProduction));
  app.get("/api/health", (_req, res) => res.json({ ok: true }));
  return app;
}

describe("securityHeaders", () => {
  it("pose les en-têtes de sécurité de base sur /api", async () => {
    const res = await request(appWithHeaders(false)).get("/api/health");

    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.headers["x-frame-options"]).toBe("DENY");
    expect(res.headers["referrer-policy"]).toBe("no-referrer");
    expect(res.headers["content-security-policy"]).toContain(
      "default-src 'none'",
    );
    expect(res.headers["content-security-policy"]).toContain(
      "frame-ancestors 'none'",
    );
    expect(res.headers["x-powered-by"]).toBeUndefined();
    expect(res.headers["strict-transport-security"]).toBeUndefined();
  });

  it("ajoute HSTS uniquement en production", async () => {
    const res = await request(appWithHeaders(true)).get("/api/health");
    expect(res.headers["strict-transport-security"]).toContain(
      "max-age=31536000",
    );
    expect(res.headers["strict-transport-security"]).toContain(
      "includeSubDomains",
    );
  });
});

describe("configureTrustProxy", () => {
  it("applique un nombre de hops explicite", () => {
    const app = express();
    configureTrustProxy(app, 2);
    expect(app.get("trust proxy")).toBe(2);
  });

  it("ne touche pas au réglage si aucun hops n'est fourni", () => {
    const app = express();
    configureTrustProxy(app);
    // Express laisse la valeur par défaut `false` (aucune confiance).
    expect(app.get("trust proxy")).toBe(false);
  });
});
