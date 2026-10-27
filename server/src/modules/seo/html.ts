import type { PublicBarberSearchItem } from "@findbarber/shared/types";
import { escapeHtml } from "../../lib/emailTemplates.js";
import type { CityGroup } from "./service.js";

// --- Rendu des pages ville, du plan du site et de robots.txt (lot N9) ---
// Fonctions pures : tout texte venant de la base (nom, ville) est échappé avant
// d'entrer dans le HTML, un attribut ou le JSON-LD. Seules des données
// publiques sortent d'ici (jamais d'adresse, de coordonnées ni de contact).

const SITE_NAME = "FindBarber";

// U+2028 et U+2029 (séparateurs de ligne, invalides dans du JavaScript) ; U+00A0 et
// U+202F (espaces insécables des montants formatés en français).
const LINE_SEPARATORS = new RegExp("[" + String.fromCharCode(0x2028, 0x2029) + "]", "g");
const NO_BREAK_SPACES = new RegExp("[" + String.fromCharCode(0xa0, 0x202f) + "]", "g");

/** JSON sûr dans un `<script>` : `<` devient `\u003c` (pas de `</script>` possible). */
export function jsonForScript(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(LINE_SEPARATORS, " ");
}

function formatPrice(minor: number, currency: string): string {
  const amount = minor / 100;
  return new Intl.NumberFormat("fr", {
    style: "currency",
    currency,
    currencyDisplay: "code",
    minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
    maximumFractionDigits: 2,
  })
    .format(amount)
    .replace(NO_BREAK_SPACES, " ");
}

