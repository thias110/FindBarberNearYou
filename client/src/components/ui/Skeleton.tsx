import type { HTMLAttributes } from "react";
import { cn } from "../../lib/cn";

// Placeholder de chargement. Décoratif (aria-hidden) : le conteneur doit porter
// l'information d'état (ex. `aria-busy`), pas le squelette.
export function Skeleton({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden="true"
      className={cn("animate-pulse rounded-md bg-surface-muted", className)}
      {...props}
    />
  );
}
