import { cn } from "../../lib/cn";

export interface ProPageHeaderProps {
  /** Titre de la page. */
  title: string;
  /** Sous-titre facultatif. */
  description?: string;
  className?: string;
}

/**
 * En-tête commun aux pages de l'espace professionnel : titre et sous-titre.
 * Le retour au tableau de bord passe par la barre latérale et la barre
 * d'onglets. Présentation pure (aucune logique métier).
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
        <h1 className="text-h2 font-extrabold text-foreground">{title}</h1>
        {description && (
          <p className="mt-1 break-words text-sm text-foreground-muted">
            {description}
          </p>
        )}
      </div>
    </header>
  );
}
