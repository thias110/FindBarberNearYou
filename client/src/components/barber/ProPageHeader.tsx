import { Link } from "react-router-dom";
import { cn } from "../../lib/cn";
import { buttonClasses } from "../ui/buttonStyles";

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
        <h1 className="text-2xl sm:text-3xl font-extrabold text-foreground">{title}</h1>
        {description && (
          <p className="mt-1 break-words text-sm text-foreground-muted">
            {description}
          </p>
        )}
      </div>
      <Link
        to="/pro/dashboard"
        className={buttonClasses("ghost", "md", "shrink-0")}
      >
        Retour au tableau de bord
      </Link>
    </header>
  );
}
