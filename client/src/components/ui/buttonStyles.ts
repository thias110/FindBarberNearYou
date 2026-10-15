import { cn } from "../../lib/cn";

// Styles des boutons (issue #28), partagés par `Button` et par les liens
// présentés comme des boutons (`<Link className={buttonClasses()}>`) pour que
// les deux restent identiques sur toutes les pages.

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md";

const BASE =
  "inline-flex items-center justify-center gap-2 rounded-full font-semibold transition-colors " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent " +
  "focus-visible:ring-offset-2 focus-visible:ring-offset-background " +
  "disabled:pointer-events-none disabled:opacity-50";

const SIZES: Record<ButtonSize, string> = {
  // Cible tactile >= 44 x 44 px sur mobile ; `sm` ne se resserre qu'à partir
  // de `sm:` (souris), pour les zones denses.
  sm: "min-h-11 min-w-11 px-4 text-sm sm:min-h-9 sm:min-w-9 sm:px-3.5",
  md: "min-h-11 min-w-11 px-5 py-2 text-sm",
};

const VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-accent text-accent-foreground hover:bg-accent-hover",
  // Contour `border-strong` (>= 3:1) : le bouton reste repérable sur fond blanc.
  secondary:
    "border border-border-strong bg-surface text-foreground hover:bg-surface-muted",
  ghost: "text-foreground hover:bg-surface-muted",
  // Token de statut (s'adapte clair/sombre tout seul, API inchangée).
  danger: "border border-danger bg-transparent text-danger hover:bg-danger/10",
};

export function buttonClasses(
  variant: ButtonVariant = "primary",
  size: ButtonSize = "md",
  className?: string,
): string {
  return cn(BASE, SIZES[size], VARIANTS[variant], className);
}
