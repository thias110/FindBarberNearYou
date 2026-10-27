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
import { FavoriteButton } from "../client/FavoriteButton";
import { Card } from "../ui/Card";
import { buttonClasses } from "../ui/buttonStyles";
import { BarberPhoto, NextSlot, RatingSummary, StartingPrice } from "./BarberHighlights";

interface BarberResultCardProps {
  barber: PublicBarberSearchItem;
  /** Distance depuis la position du visiteur, si elle est connue (#52). */
  distanceKm?: number | null;
  selected: boolean;
  onSelect: (id: string) => void;
}

// Carte « résultat » (gabarit du lot DS-3 : plan §2.6.4). Contenu strictement
// limité à la whitelist publique `PublicBarberSearchItem` : photo, note, prix
// « à partir de » (#48), prochain créneau libre (lot N1) ; aucune donnée
// privée. Le cœur des favoris (lot N5) est posé en haut à droite.
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
        "relative p-4 transition-[transform,box-shadow] duration-base ease-out",
        selected
          ? "ring-2 ring-accent"
          : "hover:shadow-2 motion-safe:hover:-translate-y-1",
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
      <FavoriteButton
        barberId={barber.id}
        name={barber.displayName}
        className="absolute right-3 top-3 z-20"
      />
      <div className="pointer-events-none relative z-10">
        <div className="flex items-start gap-4">
          <BarberPhoto barber={barber} className="h-20 w-20 rounded-xl text-2xl" />
          <div className="min-w-0 pr-12">
            {/* h2 pour la hiérarchie de la page, style « h3 » du système. */}
            <h2 className="text-h3 font-bold text-foreground">
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
            <NextSlot barber={barber} className="mt-1.5" />
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
          className={buttonClasses("secondary", "sm", "pointer-events-auto mt-3")}
        >
          {t("search.result.viewProfile")}
        </Link>
      </div>
    </Card>
  );
}
