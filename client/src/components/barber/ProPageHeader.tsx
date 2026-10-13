import { Link } from "react-router-dom";
import { cn } from "../../lib/cn";

export interface ProPageHeaderProps {
  /** Titre de la page. */
  title: string;
  /** Sous-titre facultatif. */
  description?: string;
  className?: string;
}

/**
 * En-tête commun aux pages de l'espace professionnel : titre, sous-titre et
 * lien de retour vers le tableau de bord. Présentation pure (aucune logique
 * métier).
 */
export function ProPageHeader({
  title,
  description,
  className,
}: ProPageHeaderProps) {
  return (
    <header
      className={cn(
        "flex flex-wrap items-start justify-between gap-3",
        className,
      )}
    >
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold text-foreground">{title}</h1>
        {description && (
          <p className="mt-1 break-words text-sm text-foreground-muted">
            {description}
          </p>
        )}
      </div>
      <Link
        to="/pro/dashboard"
        className="inline-flex min-h-[44px] shrink-0 items-center justify-center rounded-lg px-3 text-sm font-medium text-foreground transition-colors hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        Retour au tableau de bord
      </Link>
    </header>
  );
}
