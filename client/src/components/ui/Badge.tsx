import type { HTMLAttributes } from "react";
import { cn } from "../../lib/cn";

// Badges (lot DS-2, plan §2.6.5) : pilule, texte « caption » (13 px, 600).
export type BadgeVariant =
  | "neutral"
  | "accent"
  | "brass"
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "live";

export type BadgeSize = "sm" | "md" | "lg";

const VARIANTS: Record<BadgeVariant, string> = {
  neutral: "border border-border bg-surface-muted text-foreground-muted",
  // Fond doux + texte d'accent (ex. publics accueillis) : >= 4.5:1, testé.
  accent: "bg-accent-soft text-accent-strong",
  // Confiance (badge « Certifié ») : laiton doux, texte `brass-strong`
  // (>= 4.5:1, testé) ; le laiton seul ne porte jamais de texte.
  brass: "border border-brass bg-brass-soft text-brass-strong",
  // Variantes de statut additives (le vert est réservé au succès).
  success: "bg-success/15 text-success",
  warning: "bg-warning/15 text-warning",
  danger: "bg-danger/15 text-danger",
  info: "bg-info/15 text-info",
  // Disponibilité en direct : point vert qui pulse (sauf reduced-motion).
  live: "bg-success/15 text-success",
};

// Hauteurs 22, 26 et 30 px.
const SIZES: Record<BadgeSize, string> = {
  sm: "min-h-[1.375rem] px-2 text-xs",
  md: "min-h-[1.625rem] px-2.5 text-[0.8125rem]",
  lg: "min-h-[1.875rem] px-3 text-[0.8125rem]",
};

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  size?: BadgeSize;
}

export function Badge({
  className,
  variant = "neutral",
  size = "md",
  children,
  ...props
}: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full font-semibold leading-none",
        SIZES[size],
        VARIANTS[variant],
        className,
      )}
      {...props}
    >
      {variant === "live" && (
        <span
          aria-hidden="true"
          className="h-1.5 w-1.5 shrink-0 rounded-full bg-success motion-safe:animate-pulse"
        />
      )}
      {children}
    </span>
  );
}
