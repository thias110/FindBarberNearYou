import { intlLocale } from "../i18n";
// Géométrie de la recherche (issues #50, #52 et #54) : calculs purs, sans
// dépendance au navigateur. La position du visiteur ne quitte jamais
// l'appareil : seule une zone englobante (rectangle autour du rayon) est
// envoyée au serveur, et la distance exacte est calculée ici, sur la position
// publique approximative des barbers.

export interface LatLng {
  latitude: number;
  longitude: number;
}

/** Zone géographique au format des paramètres de `GET /api/barbers`. */
export interface GeoBounds {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
}

const EARTH_RADIUS_KM = 6371;
const KM_PER_DEGREE_LAT = 111.32;

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

// Six décimales suffisent (≈ 10 cm) et gardent des URL et des clés courtes.
function round6(value: number): number {
  return Math.round(value * 1e6) / 1e6;
}

/** Distance en kilomètres entre deux points (formule de Haversine). */
export function distanceKm(a: LatLng, b: LatLng): number {
  const deltaLat = toRadians(b.latitude - a.latitude);
  const deltaLng = toRadians(b.longitude - a.longitude);
  const h =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(toRadians(a.latitude)) *
      Math.cos(toRadians(b.latitude)) *
      Math.sin(deltaLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

/**
 * Rectangle qui contient le cercle de rayon `radiusKm` autour de `center`.
 * Une marge de 2 km couvre l'arrondi des positions publiques (≈ 1 km).
 */
export function boundsAround(center: LatLng, radiusKm: number): GeoBounds {
  const marginKm = radiusKm + 2;
  const deltaLat = marginKm / KM_PER_DEGREE_LAT;
  const cosLat = Math.max(Math.cos(toRadians(center.latitude)), 0.01);
  const deltaLng = marginKm / (KM_PER_DEGREE_LAT * cosLat);
  return normalizeBounds({
    minLat: center.latitude - deltaLat,
    maxLat: center.latitude + deltaLat,
    minLng: center.longitude - deltaLng,
    maxLng: center.longitude + deltaLng,
  });
}

/**
 * Ramène une zone dans les bornes acceptées par l'API (latitude [-90, 90],
 * longitude [-180, 180], min ≤ max). Une carte qui montre plus d'un tour du
 * monde ou qui chevauche l'antiméridien couvre toutes les longitudes.
 */
export function normalizeBounds(bounds: GeoBounds): GeoBounds {
  const minLat = clamp(bounds.minLat, -90, 90);
  const maxLat = clamp(bounds.maxLat, -90, 90);
  let minLng = bounds.minLng;
  let maxLng = bounds.maxLng;
  if (maxLng - minLng >= 360 || minLng < -180 || maxLng > 180) {
    minLng = -180;
    maxLng = 180;
  }
  return {
    minLat: round6(Math.min(minLat, maxLat)),
    maxLat: round6(Math.max(minLat, maxLat)),
    minLng: round6(Math.min(minLng, maxLng)),
    maxLng: round6(Math.max(minLng, maxLng)),
  };
}

/**
 * « moins de 1 km », « 3,4 km », « 12 km ». Pas de mètres : la position
 * publique des barbers est arrondie (≈ 1 km).
 */
export function formatDistance(km: number): string {
  if (km < 1) return "moins de 1 km";
  if (km < 10) {
    return `${new Intl.NumberFormat(intlLocale(), { maximumFractionDigits: 1 }).format(km)} km`;
  }
  return `${Math.round(km)} km`;
}
