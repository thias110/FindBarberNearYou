import type { HTMLAttributes } from "react";
import { cn } from "../../lib/cn";

// Conteneur de surface du design system. Pas de padding par défaut : l'appelant
// précise `p-4`/`p-6` pour éviter les conflits de classes.
export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-border bg-surface text-foreground shadow-card",
        className,
      )}
      {...props}
    />
  );
}
