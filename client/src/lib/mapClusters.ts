// Regroupement des épingles de la carte (lot P-2, plan §2.6.9) : au-delà de
// 30 épingles visibles, celles qui tombent dans la même case de la grille
// écran sont réunies en un cercle qui affiche leur nombre. Calcul pur sur des
// positions déjà projetées en pixels : testable sans carte.

/** Seuil au-delà duquel on regroupe (épingles visibles). */
export const CLUSTER_THRESHOLD = 30;
/** Taille d'une case de la grille de regroupement, en pixels. */
export const CLUSTER_CELL_PX = 64;

export interface ProjectedPin {
  id: string;
  x: number;
  y: number;
}

export type PinGroup =
  | { kind: "pin"; id: string }
  | { kind: "cluster"; ids: string[]; x: number; y: number };

/**
 * Regroupe les épingles visibles. `keepAlone` (ex. l'épingle sélectionnée)
 * n'est jamais absorbée dans un cercle : la sélection reste visible.
 * Sous le seuil, chaque épingle reste seule.
 */
export function groupPins(
  pins: ProjectedPin[],
  {
    threshold = CLUSTER_THRESHOLD,
    cellPx = CLUSTER_CELL_PX,
    keepAlone = null,
  }: { threshold?: number; cellPx?: number; keepAlone?: string | null } = {},
): PinGroup[] {
  if (pins.length <= threshold) {
    return pins.map((pin) => ({ kind: "pin", id: pin.id }));
  }
  const cells = new Map<string, ProjectedPin[]>();
  const groups: PinGroup[] = [];
  for (const pin of pins) {
    if (pin.id === keepAlone) {
      groups.push({ kind: "pin", id: pin.id });
      continue;
    }
    const key = `${Math.floor(pin.x / cellPx)}:${Math.floor(pin.y / cellPx)}`;
    const cell = cells.get(key);
    if (cell) cell.push(pin);
    else cells.set(key, [pin]);
  }
  for (const cell of cells.values()) {
    if (cell.length === 1) {
      groups.push({ kind: "pin", id: cell[0].id });
      continue;
    }
    // Le cercle se place au barycentre des épingles qu'il réunit.
    const x = cell.reduce((sum, pin) => sum + pin.x, 0) / cell.length;
    const y = cell.reduce((sum, pin) => sum + pin.y, 0) / cell.length;
    groups.push({ kind: "cluster", ids: cell.map((pin) => pin.id), x, y });
  }
  return groups;
}
