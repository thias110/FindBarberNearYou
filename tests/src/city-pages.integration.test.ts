// Pages ville pour le référencement (lot N9) : HTML servi par l'API, plan du
// site et robots.txt. Données publiques seulement, échappement du contenu,
// seuil de barbers, visibilité (approuvé et actif), limitation de débit.
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import request from "supertest";
import { createApp } from "../../server/src/app";
import { env } from "../../server/src/config/env";
import { db } from "../../server/src/db/client";
import { migrateDb } from "../../server/src/db/migrate";
import { barberProfiles, users } from "@findbarber/shared/schema";
import {
  CITY_INDEX_TTL_MS,
  clearCityIndexCache,
  listCityPages,
} from "../../server/src/modules/seo/service";
import { resetBookingTables, seedBarber } from "./booking-api-helpers";

const BASE = env.FRONTEND_URL.replace(/\/+$/, "");
const app = createApp({ cityPageMinBarbers: 3 });

beforeAll(async () => {
  await migrateDb();
});

beforeEach(async () => {
  await resetBookingTables();
  clearCityIndexCache();
});

let counter = 0;

/** Crée `cities.length` barbers approuvés, un par ville donnée (pays : `country`). */
async function seedIn(
  cities: string[],
  displayName = "Barbier Test",
  country = "CH",
) {
  const seeded = [];
  for (const city of cities) {
    counter += 1;
    const barber = await seedBarber(`city-${counter}@example.com`);
    await db
      .update(barberProfiles)
      .set({ city, countryCode: country, displayName: `${displayName} ${counter}` })
      .where(eq(barberProfiles.id, barber.profileId));
    seeded.push(barber);
  }
  return seeded;
}

function ldJson(html: string): Record<string, unknown> {
  const match = html.match(/<script type="application\/ld\+json">(.*?)<\/script>/s);
  expect(match).not.toBeNull();
  return JSON.parse(match![1]!) as Record<string, unknown>;
}

