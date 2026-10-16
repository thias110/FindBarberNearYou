import { Link } from "react-router-dom";
import {
  SERVICE_PLACE_LABELS,
  TECHNIQUE_LABELS,
  type ServicePlace,
  type Technique,
} from "@findbarber/shared/constants";
import type { PublicBarberSearchItem } from "@findbarber/shared/types";
import { popularTechniquesOf } from "../../lib/barberTags";
import { formatDistance } from "../../lib/geo";
import { CertifiedBadge } from "../barber/CertifiedBadge";
import { Badge } from "../ui/Badge";
import {
  BarberPhoto,
  RatingSummary,
  StartingPrice,
} from "../search/BarberHighlights";

// Lieu résumé pour le visiteur (issue #54) : « En salon », « À domicile »
// (le barber se déplace) ou « Chez le professionnel ».
function placeLabels(places: ServicePlace[]): string[] {
  const labels: string[] = [];
  if (places.includes("SALON")) labels.push(SERVICE_PLACE_LABELS.SALON);
  if (places.includes("AT_CLIENT")) labels.push("À domicile");
  if (places.includes("AT_PROVIDER")) labels.push(SERVICE_PLACE_LABELS.AT_PROVIDER);
  return labels;
}

interface BarberPreviewCardProps {
  barber: PublicBarberSearchItem;
  popularRanking: readonly Technique[];
  /** Distance depuis la position partagée du visiteur, sinon null. */
  distanceKm: number | null;
}

// Carte « Barbers à découvrir » (issue #54) : toute la carte mène au profil.
// Données de la recherche publique uniquement ; ni nombre de services, ni pays.
export function BarberPreviewCard({
  barber,
  popularRanking,
  distanceKm,
}: BarberPreviewCardProps) {
  const popular = popularTechniquesOf(barber.techniques, popularRanking);
  const places = placeLabels(barber.places);

  return (
    <Link
      to={`/barbers/${barber.id}`}
      className="group flex h-full flex-col overflow-hidden rounded-3xl border border-border bg-surface text-foreground shadow-card-sm transition-shadow hover:shadow-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      <div className="relative">
        <BarberPhoto
          barber={barber}
          className="aspect-[4/3] w-full text-5xl transition-transform duration-300 group-hover:scale-[1.02] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
        />
        {barber.certified && (
          <CertifiedBadge className="absolute left-3 top-3 shadow-card-sm" />
        )}
      </div>

      <div className="flex flex-1 flex-col p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-base font-semibold leading-snug">
            {barber.displayName}
          </h3>
          <RatingSummary barber={barber} className="shrink-0" />
        </div>
        <p className="mt-0.5 text-sm text-foreground-muted">
          {barber.city}
          {distanceKm !== null && ` · ${formatDistance(distanceKm)}`}
        </p>

        {(places.length > 0 || popular.length > 0) && (
          <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="Lieux et prestations">
            {places.map((label) => (
              <li key={label}>
                <Badge variant="neutral">{label}</Badge>
              </li>
            ))}
            {popular.map((technique) => (
              <li key={technique}>
                <Badge variant="neutral">{TECHNIQUE_LABELS[technique]}</Badge>
              </li>
            ))}
          </ul>
        )}

        <StartingPrice barber={barber} className="mt-auto pt-3" />
      </div>
    </Link>
  );
}
