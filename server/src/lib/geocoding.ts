// --- Géocodage serveur (lot 9 passe A, issue #19) ---
// Le serveur géocode l'adresse du client uniquement pour les prestations
// `AT_CLIENT`, afin de vérifier qu'elle est dans la zone d'intervention du
// professionnel. La clé MapTiler est un secret SERVEUR (jamais exposé au
// navigateur) et l'adresse n'apparaît jamais dans les logs ni les messages
// d'erreur. Aucun appel HTTP réel n'est effectué en test : les tests injectent
// un faux géocodeur via `setGeocoder`.

import { env } from "../config/env.js";
import { AppError } from "./errors.js";
import { isValidLatitude, isValidLongitude } from "./location.js";

export interface GeocodingResult {
  latitude: number;
  longitude: number;
}

/** Abstraction testable : les tests fournissent une implémentation factice. */
export interface Geocoder {
  geocode(address: string): Promise<GeocodingResult>;
}

/**
 * Fournisseur MapTiler (Geocoding API). Construit uniquement si la clé serveur
 * est configurée. Timeout, validation stricte de la réponse, aucune fuite de
 * l'adresse dans les messages d'erreur.
 */
export class MapTilerGeocoder implements Geocoder {
  constructor(
    private readonly apiKey: string,
    private readonly endpoint = "https://api.maptiler.com/geocoding",
    private readonly timeoutMs = 5_000,
  ) {}

  async geocode(address: string): Promise<GeocodingResult> {
    const url = `${this.endpoint}/${encodeURIComponent(address)}.json?key=${encodeURIComponent(this.apiKey)}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    let response: Response;
    try {
      response = await fetch(url, { signal: controller.signal });
    } catch {
      // Timeout ou échec réseau : indisponibilité, jamais l'adresse en clair.
      throw new AppError(
        503,
        "GEOCODING_UNAVAILABLE",
        "Service de géocodage indisponible.",
      );
    } finally {
      clearTimeout(timer);
    }

    if (!response.ok) {
      throw new AppError(
        503,
        "GEOCODING_UNAVAILABLE",
        "Service de géocodage indisponible.",
      );
    }

    let data: unknown;
    try {
      data = await response.json();
    } catch {
      throw new AppError(
        503,
        "GEOCODING_UNAVAILABLE",
        "Réponse de géocodage invalide.",
      );
    }

    const coordinates = extractCoordinates(data);
    if (!coordinates) {
      throw new AppError(404, "ADDRESS_NOT_FOUND", "Adresse introuvable.");
    }
    return coordinates;
  }
}

/** Extrait `[longitude, latitude]` du premier feature GeoJSON, sans confiance. */
function extractCoordinates(data: unknown): GeocodingResult | null {
  if (typeof data !== "object" || data === null) return null;
  const features = (data as { features?: unknown }).features;
  if (!Array.isArray(features) || features.length === 0) return null;

  const first = features[0];
  if (typeof first !== "object" || first === null) return null;
  const geometry = (first as { geometry?: unknown }).geometry;
  if (typeof geometry !== "object" || geometry === null) return null;

  const coordinates = (geometry as { coordinates?: unknown }).coordinates;
  if (!Array.isArray(coordinates) || coordinates.length < 2) return null;

  const longitude = coordinates[0];
  const latitude = coordinates[1];
  if (typeof longitude !== "number" || typeof latitude !== "number") return null;
  if (!isValidLongitude(longitude) || !isValidLatitude(latitude)) return null;

  return { latitude, longitude };
}

let activeGeocoder: Geocoder | null = null;

/** Injection pour les tests (faux géocodeur) ; `null` rétablit le défaut. */
export function setGeocoder(geocoder: Geocoder | null): void {
  activeGeocoder = geocoder;
}

/** Résout le géocodeur actif, sinon le fournisseur MapTiler configuré. */
export function resolveGeocoder(): Geocoder {
  if (activeGeocoder) return activeGeocoder;
  const apiKey = env.MAPTILER_GEOCODING_API_KEY;
  if (!apiKey) {
    throw new AppError(
      503,
      "GEOCODING_UNAVAILABLE",
      "Géocodage non configuré.",
    );
  }
  return new MapTilerGeocoder(apiKey);
}

/** Géocode une adresse via le géocodeur actif. */
export async function geocodeAddress(
  address: string,
): Promise<GeocodingResult> {
  return resolveGeocoder().geocode(address);
}
