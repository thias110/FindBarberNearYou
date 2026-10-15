import { Link } from "react-router-dom";
import { COUNTRY_NAME_BY_CODE } from "@findbarber/shared/countries";
import {
  SERVICE_PLACE_LABELS,
  TECHNIQUE_LABELS,
} from "@findbarber/shared/constants";
import type { PublicBarberSearchItem } from "@findbarber/shared/types";
import { audienceChips } from "../../lib/barberTags";
import { cn } from "../../lib/cn";
import { formatDistance } from "../../lib/geo";
import { Badge } from "../ui/Badge";
import { CertifiedBadge } from "../barber/CertifiedBadge";
import { Card } from "../ui/Card";
import { buttonClasses } from "../ui/buttonStyles";
import { BarberPhoto, RatingSummary, StartingPrice } from "./BarberHighlights";

interface BarberResultCardProps {
  barber: PublicBarberSearchItem;
  /** Distance depuis la position du visiteur, si elle est connue (#52). */
  distanceKm?: number | null;
  selected: boolean;
  onSelect: (id: string) => void;
}

// Contenu strictement limité à la whitelist publique `PublicBarberSearchItem` :
// photo, note, prix « à partir de » (#48) ; aucune disponibilité ni donnée privée.
export function BarberResultCard({
  barber,
  distanceKm = null,
  selected,
  onSelect,
}: BarberResultCardProps) {
  const country = COUNTRY_NAME_BY_CODE[barber.countryCode] ?? barber.countryCode;
  const audiences = audienceChips(barber.audiences);

  return (
    <Card
      className={cn(
        "relative p-5 transition",
        selected ? "ring-2 ring-accent" : "hover:shadow-md",
      )}
    >
      {/* Zone d'action pleine carte : sélectionne le marqueur. */}
      <button
        type="button"
        onClick={() => onSelect(barber.id)}
        aria-label={`Afficher ${barber.displayName} sur la carte`}
        aria-pressed={selected}
        className="absolute inset-0 z-0 rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      />
      <div className="pointer-events-none relative z-10">
        <div className="flex items-start gap-4">
          <BarberPhoto barber={barber} className="h-16 w-16 rounded-2xl text-xl" />
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-foreground">
              {barber.displayName}
            </h2>
            {barber.certified && <CertifiedBadge className="mt-0.5" />}
            <p className="mt-0.5 text-sm text-foreground-muted">
              {barber.city}
              {barber.countryCode ? `, ${country}` : ""}
              {distanceKm !== null && ` · ${formatDistance(distanceKm)}`}
            </p>
            <RatingSummary barber={barber} className="mt-1" />
            <StartingPrice barber={barber} className="mt-0.5" />
          </div>
        </div>

        {(audiences.length > 0 || barber.techniques.length > 0) && (
          <div className="mt-2 flex flex-wrap gap-1">
            {audiences.map((label) => (
              // Accent doux : la variante `Badge` n'en dispose pas (#16 non
              // modifiable ici), on garde le même gabarit avec les tokens.
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
          <div className="mt-2 flex flex-wrap gap-1">
            {barber.places.map((place) => (
              <Badge key={place} variant="neutral">
                {SERVICE_PLACE_LABELS[place]}
              </Badge>
            ))}
          </div>
        )}

        <Link
          to={`/barbers/${barber.id}`}
          className={buttonClasses("secondary", "md", "pointer-events-auto mt-3")}
        >
          Voir le profil
        </Link>
      </div>
    </Card>
  );
}
