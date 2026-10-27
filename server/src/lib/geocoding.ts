// --- Géocodage serveur (lot 9 passe A, issue #19) ---
// Le serveur géocode l'adresse du client uniquement pour les prestations
// `AT_CLIENT`, afin de vérifier qu'elle est dans la zone d'intervention du
// professionnel. La clé MapTiler est un secret SERVEUR (jamais exposé au
// navigateur) et l'adresse n'apparaît jamais dans les logs ni les messages
// d'erreur. Aucun appel HTTP réel n'est effectué en test : les tests injectent
// un faux géocodeur via `setGeocoder`.

import type { PlaceSuggestion } from "@findbarber/shared/types";
import { env } from "../config/env.js";
import { AppError } from "./errors.js";
import { isValidLatitude, isValidLongitude } from "./location.js";

export interface GeocodingResult {
  latitude: number;
  longitude: number;
}

// Suggestion d'adresse (issue #45) : libellé du fournisseur + coordonnées.
export interface AddressSuggestion extends GeocodingResult {
  label: string;
}

export interface SuggestOptions {
  /** Code pays ISO alpha-2 pour restreindre les résultats, facultatif. */
  countryCode?: string;
  limit: number;
}

/** Abstraction testable : les tests fournissent une implémentation factice. */
export interface Geocoder {
  geocode(address: string): Promise<GeocodingResult>;
  /** Autocomplétion d'adresse ; facultative pour les faux géocodeurs. */
  suggest?(query: string, options: SuggestOptions): Promise<AddressSuggestion[]>;
  /** Autocomplétion de villes et quartiers (lot N4) ; jamais d'adresses. */
  suggestPlaces?(query: string, limit: number): Promise<PlaceSuggestion[]>;
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

  async suggest(
    query: string,
    options: SuggestOptions,
  ): Promise<AddressSuggestion[]> {
    const params = new URLSearchParams({
      key: this.apiKey,
      autocomplete: "true",
      language: "fr",
      limit: String(options.limit),
    });
    if (options.countryCode) params.set("country", options.countryCode.toLowerCase());
    const url = `${this.endpoint}/${encodeURIComponent(query)}.json?${params.toString()}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await fetch(url, { signal: controller.signal });
      if (!response.ok) throw new Error("bad status");
      return extractSuggestions(await response.json(), options.limit);
    } catch {
      // Jamais la saisie en clair dans le message d'erreur.
      throw new AppError(
        503,
        "GEOCODING_UNAVAILABLE",
        "Service de géocodage indisponible.",
      );
    } finally {
      clearTimeout(timer);
    }
  }

  async suggestPlaces(query: string, limit: number): Promise<PlaceSuggestion[]> {
    const params = new URLSearchParams({
      key: this.apiKey,
      autocomplete: "true",
      // Villes et quartiers seulement : ni adresses, ni rues, ni lieux.
      types: PLACE_TYPES.join(","),
      // Langue vide : noms locaux (« Genève »), ceux que saisissent les barbers.
      language: "",
      limit: String(limit),
    });
    const url = `${this.endpoint}/${encodeURIComponent(query)}.json?${params.toString()}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await fetch(url, { signal: controller.signal });
      if (!response.ok) throw new Error("bad status");
      return extractPlaces(await response.json(), limit);
    } catch {
      // Jamais la saisie en clair dans le message d'erreur.
      throw new AppError(
        503,
        "GEOCODING_UNAVAILABLE",
        "Service de géocodage indisponible.",
      );
    } finally {
      clearTimeout(timer);
    }
  }
}

// Types de lieux MapTiler acceptés par l'autocomplétion de ville (lot N4).
const PLACE_TYPES = [
  "municipality",
  "municipal_district",
  "locality",
  "neighbourhood",
];

/** Villes et quartiers d'une réponse GeoJSON, sans doublon ni confiance dans la forme. */
export function extractPlaces(data: unknown, limit: number): PlaceSuggestion[] {
  if (typeof data !== "object" || data === null) return [];
  const features = (data as { features?: unknown }).features;
  if (!Array.isArray(features)) return [];
  const seen = new Set<string>();
  const result: PlaceSuggestion[] = [];
  for (const feature of features) {
    if (result.length >= limit) break;
    const { text, place_name: placeName } = (feature ?? {}) as {
      text?: unknown;
      place_name?: unknown;
    };
    if (typeof text !== "string" || typeof placeName !== "string") continue;
    const name = text.trim().slice(0, 100);
    const label = placeName.trim().slice(0, 200);
    if (name === "" || label === "" || seen.has(label)) continue;
    seen.add(label);
    result.push({ name, label });
  }
  return result;
}

/** Suggestions valides d'une réponse GeoJSON, sans confiance dans la forme. */
function extractSuggestions(data: unknown, limit: number): AddressSuggestion[] {
  if (typeof data !== "object" || data === null) return [];
  const features = (data as { features?: unknown }).features;
  if (!Array.isArray(features)) return [];
  const result: AddressSuggestion[] = [];
  for (const feature of features) {
    if (result.length >= limit) break;
    const coordinates = extractCoordinates({ features: [feature] });
    const label = (feature as { place_name?: unknown } | null)?.place_name;
    if (!coordinates || typeof label !== "string" || label.trim() === "") continue;
    result.push({ label: label.trim().slice(0, 300), ...coordinates });
  }
  return result;
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

/** Autocomplétion de villes et quartiers via le géocodeur actif (lot N4). */
export async function suggestPlaces(
  query: string,
  limit: number,
): Promise<PlaceSuggestion[]> {
  const geocoder = resolveGeocoder();
  if (!geocoder.suggestPlaces) {
    throw new AppError(
      503,
      "GEOCODING_UNAVAILABLE",
      "Recherche de ville indisponible.",
    );
  }
  return geocoder.suggestPlaces(query, limit);
}

/** Autocomplétion d'adresse via le géocodeur actif (issue #45). */
export async function suggestAddresses(
  query: string,
  options: SuggestOptions,
): Promise<AddressSuggestion[]> {
  const geocoder = resolveGeocoder();
  if (!geocoder.suggest) {
    throw new AppError(
      503,
      "GEOCODING_UNAVAILABLE",
      "Recherche d'adresse indisponible.",
    );
  }
  return geocoder.suggest(query, options);
}
