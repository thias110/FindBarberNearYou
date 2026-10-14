import type { ReactNode } from "react";
import { cn } from "../../lib/cn";
import { Card } from "./Card";

export interface EmptyStateProps {
  title: string;
  description?: string;
  /** Action optionnelle (lien ou bouton), ex. « Rechercher un barber ». */
  action?: ReactNode;
  className?: string;
}

// État vide d'une liste ou d'une page : message clair + action éventuelle.
export function EmptyState({
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <Card className={cn("p-6 text-center", className)}>
      <p className="font-medium text-foreground">{title}</p>
      {description && (
        <p className="mt-1 text-sm text-foreground-muted">{description}</p>
      )}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </Card>
  );
}
