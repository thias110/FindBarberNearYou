// --- Localisation publique approximative (lot 8, issue #19) ---
// Les coordonnées exactes du profil (adresse privée potentielle) ne sont jamais
// exposées publiquement. Toute réponse publique passe par cet arrondi à deux
// décimales (≈ 1,1 km de précision en latitude). La carte et toute distance
// publique future doivent utiliser cette même position approximative, jamais le
// point privé exact.
//
// ATTENTION : cet arrondi réduit la précision mais **ne garantit pas
// l'anonymat** (une localisation approchée peut rester identifiante pour un
// commerce ou un quartier peu dense). Il ne réécrit jamais la valeur stockée.

export interface ApproximateCoordinates {
  latitude: number;
  longitude: number;
}

/** Arrondit une coordonnée à deux décimales. Ne modifie pas la valeur stockée. */
export function approximateCoordinate(value: number): number {
  const rounded = Math.round(value * 100) / 100;
  // Normalise -0 en 0 (évite un zéro négatif dans les réponses et les tests).
  return rounded === 0 ? 0 : rounded;
}

/** Position publique approximative d'un profil. */
export function approximateCoordinates(
  latitude: number,
  longitude: number,
): ApproximateCoordinates {
  return {
    latitude: approximateCoordinate(latitude),
    longitude: approximateCoordinate(longitude),
  };
}

// --- Distance Haversine (lot 9 passe A, issue #19) ---
// Calcul pur en kilomètres, utilisé pour vérifier que l'adresse géocodée du
// client est dans le rayon d'intervention (`travel_radius_km`) du professionnel.
// Aucune coordonnée privée n'apparaît dans les messages d'erreur.

const EARTH_RADIUS_KM = 6371;

/** true pour une latitude finie dans [-90, 90]. */
export function isValidLatitude(value: number): boolean {
  return Number.isFinite(value) && value >= -90 && value <= 90;
}

/** true pour une longitude finie dans [-180, 180]. */
export function isValidLongitude(value: number): boolean {
  return Number.isFinite(value) && value >= -180 && value <= 180;
}

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/** Distance en kilomètres entre deux points (formule de Haversine). */
export function haversineDistanceKm(
  latitudeA: number,
  longitudeA: number,
  latitudeB: number,
  longitudeB: number,
): number {
  if (
    !isValidLatitude(latitudeA) ||
    !isValidLongitude(longitudeA) ||
    !isValidLatitude(latitudeB) ||
    !isValidLongitude(longitudeB)
  ) {
    // Message générique : aucune coordonnée privée ne doit fuiter.
    throw new Error("Coordonnées invalides.");
  }

  const deltaLat = toRadians(latitudeB - latitudeA);
  const deltaLon = toRadians(longitudeB - longitudeA);
  const a =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(toRadians(latitudeA)) *
      Math.cos(toRadians(latitudeB)) *
      Math.sin(deltaLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_KM * c;
}
