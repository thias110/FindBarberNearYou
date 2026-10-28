import type { ReactNode } from "react";
import { cn } from "../../lib/cn";
import { Card } from "./Card";

export interface EmptyStateProps {
  title: string;
  description?: string;
  /** Action optionnelle (lien ou bouton `primary`), ex. « Élargir à 25 km ». */
  action?: ReactNode;
  /** Niveau du titre selon la hiérarchie de la page (h3 par défaut). */
  headingLevel?: 2 | 3;
  className?: string;
}

// État vide : repère visuel discret, titre, une phrase qui dit quoi faire, une action.
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
      <span
        aria-hidden="true"
        className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent-soft text-accent-strong"
      >
        <svg
          viewBox="0 0 24 24"
          className="h-5 w-5"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.8}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
      </span>
      <Heading className="mt-4 text-h3 font-bold text-foreground">{title}</Heading>
      {description && (
        <p className="mt-1.5 max-w-[45ch] text-sm text-foreground-muted">
          {description}
        </p>
      )}
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </Card>
  );
}
