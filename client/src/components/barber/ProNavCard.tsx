import { Link } from "react-router-dom";
import { cn } from "../../lib/cn";
import { Card } from "../ui/Card";

export interface ProNavCardProps {
  /** Route de destination (déjà existante du routeur BARBER). */
  to: string;
  /** Titre court de la section. */
  title: string;
  /** Courte description de ce que fait la section. */
  description: string;
  className?: string;
}

/**
 * Carte de navigation de l'espace professionnel. Toute la surface est
 * activable (le `Link` enveloppe la `Card`), focus clavier visible, cible
 * tactile >= 44 px. Aucune logique métier : présentation pure.
 */
export function ProNavCard({
  to,
  title,
  description,
  className,
}: ProNavCardProps) {
  return (
    <Link
      to={to}
      className={cn(
        "group block rounded-2xl",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
        "focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        className,
      )}
    >
      <Card className="flex h-full min-h-[44px] flex-col p-5 transition-colors group-hover:border-accent/60">
        <span className="font-semibold text-foreground">{title}</span>
        <span className="mt-1 text-sm text-foreground-muted">{description}</span>
      </Card>
    </Link>
  );
}
