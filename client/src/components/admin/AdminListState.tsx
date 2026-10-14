import type { ReactNode } from "react";
import { Alert } from "../ui/Alert";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { EmptyState } from "../ui/EmptyState";
import { Skeleton } from "../ui/Skeleton";

// États communs des listes d'administration : chargement (skeletons annoncés),
// erreur avec « Réessayer », vide, puis contenu.
export function AdminListState({
  loading,
  error,
  onRetry,
  isEmpty,
  emptyTitle,
  loadingLabel = "Chargement…",
  children,
}: {
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  isEmpty: boolean;
  emptyTitle: string;
  loadingLabel?: string;
  children: ReactNode;
}) {
  if (loading) {
    return (
      <div className="space-y-3" aria-busy="true">
        <span className="sr-only" role="status">
          {loadingLabel}
        </span>
        {[0, 1, 2].map((key) => (
          <Card key={key} className="space-y-2 p-4">
            <Skeleton className="h-5 w-1/2" />
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-4 w-1/3" />
          </Card>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="danger">
        <p>{error}</p>
        <Button variant="secondary" className="mt-3 min-h-11" onClick={onRetry}>
          Réessayer
        </Button>
      </Alert>
    );
  }

  if (isEmpty) {
    return <EmptyState title={emptyTitle} />;
  }

  return <>{children}</>;
}