describe("GET /barbers/ville/:slug", () => {
  it("sert une page HTML avec les barbers publics de la ville", async () => {
    const barbers = await seedIn(["Genève", "Genève", "Genève"]);
    const res = await request(app).get("/barbers/ville/geneve");

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("text/html");
    expect(res.headers["cache-control"]).toContain("max-age=600");
    expect(res.text).toContain("<h1>Barbers à Genève</h1>");
    expect(res.text).toContain(`<link rel="canonical" href="${BASE}/barbers/ville/geneve">`);
    expect(res.text).toContain('<meta name="robots" content="index,follow">');
    expect(res.text).toContain('href="/barbers?city=Gen%C3%A8ve"');
    for (const barber of barbers) {
      expect(res.text).toContain(`href="/barbers/${barber.profileId}"`);
    }

    const ld = ldJson(res.text) as {
      "@type": string;
      itemListElement: { item: { "@type": string; address: Record<string, string> } }[];
    };
    expect(ld["@type"]).toBe("ItemList");
    expect(ld.itemListElement).toHaveLength(3);
    expect(ld.itemListElement[0]!.item["@type"]).toBe("BarberShop");
    expect(ld.itemListElement[0]!.item.address.addressLocality).toBe("Genève");
  });

  it("n'expose aucune donnée privée", async () => {
    await seedIn(["Genève", "Genève", "Genève"]);
    const res = await request(app).get("/barbers/ville/geneve");
    expect(res.text).not.toContain("Rue du Test");
    expect(res.text).not.toContain("@example.com");
    expect(res.text).not.toMatch(/46\.20|6\.14/);
  });

  it("pose des en-têtes de sécurité sans script", async () => {
    await seedIn(["Genève", "Genève", "Genève"]);
    const res = await request(app).get("/barbers/ville/geneve");
    const csp = res.headers["content-security-policy"] as string;
    expect(csp).toContain("default-src 'none'");
    expect(csp).not.toContain("script-src");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.headers["x-powered-by"]).toBeUndefined();
  });

  it("échappe le contenu venant de la base (HTML et JSON-LD)", async () => {
    const evil = '</script><script>alert(1)</script> & "x"';
    await seedIn(["Genève", "Genève", "Genève"], evil);
    const res = await request(app).get("/barbers/ville/geneve");

    expect(res.text).not.toContain("<script>alert(1)");
    expect(res.text).toContain("&lt;/script&gt;&lt;script&gt;alert(1)");
    // Un seul bloc <script> : le JSON-LD ; le texte dangereux n'en ferme aucun.
    expect(res.text.match(/<script/g)).toHaveLength(1);
    expect(res.text.match(/<\/script>/g)).toHaveLength(1);

    const ld = ldJson(res.text) as {
      itemListElement: { item: { name: string } }[];
    };
    expect(ld.itemListElement[0]!.item.name).toContain(evil);
  });

  it("accorde « barber » au singulier avec un seul barber (seuil abaissé)", async () => {
    await seedIn(["Genève"]);
    const single = createApp({ cityPageMinBarbers: 1 });
    const res = await request(single).get("/barbers/ville/geneve");
    expect(res.status).toBe(200);
    expect(res.text).toContain("1 barber à Genève");
    expect(res.text).not.toContain("1 barbers");
  });

  it("échappe aussi le nom de ville (titre, texte) et encode le lien de recherche", async () => {
    const city = "Saint-Étienne <b> & 'x'";
    await seedIn([city, city, city]);
    const res = await request(app).get("/barbers/ville/saint-etienne-b-x");

    expect(res.status).toBe(200);
    expect(res.text).not.toContain("<b>");
    expect(res.text).toContain("Saint-Étienne &lt;b&gt; &amp; &#39;x&#39;");
    expect(res.text).toContain(`href="/barbers?city=${encodeURIComponent(city)}"`);
  });

  it("sépare deux villes de même nom dans des pays différents", async () => {
    await seedIn(["Saint-Denis", "Saint-Denis", "Saint-Denis"], "Metropole", "FR");
    await seedIn(["Saint-Denis", "Saint-Denis", "Saint-Denis"], "Reunion", "RE");

    const main = await request(app).get("/barbers/ville/saint-denis");
    const other = await request(app).get("/barbers/ville/saint-denis-re");
    expect(main.status).toBe(200);
    expect(other.status).toBe(200);
    // Égalité de barbers : le code pays le plus petit garde l'identifiant simple.
    expect(main.text).toContain("Metropole");
    expect(main.text).not.toContain("Reunion");
    expect(other.text).toContain("Reunion");
    expect(other.text).not.toContain("Metropole");
    expect(main.text).toContain("<h1>Barbers à Saint-Denis (France)</h1>");
    expect(other.text).toContain("Réunion");

    const sitemap = await request(app).get("/sitemap.xml");
    expect(sitemap.text).toContain("/barbers/ville/saint-denis</loc>");
    expect(sitemap.text).toContain("/barbers/ville/saint-denis-re</loc>");
  });

  it("regroupe les orthographes d'une même ville", async () => {
    await seedIn(["Genève", "GENÈVE", "geneve"]);
    const res = await request(app).get("/barbers/ville/geneve");
    expect(res.status).toBe(200);
    expect(res.text.match(/href="\/barbers\/[0-9a-f-]{36}"/g)).toHaveLength(3);
  });

  it("répond 404 sous le seuil, sans indexation", async () => {
    await seedIn(["Genève", "Genève", "Lausanne"]);
    const res = await request(app).get("/barbers/ville/geneve");
    expect(res.status).toBe(404);
    expect(res.headers["content-type"]).toContain("text/html");
    expect(res.text).toContain('<meta name="robots" content="noindex,follow">');
    expect(res.text).not.toContain("<link rel=\"canonical\"");
  });

  it("ne compte que les barbers approuvés et actifs", async () => {
    const barbers = await seedIn(["Genève", "Genève", "Genève", "Genève", "Genève"]);
    await db
      .update(barberProfiles)
      .set({ approvedAt: null })
      .where(eq(barberProfiles.id, barbers[0]!.profileId));
    await db
      .update(users)
      .set({ status: "SUSPENDED" })
      .where(eq(users.id, barbers[1]!.userId));

    const res = await request(app).get("/barbers/ville/geneve");
    expect(res.status).toBe(200);
    expect(res.text).not.toContain(`/barbers/${barbers[0]!.profileId}"`);
    expect(res.text).not.toContain(`/barbers/${barbers[1]!.profileId}"`);
    expect(res.text.match(/href="\/barbers\/[0-9a-f-]{36}"/g)).toHaveLength(3);

    // Deux barbers de moins : on retombe sous le seuil de 3 (cache vidé).
    await db
      .update(users)
      .set({ status: "SUSPENDED" })
      .where(eq(users.id, barbers[2]!.userId));
    clearCityIndexCache();
    expect((await request(app).get("/barbers/ville/geneve")).status).toBe(404);
  });

  it("répond 404 pour un identifiant inconnu ou mal formé", async () => {
    await seedIn(["Genève", "Genève", "Genève"]);
    const bad = ["lausanne", "Geneve", "gen_eve", "geneve-", "-geneve", "a".repeat(81), "%2e%2e"];
    for (const slug of bad) {
      const res = await request(app).get(`/barbers/ville/${slug}`);
      expect(res.status, slug).toBe(404);
    }
  });

  it("garde la réponse en mémoire 10 minutes, puis relit la base", async () => {
    const t0 = 1_000_000;
    await seedIn(["Genève", "Genève", "Genève"]);
    expect((await listCityPages(3, t0)).map((c) => c.slug)).toEqual(["geneve"]);

    await seedIn(["Lausanne", "Lausanne", "Lausanne"]);
    expect((await listCityPages(3, t0 + CITY_INDEX_TTL_MS - 1)).map((c) => c.slug)).toEqual([
      "geneve",
    ]);
    expect((await listCityPages(3, t0 + CITY_INDEX_TTL_MS + 1)).map((c) => c.slug)).toEqual([
      "geneve",
      "lausanne",
    ]);
  });

  it("le limiteur ne touche que ces pages, jamais les autres routes", async () => {
    const limited = createApp({
      cityPageMinBarbers: 3,
      rateLimits: { seo: { windowMs: 60_000, limit: 1 } },
    });
    // Routes déclarées après le routeur SEO : elles ne doivent pas être limitées.
    for (let i = 0; i < 3; i += 1) {
      expect((await request(limited).get("/api/barbers")).status).toBe(200);
    }
    // Le plan du site partage le limiteur des pages ville.
    expect((await request(limited).get("/sitemap.xml")).status).toBe(200);
    expect((await request(limited).get("/robots.txt")).status).toBe(429);
  });

  it("limite le débit (429)", async () => {
    const limited = createApp({
      cityPageMinBarbers: 3,
      rateLimits: { seo: { windowMs: 60_000, limit: 2 } },
    });
    const statuses: number[] = [];
    for (let i = 0; i < 3; i += 1) {
      statuses.push((await request(limited).get("/barbers/ville/geneve")).status);
    }
    expect(statuses).toEqual([404, 404, 429]);
  });
});

describe("GET /sitemap.xml et /robots.txt", () => {
  it("liste les pages publiques et les villes assez fournies", async () => {
    await seedIn(["Genève", "Genève", "Genève", "Lausanne", "Lausanne"]);
    const res = await request(app).get("/sitemap.xml");

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("application/xml");
    expect(res.headers["cache-control"]).toContain("max-age=600");
    expect(res.text).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');
    expect(res.text).toContain(`<loc>${BASE}/barbers/ville/geneve</loc>`);
    expect(res.text).not.toContain("lausanne");
    for (const path of ["/", "/barbers", "/aide", "/mentions-legales"]) {
      expect(res.text).toContain(`<loc>${BASE}${path}</loc>`);
    }
  });

  it("robots.txt ferme les espaces privés et indique le plan du site", async () => {
    const res = await request(app).get("/robots.txt");
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("text/plain");
    expect(res.text).toContain("User-agent: *");
    expect(res.text).toContain("Disallow: /api/");
    expect(res.text).toContain("Disallow: /pro/");
    expect(res.text).toContain(`Sitemap: ${BASE}/sitemap.xml`);
  });
});
