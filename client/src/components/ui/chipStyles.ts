import { cn } from "../../lib/cn";

// Pastilles de choix (issue #28) : filtres, catégories, créneaux, notes.
// Même forme partout (pilule, 44 px, contour `border-strong` >= 3:1).
// - tone "neutral" : filtre ou catégorie, sélection en noir/blanc (maquette).
// - tone "accent" : choix d'un formulaire (créneau, note), sélection en bleu.

export type ChipTone = "neutral" | "accent";

const BASE =
  "inline-flex min-h-11 items-center justify-center rounded-full border text-sm font-semibold transition-colors " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent " +
  "focus-visible:ring-offset-2 focus-visible:ring-offset-background " +
  "disabled:cursor-not-allowed disabled:opacity-50";

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
    square ? "h-11 w-11" : "px-4",
    selected ? SELECTED[tone] : IDLE,
    className,
  );
}

// Segment d'un sélecteur à options exclusives (ex. Liste / Carte), posé dans
// un conteneur `rounded-full border p-1`.
export function segmentClasses(selected: boolean): string {
  return cn(
    "inline-flex min-h-11 items-center rounded-full px-4 text-sm font-semibold transition-colors",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
    "focus-visible:ring-offset-2 focus-visible:ring-offset-background",
    selected
      ? "bg-foreground text-background"
      : "text-foreground-muted hover:text-foreground",
  );
}
