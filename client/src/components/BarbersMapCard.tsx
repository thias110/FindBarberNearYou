import { Link } from "react-router-dom";
import { COUNTRY_NAME_BY_CODE } from "@findbarber/shared/countries";
import {
  APPROXIMATE_LOCATION_LABEL,
  SERVICE_PLACE_LABELS,
  TECHNIQUE_LABELS,
} from "@findbarber/shared/constants";
import type { PublicBarberSearchItem } from "@findbarber/shared/types";
import { audienceChips } from "../lib/barberTags";
import { Badge } from "./ui/Badge";

interface BarbersMapCardProps {
  barber: PublicBarberSearchItem;
  onClose: () => void;
}

// Encart du barber sélectionné. Contenu React (JSX auto-échappé) : nom, ville,
// tags utiles et lien profil. Aucun avis, prix ni disponibilité inventés.
export function BarbersMapCard({ barber, onClose }: BarbersMapCardProps) {
  const audiences = audienceChips(barber.audiences);
  const country = COUNTRY_NAME_BY_CODE[barber.countryCode] ?? barber.countryCode;

  return (
    <div
      data-testid="barbers-map-card"
      className="pointer-events-auto absolute inset-x-3 bottom-3 z-10 rounded-2xl border border-border bg-surface/95 p-4 pr-12 shadow-card backdrop-blur"
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Fermer la fiche du barbier"
        className="absolute right-2 top-2 flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md text-lg leading-none text-foreground-muted transition-colors hover:bg-surface-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        <span aria-hidden="true">×</span>
      </button>
      <h3 className="text-base font-semibold text-foreground">
        {barber.displayName}
      </h3>
      <p className="mt-0.5 text-sm text-foreground-muted">
        {barber.city}, {country}
      </p>
      {(audiences.length > 0 || barber.techniques.length > 0) && (
        <div className="mt-2 flex flex-wrap gap-1">
          {audiences.map((label) => (
            // Accent doux : même gabarit que `Badge`, variante non disponible.
            <span
              key={label}
              className="inline-flex items-center rounded-full bg-accent-soft px-2 py-0.5 text-xs font-medium text-foreground"
            >
              {label}
            </span>
          ))}
          {barber.techniques.map((code) => (
            <Badge key={code} variant="neutral">
              {TECHNIQUE_LABELS[code]}
            </Badge>
          ))}
        </div>
      )}
      {barber.places.length > 0 && (
        <div className="mt-1 flex flex-wrap gap-1">
          {barber.places.map((place) => (
            <Badge key={place} variant="neutral">
              {SERVICE_PLACE_LABELS[place]}
            </Badge>
          ))}
        </div>
      )}
      <p className="mt-1 text-xs text-foreground-muted">
        {APPROXIMATE_LOCATION_LABEL}
      </p>
      <Link
        to={`/barbers/${barber.id}`}
        className="mt-3 inline-flex min-h-[44px] items-center rounded-lg bg-accent px-4 text-sm font-medium text-accent-foreground transition-colors hover:bg-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        Voir le profil
      </Link>
    </div>
  );
}
