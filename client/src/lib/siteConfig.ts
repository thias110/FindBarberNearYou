import { useEffect, useState } from "react";
import type { SiteConfigResponse } from "@findbarber/shared/types";
import { siteApi } from "./apiClient";

// Configuration publique du site (issues #58, #59), chargée une seule fois et
// partagée entre le footer et les mentions légales. En cas d'erreur, rien
// n'est affiché plutôt qu'un lien vide.
const EMPTY: SiteConfigResponse = {
  supportEmail: null,
  socialLinks: [],
  legal: { operatorName: null, operatorAddress: null },
};

let pending: Promise<SiteConfigResponse> | null = null;

function loadSiteConfig(): Promise<SiteConfigResponse> {
  pending ??= siteApi.config().catch(() => {
    pending = null;
    return EMPTY;
  });
  return pending;
}

export function useSiteConfig(): SiteConfigResponse {
  const [config, setConfig] = useState<SiteConfigResponse>(EMPTY);
  useEffect(() => {
    let active = true;
    void loadSiteConfig().then((value) => {
      if (active) setConfig(value);
    });
    return () => {
      active = false;
    };
  }, []);
  return config;
}
