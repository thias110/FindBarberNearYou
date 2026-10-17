import { cn } from "../lib/cn";

export interface LogoProps {
  className?: string;
  /** Affiche le nom visible « FindBarber » à côté de la marque. */
  showWordmark?: boolean;
  /** `onNight` : nom en blanc, sur une section nuit (barre sur le hero). */
  tone?: "default" | "onNight";
}

// Logo provisoire : marque carrée accent + « F », accompagnée du nom visible
// FindBarber. Le nom technique du dépôt reste FindBarberNearYou.
//
// Point d'insertion unique du logo dans l'interface (header, écrans
// d'authentification). Pour remplacer le logo : modifier ce composant ET
// `client/public/favicon.svg` (même dessin, couleurs en dur car un favicon ne
// lit pas les tokens CSS), puis régénérer `client/public/email-logo.png`
// (voir components/ui/README.md).
export function Logo({
  className,
  showWordmark = true,
  tone = "default",
}: LogoProps) {
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
          className={cn(
            "text-lg font-semibold tracking-tight transition-colors duration-base",
            tone === "onNight" ? "text-white" : "text-foreground",
          )}
        >
          FindBarber
        </span>
      )}
    </span>
  );
}
