import type { TFunction } from "i18next";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import type { ServicePlace, Technique } from "@findbarber/shared/constants";
import type { PublicBarberSearchItem } from "@findbarber/shared/types";
import { popularTechniquesOf } from "../../lib/barberTags";
import { formatDistance } from "../../lib/geo";
import { label } from "../../lib/labels";
import { CertifiedBadge } from "../barber/CertifiedBadge";
import { Badge } from "../ui/Badge";
import {
  BarberPhoto,
  RatingSummary,
  StartingPrice,
} from "../search/BarberHighlights";

// Lieu résumé pour le visiteur (issue #54) : « En salon », « À domicile »
// (le barber se déplace) ou « Chez le professionnel ».
function placeLabels(places: ServicePlace[], t: TFunction<"client">): string[] {
  const labels: string[] = [];
  if (places.includes("SALON")) labels.push(label("servicePlace", "SALON"));
  if (places.includes("AT_CLIENT")) labels.push(t("home.preview.atHome"));
  if (places.includes("AT_PROVIDER")) labels.push(label("servicePlace", "AT_PROVIDER"));
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
  const { t } = useTranslation("client");
  const popular = popularTechniquesOf(barber.techniques, popularRanking);
  const places = placeLabels(barber.places, t);

  return (
    <Link
      to={`/barbers/${barber.id}`}
      className="group flex h-full flex-col overflow-hidden rounded-3xl border border-border bg-surface text-foreground shadow-card-sm transition-shadow hover:shadow-card focus-ring"
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
          <ul className="mt-3 flex flex-wrap gap-1.5" aria-label={t("home.preview.placesAndServices")}>
            {places.map((label) => (
              <li key={label}>
                <Badge variant="neutral">{label}</Badge>
              </li>
            ))}
            {popular.map((technique) => (
              <li key={technique}>
                <Badge variant="neutral">{label("technique", technique)}</Badge>
              </li>
            ))}
          </ul>
        )}

        <StartingPrice barber={barber} className="mt-auto pt-3" />
      </div>
    </Link>
  );
}
