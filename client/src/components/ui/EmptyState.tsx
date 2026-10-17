import type { ReactNode } from "react";
import { cn } from "../../lib/cn";
import { Card } from "./Card";
import { FadeMotif } from "./FadeMotif";

export interface EmptyStateProps {
  title: string;
  description?: string;
  /** Action optionnelle (lien ou bouton `primary`), ex. « Élargir à 25 km ». */
  action?: ReactNode;
  /** Niveau du titre selon la hiérarchie de la page (h3 par défaut). */
  headingLevel?: 2 | 3;
  className?: string;
}

// État vide (lot DS-3, plan §2.7) : motif « dégradé », titre, une phrase qui
// dit quoi faire, une action. Un écran vide est une invitation à agir.
export function EmptyState({
  title,
  description,
  action,
  headingLevel = 3,
  className,
}: EmptyStateProps) {
  const Heading = headingLevel === 2 ? "h2" : "h3";
  return (
    <Card className={cn("flex flex-col items-center p-8 text-center", className)}>
      <FadeMotif className="h-12 w-[7.5rem] text-accent/25" />
      <Heading className="mt-5 text-h3 font-bold text-foreground">{title}</Heading>
      {description && (
        <p className="mt-1.5 max-w-[45ch] text-sm text-foreground-muted">
          {description}
        </p>
      )}
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </Card>
  );
}
