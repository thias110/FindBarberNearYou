// Configuration publique du site (issues #58, #59) : adresse de support,
// réseaux sociaux et éditeur, lus dans l'environnement serveur. Rien n'est
// écrit en dur dans le code client ; changer une valeur ne demande pas de
// rebuild du front.
import { Router } from "express";
import type { SiteConfigResponse, SocialNetwork } from "@findbarber/shared/types";
import { env } from "../../config/env.js";

export function siteConfig(): SiteConfigResponse {
  const social: [SocialNetwork, string | undefined][] = [
    ["instagram", env.SOCIAL_INSTAGRAM_URL],
    ["facebook", env.SOCIAL_FACEBOOK_URL],
    ["tiktok", env.SOCIAL_TIKTOK_URL],
    ["linkedin", env.SOCIAL_LINKEDIN_URL],
  ];
  return {
    supportEmail: env.SUPPORT_EMAIL ?? null,
    socialLinks: social.flatMap(([network, url]) =>
      url ? [{ network, url }] : [],
    ),
    legal: {
      operatorName: env.LEGAL_OPERATOR_NAME ?? null,
      operatorAddress: env.LEGAL_OPERATOR_ADDRESS ?? null,
    },
  };
}

export const siteRouter = Router();

siteRouter.get("/", (_req, res) => {
  res.setHeader("Cache-Control", "public, max-age=300");
  res.json(siteConfig());
});
