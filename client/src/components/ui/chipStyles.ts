import { cn } from "../../lib/cn";

// Pastilles de choix (issue #28, lot DS-2 : plan §2.6.3) : filtres,
// catégories, créneaux, notes. Même forme partout : pilule de 44 px sur
// mobile, 40 px à partir de `sm:` (souris), contour `border-strong` (>= 3:1).
// - tone "neutral" : filtre ou catégorie, sélection en encre.
// - tone "accent" : choix d'un formulaire (créneau, note), sélection en cobalt.
// Un compteur éventuel (« Note 4+ (12) ») fait partie du libellé.

export type ChipTone = "neutral" | "accent";

const BASE =
  "focus-ring inline-flex min-h-11 items-center justify-center rounded-full border text-sm font-semibold " +
  "transition-[color,background-color,border-color,transform] duration-fast ease-out active:duration-instant " +
  "motion-safe:active:scale-[.97] disabled:cursor-not-allowed disabled:opacity-50 motion-safe:disabled:scale-100";

const IDLE = "border-border-strong bg-surface text-foreground hover:bg-surface-muted";

const SELECTED: Record<ChipTone, string> = {
  neutral: "border-foreground bg-foreground text-background",
  accent: "border-accent bg-accent text-accent-foreground",
};

export interface ChipOptions {
  tone?: ChipTone;
  /** Pastille carrée de 44 px (ex. note de 1 à 5) au lieu d'une pilule. */
  square?: boolean;
  className?: string;
}

export function chipClasses(
  selected: boolean,
  { tone = "neutral", square = false, className }: ChipOptions = {},
): string {
  return cn(
    BASE,
    square ? "h-11 w-11" : "px-3.5 sm:min-h-10",
    selected ? SELECTED[tone] : IDLE,
    className,
  );
}

// Sélecteur segmenté (« Salon / Chez le pro / Domicile », « Liste / Carte ») :
// un rail `segmentRailClasses()` contenant des segments `segmentClasses()`.
// Le composant `SegmentedControl` assemble les deux avec le bon rôle ARIA
// (radiogroup) et la navigation au clavier.
export function segmentRailClasses(className?: string): string {
  return cn("inline-flex items-center gap-1 rounded-full bg-surface-muted p-1", className);
}

export function segmentClasses(selected: boolean, className?: string): string {
  return cn(
    "focus-ring inline-flex min-h-11 shrink-0 items-center justify-center whitespace-nowrap rounded-full px-4 text-sm font-semibold sm:min-h-10",
    "transition-[color,background-color,box-shadow] duration-base ease-out",
    "disabled:cursor-not-allowed disabled:opacity-50",
    selected
      ? "bg-surface text-foreground shadow-1"
      : "text-foreground-muted hover:text-foreground",
    className,
  );
}
