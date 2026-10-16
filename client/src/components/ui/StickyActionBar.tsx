import type { ReactNode } from "react";
import { cn } from "../../lib/cn";
import { Alert } from "./Alert";

export interface StickyActionBarProps {
  /** Boutons d'action (ex. « Enregistrer »). Facultatifs : sans eux, la barre
   * n'apparaît que pour afficher un résultat. */
  children?: ReactNode;
  error?: string | null;
  success?: string | null;
  className?: string;
}

// Barre d'actions collée en bas de l'écran (issue #56) : le bouton
// d'enregistrement et le résultat (succès ou erreur) restent visibles là où se
// trouve l'utilisateur, sans remonter en haut d'un long formulaire. À placer en
// dernier dans le conteneur de la page ou du <form> : elle reste collée tant
// que ce conteneur est à l'écran.
export function StickyActionBar({
  children,
  error,
  success,
  className,
}: StickyActionBarProps) {
  const hasMessage = Boolean(error || success);
  if (!children && !hasMessage) return null;

  return (
    <div
      className={cn(
        "sticky bottom-0 z-20 -mx-4 space-y-3 border-t border-border bg-surface px-4 py-3 shadow-card sm:mx-0 sm:rounded-t-2xl sm:border-x",
        className,
      )}
    >
      {error && <Alert variant="danger">{error}</Alert>}
      {!error && success && <Alert variant="success">{success}</Alert>}
      {children && <div className="flex flex-wrap gap-2">{children}</div>}
    </div>
  );
}
