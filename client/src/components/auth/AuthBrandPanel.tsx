import { Logo } from "../Logo";

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
// sur mobile : l'en-tête compact de AuthLayout porte alors le logo. Sans
// boules décoratives (issue #60), comme l'accueil.
export function AuthBrandPanel() {
  return (
    <div className="flex h-full min-h-screen flex-col justify-between border-r border-border bg-surface p-10">
      <div>
        <Logo />
      </div>

      <div className="max-w-md">
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
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent-strong">
                <CheckIcon />
              </span>
              <span>{benefit}</span>
            </li>
          ))}
        </ul>
      </div>

      <p className="text-xs text-foreground-muted">
        FindBarber — trouvez le bon professionnel près de chez vous.
      </p>
    </div>
  );
}
