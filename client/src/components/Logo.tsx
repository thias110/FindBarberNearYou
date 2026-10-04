import { cn } from "../lib/cn";

export interface LogoProps {
  className?: string;
  /** Affiche le nom visible « FindBarber » à côté de la marque. */
  showWordmark?: boolean;
}

// Logo provisoire : marque carrée accent + « F » blanc, accompagnée du nom
// visible FindBarber. Le nom technique du dépôt reste FindBarberNearYou.
export function Logo({ className, showWordmark = true }: LogoProps) {
  return (
    <span
      role="img"
      aria-label="FindBarber"
      className={cn("inline-flex items-center gap-2", className)}
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 32 32"
        className="h-8 w-8 shrink-0"
        focusable="false"
      >
        <rect width="32" height="32" rx="8" className="fill-accent" />
        <path
          className="fill-accent-foreground"
          d="M10 8h12v4h-8v4h7v4h-7v8h-4z"
        />
      </svg>
      {showWordmark && (
        <span
          aria-hidden="true"
          className="text-lg font-semibold tracking-tight text-foreground"
        >
          FindBarber
        </span>
      )}
    </span>
  );
}
