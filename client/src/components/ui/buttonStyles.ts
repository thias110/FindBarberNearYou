import { cn } from "../../lib/cn";

// Styles des boutons (issue #28, étendus par le lot DS-2 : plan
// docs/redesign/03-plan-refonte.md §2.6.1), partagés par `Button` et par les
// liens présentés comme des boutons (`<Link className={buttonClasses()}>`)
// pour que les deux restent identiques sur toutes les pages.
//
// États communs : survol seulement sur les appareils qui en ont
// (`hoverOnlyWhenSupported`), focus par l'anneau partagé `focus-ring`,
// pression en `scale(.97)`, désactivé natif. Toute transformation est sous
// `motion-safe:` : rien ne bouge si l'utilisateur réduit les animations.

export type ButtonVariant =
  | "primary"
  | "secondary"
  | "ghost"
  | "link"
  | "danger"
  | "danger-solid"
  | "inverse"
  | "outline-inverse"
  | "fab-mobile";

// `icon` : cercle de 44 px pour une action réduite à une icône, combiné à la
// variante parente (`ghost` ou `secondary`). Le libellé passe par `aria-label`.
export type ButtonSize = "sm" | "md" | "lg" | "xl" | "icon";

const BASE =
  "focus-ring inline-flex shrink-0 items-center justify-center " +
  "transition-[color,background-color,border-color,box-shadow,opacity,transform] duration-fast ease-out " +
  "active:duration-instant disabled:cursor-not-allowed aria-disabled:pointer-events-none " +
  "motion-safe:disabled:translate-y-0 motion-safe:disabled:scale-100";

// Désactivé commun (variantes posées sur `background` ou `surface`).
const DISABLED =
  "disabled:border-transparent disabled:bg-surface-muted disabled:text-foreground-muted/70 disabled:shadow-none";

// Pression commune.
const PRESS = "motion-safe:active:scale-[.97]";

const SIZES: Record<ButtonSize, string> = {
  // Cible tactile >= 44 x 44 px sur mobile ; `sm` ne se resserre qu'à partir
  // de `sm:` (souris), pour les zones denses.
  sm: "min-h-11 min-w-11 gap-2 px-3.5 text-sm font-semibold sm:min-h-9 sm:min-w-9",
  md: "min-h-11 min-w-11 gap-2 px-5 py-2 text-[0.9375rem] font-semibold",
  lg: "min-h-[3.25rem] gap-2.5 px-6 py-2 text-base font-semibold",
  xl: "min-h-[3.75rem] gap-2.5 px-7 py-2 text-base font-bold",
  icon: "h-11 w-11 p-0",
};

const VARIANTS: Record<ButtonVariant, string> = {
  primary: cn(
    "bg-accent text-accent-foreground hover:bg-accent-hover hover:shadow-1",
    "motion-safe:hover:-translate-y-px motion-safe:active:translate-y-0",
    PRESS,
    DISABLED,
  ),
  // Contour `border-strong` (>= 3:1) : le bouton reste repérable sur fond clair.
  secondary: cn(
    "border border-border-strong bg-surface text-foreground",
    "hover:border-foreground-muted hover:bg-surface-muted",
    PRESS,
    DISABLED,
  ),
  ghost: cn(
    "text-foreground hover:bg-surface-muted active:bg-border",
    "disabled:bg-transparent disabled:text-foreground-muted/60",
  ),
  // Lien dans un texte ou une carte : pas de pilule ni de hauteur imposée.
  link: cn(
    "rounded-sm text-accent-strong underline decoration-1 underline-offset-[3px]",
    "hover:text-accent-hover hover:decoration-2 active:opacity-80",
    "disabled:text-foreground-muted disabled:no-underline",
  ),
  // Token de statut (s'adapte clair/sombre tout seul, API inchangée).
  danger: cn(
    "border border-danger bg-transparent text-danger hover:bg-danger/10",
    "focus-visible:ring-danger",
    PRESS,
    DISABLED,
  ),
  // Confirmation destructive dans une modale.
  "danger-solid": cn(
    "bg-danger text-danger-foreground hover:brightness-[.92]",
    "focus-visible:ring-danger",
    PRESS,
    DISABLED,
  ),
  // CTA sur une section nuit (identique dans les deux thèmes).
  inverse: cn(
    "focus-ring-on-night bg-white text-night hover:bg-cobalt hover:text-white",
    "motion-safe:hover:-translate-y-px motion-safe:active:translate-y-0",
    PRESS,
    "disabled:bg-white/30 disabled:text-white/60",
  ),
  "outline-inverse": cn(
    "focus-ring-on-night border border-white/40 text-white hover:bg-white hover:text-night",
    PRESS,
    "disabled:border-white/20 disabled:bg-transparent disabled:text-white/50",
  ),
  // CTA collant en bas d'écran sur mobile (toujours en taille `xl`).
  "fab-mobile": cn(
    "fixed inset-x-4 bottom-[calc(1rem+env(safe-area-inset-bottom))] z-30 mx-auto max-w-[35rem]",
    "bg-accent text-accent-foreground shadow-3 hover:bg-accent-hover",
    "motion-safe:active:scale-[.98]",
    DISABLED,
  ),
};

export function buttonClasses(
  variant: ButtonVariant = "primary",
  size: ButtonSize = "md",
  className?: string,
): string {
  if (variant === "link") {
    // Un lien garde la taille du texte qui l'entoure.
    return cn(BASE, "gap-1.5 font-semibold", VARIANTS.link, className);
  }
  const effectiveSize = variant === "fab-mobile" ? "xl" : size;
  return cn(
    BASE,
    "rounded-full",
    SIZES[effectiveSize],
    VARIANTS[variant],
    className,
  );
}
