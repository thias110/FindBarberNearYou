import { forwardRef, type SelectHTMLAttributes } from "react";
import { cn } from "../../lib/cn";
import { CONTROL_CLASS } from "./control";

export type SelectProps = SelectHTMLAttributes<HTMLSelectElement>;

// `<select>` natif stylé comme `Input` (accessibilité clavier et lecteurs
// d'écran du natif conservée). Hauteur >= 44 px pour les cibles tactiles.
export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  function Select({ className, ...props }, ref) {
    return (
      <select
        ref={ref}
        className={cn(CONTROL_CLASS, "min-h-11", className)}
        {...props}
      />
    );
  },
);
