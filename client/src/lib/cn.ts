export type ClassValue = string | number | false | null | undefined;

/**
 * Concatène des classes conditionnelles. Alternative légère à `clsx`/`twMerge`
 * (aucune dépendance ajoutée) : les classes sont simplement filtrées puis
 * jointes. Les conflits de classes Tailwind restent à la charge de l'appelant.
 */
export function cn(...classes: ClassValue[]): string {
  return classes.filter(Boolean).join(" ");
}
