import { Logo } from "../Logo";
import { ThemeToggle } from "../ThemeToggle";

const BENEFITS = [
  "Réservez simplement, au salon ou à domicile.",
  "Comparez services, disponibilités et avis.",
  "Gardez vos rendez-vous au même endroit.",
];

function CheckIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-3.5 w-3.5"
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

// Panneau de marque desktop (deuxième colonne de la coque AuthLayout). Caché
// sur mobile : l'en-tête compact de AuthLayout porte alors Logo + ThemeToggle.
export function AuthBrandPanel() {
  return (
    <div className="relative flex h-full min-h-screen flex-col justify-between overflow-hidden border-r border-border bg-surface p-10">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-accent-soft"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-32 -left-20 h-80 w-80 rounded-full bg-accent-soft"
      />

      <div className="relative flex items-center justify-between">
        <Logo />
        <ThemeToggle />
      </div>

      <div className="relative max-w-md">
        <p className="text-3xl font-semibold leading-tight text-foreground">
          Le bon barber, au bon moment.
        </p>
        <p className="mt-4 text-base text-foreground-muted">
          Trouvez un professionnel près de chez vous, consultez ses services et
          réservez votre créneau en quelques instants.
        </p>
        <ul className="mt-8 space-y-3">
          {BENEFITS.map((benefit) => (
            <li
              key={benefit}
              className="flex items-start gap-3 text-sm text-foreground"
            >
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent">
                <CheckIcon />
              </span>
              <span>{benefit}</span>
            </li>
          ))}
        </ul>
      </div>

      <p className="relative text-xs text-foreground-muted">
        FindBarber — trouvez le bon professionnel près de chez vous.
      </p>
    </div>
  );
}
