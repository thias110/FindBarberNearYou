import { useTranslation } from "react-i18next";
import { cn } from "../../lib/cn";
import { Button } from "./Button";
import { Card } from "./Card";

export interface ErrorStateProps {
  /** Titre factuel, ex. « Impossible de charger les créneaux ». */
  title: string;
  /** Cause connue et comment s'en sortir, si possible. */
  description?: string;
  onRetry?: () => void;
  retryLabel?: string;
  className?: string;
}

// État d'erreur (lot DS-3, plan §2.7) : icône, titre factuel, cause, puis
// « Réessayer » en `secondary`. Annoncé par `role="alert"`.
export function ErrorState({
  title,
  description,
  onRetry,
  retryLabel,
  className,
}: ErrorStateProps) {
  const { t } = useTranslation("common");
  return (
    <Card
      role="alert"
      className={cn("flex flex-col items-center p-8 text-center", className)}
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className="h-8 w-8 text-danger"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="12" cy="12" r="9.5" />
        <path d="M12 7v6M12 16.5v.1" />
      </svg>
      <p className="mt-4 text-h4 font-bold text-foreground">{title}</p>
      {description && (
        <p className="mt-1.5 max-w-[45ch] text-sm text-foreground-muted">
          {description}
        </p>
      )}
      {onRetry && (
        <Button variant="secondary" className="mt-5" onClick={onRetry}>
          {retryLabel ?? t("state.retry")}
        </Button>
      )}
    </Card>
  );
}
