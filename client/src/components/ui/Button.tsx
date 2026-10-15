import { forwardRef, type ButtonHTMLAttributes } from "react";
import {
  buttonClasses,
  type ButtonSize,
  type ButtonVariant,
} from "./buttonStyles";

export type { ButtonSize, ButtonVariant } from "./buttonStyles";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    {
      className,
      variant = "primary",
      size = "md",
      type = "button",
      isLoading = false,
      disabled,
      children,
      ...props
    },
    ref,
  ) {
    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled || isLoading}
        aria-busy={isLoading || undefined}
        className={buttonClasses(variant, size, className)}
        {...props}
      >
        {isLoading && (
          <span
            aria-hidden="true"
            className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent"
          />
        )}
        {children}
      </button>
    );
  },
);
