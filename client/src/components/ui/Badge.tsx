import type { HTMLAttributes } from "react";
import { cn } from "../../lib/cn";

export type BadgeVariant =
  | "neutral"
  | "accent"
  | "gold"
  | "success"
  | "warning"
  | "danger"
  | "info";

const VARIANTS: Record<BadgeVariant, string> = {
  neutral: "border border-border bg-surface-muted text-foreground-muted",
  accent: "bg-accent text-accent-foreground",
  // L'or reste une touche (fond/bordure) : jamais du texte courant.
  gold: "border border-gold bg-gold-soft text-foreground",
  // Variantes de statut additives (le vert est réservé au succès).
  success: "bg-success/15 text-success",
  warning: "bg-warning/15 text-warning",
  danger: "bg-danger/15 text-danger",
  info: "bg-info/15 text-info",
};

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

export function Badge({ className, variant = "neutral", ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        VARIANTS[variant],
        className,
      )}
      {...props}
    />
  );
}
