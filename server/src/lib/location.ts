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
