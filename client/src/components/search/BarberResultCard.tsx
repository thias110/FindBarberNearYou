import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { localizedCountryName } from "../../lib/countryName";
import type { PublicBarberSearchItem } from "@findbarber/shared/types";
import { audienceChips } from "../../lib/barberTags";
import { cn } from "../../lib/cn";
import { formatDistance } from "../../lib/geo";
import { label } from "../../lib/labels";
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
  const { t } = useTranslation("client");
  const country = localizedCountryName(barber.countryCode);
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
        aria-label={t("search.result.showOnMap", { name: barber.displayName })}
        aria-pressed={selected}
        className="absolute inset-0 z-0 rounded-2xl focus-ring"
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
              <Badge key={label} variant="accent" size="sm">
                {label}
              </Badge>
            ))}
            {barber.techniques.map((code) => (
              <Badge key={code} variant="neutral">
                {label("technique", code)}
              </Badge>
            ))}
          </div>
        )}

        {barber.places.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {barber.places.map((place) => (
              <Badge key={place} variant="neutral">
                {label("servicePlace", place)}
              </Badge>
            ))}
          </div>
        )}

        <Link
          to={`/barbers/${barber.id}`}
          className={buttonClasses("secondary", "md", "pointer-events-auto mt-3")}
        >
          {t("search.result.viewProfile")}
        </Link>
      </div>
    </Card>
  );
}
