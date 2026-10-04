import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "../../lib/cn";

export type AlertVariant = "info" | "success" | "warning" | "danger";

const VARIANTS: Record<AlertVariant, string> = {
  info: "border-info/30 bg-info/10 text-info",
  success: "border-success/30 bg-success/10 text-success",
  warning: "border-warning/30 bg-warning/10 text-warning",
  danger: "border-danger/30 bg-danger/10 text-danger",
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
      className={cn("rounded-lg border p-3 text-sm", VARIANTS[variant], className)}
      {...props}
    >
      {children}
    </div>
  );
}
