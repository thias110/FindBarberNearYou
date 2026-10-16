import {
  forwardRef,
  useEffect,
  useState,
  type ButtonHTMLAttributes,
  type ReactNode,
} from "react";
import {
  buttonClasses,
  type ButtonSize,
  type ButtonVariant,
} from "./buttonStyles";

export type { ButtonSize, ButtonVariant } from "./buttonStyles";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Icône de tête (décorative) : remplacée par le spinner ou la coche. */
  icon?: ReactNode;
  isLoading?: boolean;
  /**
   * Retour de succès en place (plan §2.6, état « Succès ») : la coche remplace
   * l'icône. Le libellé (« Enregistré ») et la durée restent à l'appelant.
   */
  isSuccess?: boolean;
}

// Le spinner n'apparaît qu'après ce délai : une action rapide ne clignote pas.
const SPINNER_DELAY_MS = 300;

function useDelayedFlag(active: boolean, delayMs: number): boolean {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    if (!active) {
      setShown(false);
      return;
    }
    const timer = window.setTimeout(() => setShown(true), delayMs);
    return () => window.clearTimeout(timer);
  }, [active, delayMs]);
  return shown;
}

function Spinner() {
  return (
    <span
      aria-hidden="true"
      className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent"
    />
  );
}

function Check() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 16 16"
      className="h-4 w-4 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 8.5l3.2 3L13 4.5" />
    </svg>
  );
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    {
      className,
      variant = "primary",
      size = "md",
      type = "button",
      icon,
      isLoading = false,
      isSuccess = false,
      disabled,
      onClick,
      children,
      ...props
    },
    ref,
  ) {
    const showSpinner = useDelayedFlag(isLoading, SPINNER_DELAY_MS);
    const lead = showSpinner ? (
      <Spinner />
    ) : isSuccess ? (
      <Check />
    ) : icon ? (
      <span aria-hidden="true" className="inline-flex shrink-0">
        {icon}
      </span>
    ) : null;

    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled}
        // Pendant le chargement, le bouton garde sa couleur (pas l'état
        // désactivé) mais refuse les clics, y compris l'envoi d'un formulaire
        // par Entrée, dès le début et même avant l'apparition du spinner.
        aria-disabled={isLoading || undefined}
        aria-busy={isLoading || undefined}
        onClick={(event) => {
          if (isLoading) {
            event.preventDefault();
            return;
          }
          onClick?.(event);
        }}
        className={buttonClasses(variant, size, className)}
        {...props}
      >
        {lead}
        {children}
      </button>
    );
  },
);
