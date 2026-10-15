import { useId, type ReactNode } from "react";
import { cn } from "../../lib/cn";

export interface FieldControlProps {
  id: string;
  "aria-invalid": true | undefined;
  "aria-describedby": string | undefined;
}

export interface FieldProps {
  label: string;
  error?: string | null;
  hint?: string;
  className?: string;
  /**
   * Rendu du contrôle (Input, etc.). Le contrôle DOIT recevoir les props
   * fournies pour lier correctement `label`, erreur et aide (a11y).
   */
  children: (control: FieldControlProps) => ReactNode;
}

export function Field({
  label,
  error,
  hint,
  className,
  children,
}: FieldProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy =
    [error ? errorId : null, hint ? hintId : null].filter(Boolean).join(" ") ||
    undefined;

  return (
    <div className={cn("space-y-1.5", className)}>
      <label htmlFor={id} className="block text-sm font-semibold text-foreground">
        {label}
      </label>
      {children({
        id,
        "aria-invalid": error ? true : undefined,
        "aria-describedby": describedBy,
      })}
      {hint && !error && (
        <p id={hintId} className="text-sm text-foreground-muted">
          {hint}
        </p>
      )}
      {error && (
        // Icône en plus de la couleur : l'erreur ne repose pas sur le rouge seul.
        <p id={errorId} className="flex items-start gap-1.5 text-sm text-danger">
          <svg
            aria-hidden="true"
            viewBox="0 0 16 16"
            className="mt-0.5 h-4 w-4 shrink-0"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.8}
            strokeLinecap="round"
          >
            <circle cx="8" cy="8" r="6.5" />
            <path d="M8 4.75v3.75M8 11.1v.15" />
          </svg>
          <span>{error}</span>
        </p>
      )}
    </div>
  );
}
