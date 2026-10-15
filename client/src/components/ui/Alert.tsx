import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "../../lib/cn";

export type AlertVariant = "info" | "success" | "warning" | "danger";

const VARIANTS: Record<AlertVariant, string> = {
  info: "border-info/30 bg-info/10 text-info",
  success: "border-success/30 bg-success/10 text-success",
  warning: "border-warning/30 bg-warning/10 text-warning",
  danger: "border-danger/30 bg-danger/10 text-danger",
};

// Icône par variante (issue #28) : le type d'alerte ne repose pas sur la
// couleur seule. Décorative : le texte porte le message.
const ICONS: Record<AlertVariant, ReactNode> = {
  info: (
    <>
      <circle cx="10" cy="10" r="8" />
      <path d="M10 9v5M10 6.2v.1" />
    </>
  ),
  success: (
    <>
      <circle cx="10" cy="10" r="8" />
      <path d="M6.5 10.2l2.4 2.4 4.6-4.9" />
    </>
  ),
  warning: (
    <>
      <path d="M10 2.8l7.6 13.4H2.4z" />
      <path d="M10 8v3.8M10 14.1v.1" />
    </>
  ),
  danger: (
    <>
      <circle cx="10" cy="10" r="8" />
      <path d="M10 5.8v5M10 13.9v.1" />
    </>
  ),
};

export interface AlertProps extends HTMLAttributes<HTMLDivElement> {
  variant?: AlertVariant;
  children: ReactNode;
  /**
   * Rôle ARIA. Par défaut : `alert` pour `danger`, `status` sinon. Une valeur
   * explicite reste prioritaire.
   */
  role?: string;
}

export function Alert({
  variant = "info",
  role,
  className,
  children,
  ...props
}: AlertProps) {
  return (
    <div
      role={role ?? (variant === "danger" ? "alert" : "status")}
      className={cn(
        "flex items-start gap-2.5 rounded-xl border p-3.5 text-sm",
        VARIANTS[variant],
        className,
      )}
      {...props}
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 20 20"
        className="mt-px h-5 w-5 shrink-0"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.7}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {ICONS[variant]}
      </svg>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
