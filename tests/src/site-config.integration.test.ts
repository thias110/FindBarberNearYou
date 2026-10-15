// Configuration publique du site (issues #58, #59) : seules les valeurs
// configurées sont exposées, et aucun secret n'y figure.
import request from "supertest";
import { afterEach, describe, expect, it } from "vitest";
import { createApp } from "../../server/src/app";
import { env } from "../../server/src/config/env";

const app = createApp();
const KEYS = [
  "SUPPORT_EMAIL",
  "SOCIAL_INSTAGRAM_URL",
  "SOCIAL_FACEBOOK_URL",
  "SOCIAL_TIKTOK_URL",
  "SOCIAL_LINKEDIN_URL",
  "LEGAL_OPERATOR_NAME",
  "LEGAL_OPERATOR_ADDRESS",
] as const;
const saved = Object.fromEntries(KEYS.map((key) => [key, env[key]]));

afterEach(() => {
  Object.assign(env, saved);
});

describe("GET /api/site-config", () => {
  it("renvoie des valeurs nulles et aucun réseau quand rien n'est configuré", async () => {
    for (const key of KEYS) env[key] = undefined;
    const res = await request(app).get("/api/site-config");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      supportEmail: null,
      socialLinks: [],
      legal: { operatorName: null, operatorAddress: null },
    });
  });

  it("n'expose que les réseaux configurés, dans un ordre stable", async () => {
    for (const key of KEYS) env[key] = undefined;
    env.SUPPORT_EMAIL = "aide@example.com";
    env.SOCIAL_TIKTOK_URL = "https://www.tiktok.com/@findbarber";
    env.SOCIAL_INSTAGRAM_URL = "https://www.instagram.com/findbarber";
    env.LEGAL_OPERATOR_NAME = "FindBarber Sàrl";

    const res = await request(app).get("/api/site-config");
    expect(res.body.supportEmail).toBe("aide@example.com");
    expect(res.body.socialLinks).toEqual([
      { network: "instagram", url: "https://www.instagram.com/findbarber" },
      { network: "tiktok", url: "https://www.tiktok.com/@findbarber" },
    ]);
    expect(res.body.legal).toEqual({
      operatorName: "FindBarber Sàrl",
      operatorAddress: null,
    });
    expect(JSON.stringify(res.body)).not.toMatch(/JWT|STRIPE|secret/i);
  });
});
