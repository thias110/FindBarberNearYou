// Géométrie du motif « dégradé » (design system, plan §2.4) : lignes de 2 px
// dont l'écart augmente, du plein vers le vide.
export const FADE_GAPS = [2, 3, 5, 8, 12, 18] as const;
export const FADE_LINE = 2;

/** Ordonnées des 7 lignes, de haut en bas : on part du plein (écarts serrés). */
export function fadeMotifLines(): number[] {
  return FADE_GAPS.reduce<number[]>(
    (ys, gap) => [...ys, ys[ys.length - 1] + FADE_LINE + gap],
    [0],
  );
}

/**
 * Position de départ de la « mise en paliers » (plan §2.5) : les lignes
 * partent collées en un bloc plein, en haut. Renvoie, pour chaque ligne, le
 * décalage vertical (négatif) entre ce bloc et sa place finale.
 */
export function fadeMotifStartOffsets(): number[] {
  return fadeMotifLines().map((y, i) => i * FADE_LINE - y);
}
