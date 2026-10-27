import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "../../db/client.js";
import { barberProfiles, users } from "@findbarber/shared/schema";
import type { PublicBarberSearchItem } from "@findbarber/shared/types";
import { slugifyCity } from "../../lib/slug.js";
import { loadSearchItems, publicBarberConditions } from "../barber/service.js";

// --- Pages ville (lot N9) ---
// Données publiques seulement : villes des profils approuvés et cartes
// publiques (jamais d'adresse, de coordonnées exactes ni de contact). L'index
// des villes est gardé en mémoire quelques minutes : une page ou le plan du
// site ne coûte donc pas une requête par visite de robot.

export const CITY_INDEX_TTL_MS = 10 * 60 * 1000;

export interface CityGroup {
  slug: string;
  /** Nom affiché : l'orthographe la plus répandue parmi les profils. */
  name: string;
  countryCode: string;
  /** Vrai quand un autre pays a une ville de même nom (Saint-Denis) : le pays suffixe l'identifiant. */
  disambiguated: boolean;
  /** Orthographes présentes en base (casse et accents), pour retrouver les barbers. */
  spellings: string[];
  barberCount: number;
}

let cached: { expiresAt: number; groups: Map<string, CityGroup> } | null = null;

/** Vide le cache (tests). */
export function clearCityIndexCache(): void {
  cached = null;
}

async function loadCityIndex(now: number): Promise<Map<string, CityGroup>> {
  if (cached && cached.expiresAt > now) return cached.groups;

  const rows = await db
    .select({
      city: barberProfiles.city,
      countryCode: barberProfiles.countryCode,
      barberCount: sql<number>`count(*)::int`,
    })
    .from(barberProfiles)
    .innerJoin(users, eq(barberProfiles.userId, users.id))
    .where(and(...publicBarberConditions()))
    .groupBy(barberProfiles.city, barberProfiles.countryCode);

  // Une ville = (identifiant, pays) : « Saint-Denis » en France et à La
  // Réunion sont deux pages. Le pays qui a le plus de barbers garde
  // l'identifiant simple, les autres reçoivent le code pays en suffixe.
  const byKey = new Map<string, CityGroup & { bestSpellingCount: number }>();
  for (const row of rows) {
    const slug = slugifyCity(row.city);
    if (slug === "") continue;
    const key = `${slug}|${row.countryCode}`;
    const group = byKey.get(key) ?? {
      slug,
      name: row.city,
      countryCode: row.countryCode,
      disambiguated: false,
      spellings: [],
      barberCount: 0,
      bestSpellingCount: 0,
    };
    group.spellings.push(row.city);
    group.barberCount += row.barberCount;
    if (row.barberCount > group.bestSpellingCount) {
      group.bestSpellingCount = row.barberCount;
      group.name = row.city;
    }
    byKey.set(key, group);
  }

  const bySlug = new Map<string, CityGroup[]>();
  for (const group of byKey.values()) {
    bySlug.set(group.slug, [...(bySlug.get(group.slug) ?? []), group]);
  }

  const groups = new Map<string, CityGroup>();
  for (const [slug, candidates] of bySlug) {
    candidates.sort(
      (a, b) =>
        b.barberCount - a.barberCount ||
        a.countryCode.localeCompare(b.countryCode),
    );
    candidates.forEach((group, index) => {
      if (index === 0) {
        groups.set(slug, { ...group, disambiguated: candidates.length > 1 });
      } else {
        const suffixed = `${slug}-${group.countryCode.toLowerCase()}`;
        groups.set(suffixed, { ...group, slug: suffixed, disambiguated: true });
      }
    });
  }
  cached = { expiresAt: now + CITY_INDEX_TTL_MS, groups };
  return groups;
}

/** Villes qui ont au moins `minBarbers` barbers visibles, par ordre alphabétique. */
export async function listCityPages(
  minBarbers: number,
  now: number = Date.now(),
): Promise<CityGroup[]> {
  const groups = await loadCityIndex(now);
  return [...groups.values()]
    .filter((group) => group.barberCount >= minBarbers)
    .sort((a, b) => a.slug.localeCompare(b.slug));
}

export interface CityPage {
  city: CityGroup;
  barbers: PublicBarberSearchItem[];
}

/** Une ville et ses barbers, ou `null` si elle n'a pas de page (inconnue ou trop peu de barbers). */
export async function getCityPage(
  slug: string,
  minBarbers: number,
  now: number = Date.now(),
): Promise<CityPage | null> {
  const city = (await loadCityIndex(now)).get(slug);
  if (!city || city.barberCount < minBarbers) return null;

  const barbers = await loadSearchItems(
    and(
      ...publicBarberConditions(),
      inArray(barberProfiles.city, city.spellings),
      eq(barberProfiles.countryCode, city.countryCode),
    )!,
    undefined,
    { availability: false },
  );
  return { city, barbers };
}
