import { Router } from "express";
import { env } from "../../config/env.js";
import { isCitySlug } from "../../lib/slug.js";
import {
  renderCityPage,
  renderNotFoundPage,
  renderRobots,
  renderSitemap,
} from "./html.js";
import { getCityPage, listCityPages } from "./service.js";

// Pages ville, plan du site et robots.txt (lot N9). Publics, en lecture
// seule, servis en HTML ou en texte (pas en JSON) : Nginx les relaie vers
// l'API (voir nginx.conf). Limités en débit et mis en cache par app.ts.

export interface SeoOptions {
  /** Nombre minimal de barbers visibles pour qu'une ville ait une page. */
  minBarbers: number;
}

// Origine publique du site, sans barre finale : base des liens canoniques et du plan.
function baseUrl(): string {
  return env.FRONTEND_URL.replace(/\/+$/, "");
}

const CACHE_CONTROL = "public, max-age=600";

export function createCityPageRouter({ minBarbers }: SeoOptions): Router {
  const router = Router();

  router.get("/:slug", async (req, res) => {
    const slug = req.params.slug ?? "";
    const page = isCitySlug(slug) ? await getCityPage(slug, minBarbers) : null;
    res.type("html");
    if (!page) {
      res.status(404).send(renderNotFoundPage());
      return;
    }
    res.setHeader("Cache-Control", CACHE_CONTROL);
    res.send(
      renderCityPage({
        baseUrl: baseUrl(),
        city: page.city,
        barbers: page.barbers,
      }),
    );
  });

  return router;
}

export function createSitemapRouter({ minBarbers }: SeoOptions): Router {
  const router = Router();

  router.get("/sitemap.xml", async (_req, res) => {
    const cities = await listCityPages(minBarbers);
    res.setHeader("Cache-Control", CACHE_CONTROL);
    res.type("application/xml").send(renderSitemap(baseUrl(), cities));
  });

  router.get("/robots.txt", (_req, res) => {
    res.setHeader("Cache-Control", CACHE_CONTROL);
    res.type("text/plain").send(renderRobots(baseUrl()));
  });

  return router;
}
