import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useLoadingTimeout } from "../../lib/useLoadingTimeout";
import { Card } from "../ui/Card";
import { EmptyState } from "../ui/EmptyState";
import { ErrorState } from "../ui/ErrorState";
import { Skeleton } from "../ui/Skeleton";

// États communs des listes d'administration : chargement (skeletons annoncés,
// erreur au bout de 10 s), erreur avec « Réessayer », vide, puis contenu.
export function AdminListState({
  loading,
  error,
  onRetry,
  isEmpty,
  emptyTitle,
  loadingLabel,
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
  const { t } = useTranslation("admin");
  const { t: tCommon } = useTranslation("common");
  const timedOut = useLoadingTimeout(loading);

  if (loading && timedOut) {
    return (
      <ErrorState
        title={tCommon("state.timeout")}
        onRetry={onRetry}
        retryLabel={t("common.retry")}
      />
    );
  }

  if (loading) {
    return (
      <div className="space-y-3" aria-busy="true">
        <span className="sr-only" role="status">
          {loadingLabel ?? t("listState.loading")}
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
      <ErrorState title={error} onRetry={onRetry} retryLabel={t("common.retry")} />
    );
  }

  if (isEmpty) {
    return <EmptyState title={emptyTitle} />;
  }

  return <>{children}</>;
}