function formatRating(value: number): string {
  return value.toLocaleString("fr", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
}

function reviewLabel(count: number): string {
  return count === 1 ? "1 avis" : `${count} avis`;
}

function barbersLabel(count: number): string {
  return count === 1 ? "1 barber" : `${count} barbers`;
}

/** « dès 35 CHF » si tous les prix sont dans la même devise, sinon rien. */
function cheapestLabel(barbers: PublicBarberSearchItem[]): string | null {
  const priced = barbers.filter(
    (barber) => barber.startingPriceMinor !== null,
  );
  if (priced.length === 0) return null;
  const currency = priced[0]!.currency;
  if (priced.some((barber) => barber.currency !== currency)) return null;
  const min = Math.min(...priced.map((barber) => barber.startingPriceMinor!));
  return `dès ${formatPrice(min, currency)}`;
}

const STYLE = `
:root{color-scheme:light dark;--bg:#fff;--fg:#0e1528;--muted:#4a5470;--line:#d5dae6;--accent:#1a3cc4;--on-accent:#fff;--soft:#eef1fb}
@media (prefers-color-scheme:dark){:root{--bg:#0a0f1e;--fg:#f2f4fa;--muted:#aab2c8;--line:#27304a;--accent:#8aa2ff;--on-accent:#0a0f1e;--soft:#141b32}}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--fg);font:16px/1.5 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
a{color:var(--accent)}
header,main,footer{max-width:44rem;margin:0 auto;padding:1rem}
header a{font-weight:800;font-size:1.25rem;text-decoration:none}
h1{font-size:1.75rem;line-height:1.2;margin:.5rem 0}
.lead{color:var(--muted);margin:.25rem 0 1rem}
.cta{display:inline-block;min-height:2.75rem;padding:.65rem 1.25rem;border-radius:999px;background:var(--accent);color:var(--on-accent);font-weight:700;text-decoration:none}
.cta:focus-visible,li a:focus-visible,header a:focus-visible,footer a:focus-visible{outline:3px solid var(--accent);outline-offset:2px}
ul{list-style:none;margin:1.5rem 0 0;padding:0;display:grid;gap:.75rem}
li a{display:flex;gap:.75rem;align-items:center;min-height:4.25rem;padding:.75rem;border:1px solid var(--line);border-radius:.875rem;text-decoration:none;color:inherit}
li a:hover{background:var(--soft)}
img,.ph{width:3.5rem;height:3.5rem;border-radius:.625rem;flex:none;object-fit:cover;background:var(--soft)}
.ph{display:flex;align-items:center;justify-content:center;font-weight:800;color:var(--accent)}
.name{display:block;font-weight:700}
.meta{display:block;color:var(--muted);font-size:.9rem}
footer{color:var(--muted);font-size:.9rem;border-top:1px solid var(--line);margin-top:2rem}
footer a{margin-right:1rem}
`.replace(/\n/g, "");

function layout(options: {
  title: string;
  description: string;
  canonical?: string;
  indexable: boolean;
  jsonLd?: unknown;
  body: string;
}): string {
  const { title, description, canonical, indexable, jsonLd, body } = options;
  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeHtml(description)}">
<meta name="robots" content="${indexable ? "index,follow" : "noindex,follow"}">
${canonical ? `<link rel="canonical" href="${escapeHtml(canonical)}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="${SITE_NAME}">
<meta property="og:title" content="${escapeHtml(title)}">
<meta property="og:description" content="${escapeHtml(description)}">
<meta property="og:url" content="${escapeHtml(canonical)}">
` : ""}<link rel="icon" type="image/svg+xml" href="/favicon.svg">
<style>${STYLE}</style>
${jsonLd ? `<script type="application/ld+json">${jsonForScript(jsonLd)}</script>
` : ""}</head>
<body>
<header><a href="/">${SITE_NAME}</a></header>
${body}
<footer><a href="/">Accueil</a><a href="/barbers">Rechercher un barber</a><a href="/aide">Aide</a></footer>
</body>
</html>
`;
}

function barberItem(barber: PublicBarberSearchItem): string {
  const parts: string[] = [];
  if (barber.certified) parts.push("Certifié");
  if (barber.averageRating !== null && barber.reviewCount > 0) {
    parts.push(
      `★ ${formatRating(barber.averageRating)} (${reviewLabel(barber.reviewCount)})`,
    );
  } else {
    parts.push("Nouveau sur FindBarber");
  }
  if (barber.startingPriceMinor !== null) {
    parts.push(`dès ${formatPrice(barber.startingPriceMinor, barber.currency)}`);
  }
  const photo = barber.avatarPath
    ? `<img src="${escapeHtml(barber.avatarPath)}" alt="" width="56" height="56" loading="lazy">`
    : `<span class="ph" aria-hidden="true">${escapeHtml(barber.displayName.charAt(0).toUpperCase())}</span>`;
  return `<li><a href="/barbers/${encodeURIComponent(barber.id)}">${photo}<span><span class="name">${escapeHtml(barber.displayName)}</span><span class="meta">${escapeHtml(parts.join(" · "))}</span></span></a></li>`;
}

/** « Saint-Denis (La Réunion) » quand un autre pays a une ville de même nom. */
export function cityLabel(city: CityGroup): string {
  if (!city.disambiguated) return city.name;
  const country = new Intl.DisplayNames("fr", { type: "region" }).of(city.countryCode);
  return `${city.name} (${country ?? city.countryCode})`;
}

export function cityPageUrl(baseUrl: string, slug: string): string {
  return `${baseUrl}/barbers/ville/${slug}`;
}

export function renderCityPage(input: {
  baseUrl: string;
  city: CityGroup;
  barbers: PublicBarberSearchItem[];
}): string {
  const { baseUrl, city, barbers } = input;
  const count = barbers.length;
  const cheapest = cheapestLabel(barbers);
  const label = cityLabel(city);
  const title = `Barbers à ${label} : réservation en ligne | ${SITE_NAME}`;
  const description = `${barbersLabel(count)} à ${label} : coupes, barbe, dégradé${cheapest ? `, ${cheapest}` : ""}. Consultez les avis et réservez en ligne sur ${SITE_NAME}.`;
  const canonical = cityPageUrl(baseUrl, city.slug);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: `Barbers à ${label}`,
    itemListElement: barbers.map((barber, index) => ({
      "@type": "ListItem",
      position: index + 1,
      item: {
        "@type": "BarberShop",
        name: barber.displayName,
        url: `${baseUrl}/barbers/${encodeURIComponent(barber.id)}`,
        ...(barber.avatarPath
          ? { image: `${baseUrl}${barber.avatarPath}` }
          : {}),
        address: {
          "@type": "PostalAddress",
          addressLocality: barber.city,
          addressCountry: barber.countryCode,
        },
        ...(barber.averageRating !== null && barber.reviewCount > 0
          ? {
              aggregateRating: {
                "@type": "AggregateRating",
                ratingValue: barber.averageRating,
                reviewCount: barber.reviewCount,
              },
            }
          : {}),
      },
    })),
  };

  const body = `<main>
<h1>Barbers à ${escapeHtml(label)}</h1>
<p class="lead">${barbersLabel(count)} à ${escapeHtml(label)} : consultez les avis, les prix et les créneaux disponibles.</p>
<a class="cta" href="/barbers?city=${encodeURIComponent(city.name)}">Voir la carte et réserver</a>
<ul>
${barbers.map(barberItem).join("\n")}
</ul>
</main>`;

  return layout({ title, description, canonical, indexable: true, jsonLd, body });
}

export function renderNotFoundPage(): string {
  return layout({
    title: `Ville introuvable | ${SITE_NAME}`,
    description: "Cette page n'existe pas.",
    indexable: false,
    body: `<main>
<h1>Ville introuvable</h1>
<p class="lead">Nous n'avons pas encore de page pour cette ville.</p>
<a class="cta" href="/barbers">Rechercher un barber</a>
</main>`,
  });
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// Pages publiques de l'application (même liste que les routes sans compte).
const STATIC_PATHS = ["/", "/barbers", "/aide", "/mentions-legales"];

export function renderSitemap(baseUrl: string, cities: CityGroup[]): string {
  const urls = [
    ...STATIC_PATHS.map((path) => `${baseUrl}${path}`),
    ...cities.map((city) => cityPageUrl(baseUrl, city.slug)),
  ];
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((url) => `  <url><loc>${escapeXml(url)}</loc></url>`).join("\n")}
</urlset>
`;
}

// Espaces connectés : inutiles dans un moteur de recherche.
const PRIVATE_PATHS = [
  "/api/",
  "/account",
  "/settings",
  "/appointments",
  "/favorites",
  "/pro/",
  "/admin",
  "/login",
  "/register",
];

export function renderRobots(baseUrl: string): string {
  return [
    "User-agent: *",
    "Allow: /",
    ...PRIVATE_PATHS.map((path) => `Disallow: ${path}`),
    "",
    `Sitemap: ${baseUrl}/sitemap.xml`,
    "",
  ].join("\n");
}
