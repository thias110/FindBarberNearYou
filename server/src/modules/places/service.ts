import type { PlaceSuggestion } from "@findbarber/shared/types";
import { PLACE_SUGGESTION_LIMIT } from "@findbarber/shared/validation";
import { suggestPlaces } from "../../lib/geocoding.js";

// --- Autocomplétion de ville (lot N4) ---
// Chaque requête distincte coûte un appel au fournisseur de géocodage : les
// réponses sont gardées 24 h en mémoire, par saisie normalisée. Les erreurs ne
// sont jamais mises en cache. La saisie n'est ni journalisée ni stockée au-delà
// de cette clé de cache (aucune adresse IP associée).

export const PLACE_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const PLACE_CACHE_MAX_ENTRIES = 1000;

interface CacheEntry {
  expiresAt: number;
  suggestions: PlaceSuggestion[];
}

const cache = new Map<string, CacheEntry>();

/** Vide le cache (tests). */
export function clearPlaceCache(): void {
  cache.clear();
}

export async function suggestCities(
  query: string,
  now: number = Date.now(),
): Promise<PlaceSuggestion[]> {
  const key = query.normalize("NFC").toLocaleLowerCase();
  const hit = cache.get(key);
  if (hit && hit.expiresAt > now) return hit.suggestions;

  const suggestions = await suggestPlaces(query, PLACE_SUGGESTION_LIMIT);

  // Borne mémoire : la plus ancienne entrée (ordre d'insertion) part d'abord.
  cache.delete(key);
  if (cache.size >= PLACE_CACHE_MAX_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(key, { expiresAt: now + PLACE_CACHE_TTL_MS, suggestions });
  return suggestions;
}
