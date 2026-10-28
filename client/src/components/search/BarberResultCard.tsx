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
  hovered?: boolean;
  onSelect: (id: string) => void;
  onHoverChange?: (hovered: boolean) => void;
}

// Carte « résultat » (gabarit du lot DS-3 : plan §2.6.4). Contenu strictement
// limité à la whitelist publique `PublicBarberSearchItem` : photo, note, prix
// « à partir de » (#48), prochain créneau libre (lot N1) ; aucune donnée
// privée. Le cœur des favoris (lot N5) est posé en haut à droite.
export function BarberResultCard({
  barber,
  distanceKm = null,
  selected,
  hovered = false,
  onSelect,
  onHoverChange,
}: BarberResultCardProps) {
  const { t } = useTranslation("client");
  const country = localizedCountryName(barber.countryCode);
  const audiences = audienceChips(barber.audiences);

  return (
    <Card
      role="article"
      onMouseEnter={() => onHoverChange?.(true)}
      onMouseLeave={() => onHoverChange?.(false)}
      className={cn(
        "relative rounded-2xl border-border/80 p-4 transition-[transform,box-shadow,border-color] duration-base ease-out",
        selected
          ? "border-accent ring-2 ring-accent shadow-2"
          : hovered
            ? "border-accent/60 shadow-2 motion-safe:-translate-y-0.5"
            : "hover:border-accent/40 hover:shadow-2 motion-safe:hover:-translate-y-1",
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
        <div className="flex items-start gap-3.5">
          <div className="relative shrink-0">
            <BarberPhoto
              barber={barber}
              className="h-24 w-24 rounded-2xl text-2xl ring-1 ring-border/70"
            />
            {barber.availableToday && (
              <span
                aria-hidden="true"
                className="absolute left-2 top-2 flex h-3 w-3 items-center justify-center rounded-full bg-surface shadow-1"
              >
                <span className="h-2 w-2 rounded-full bg-success" />
              </span>
            )}
          </div>
          <div className="min-w-0 flex-1 pr-10">
            {/* h2 pour la hiérarchie de la page, style « h3 » du système. */}
            <h2 className="text-h3 font-bold leading-snug text-foreground">
              {barber.displayName}
            </h2>
            {barber.certified && <CertifiedBadge className="mt-1" />}
            <p className="mt-0.5 text-sm text-foreground-muted">
              {barber.city}
              {barber.countryCode ? `, ${country}` : ""}
              {distanceKm !== null && ` · ${formatDistance(distanceKm)}`}
            </p>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-0.5">
              <RatingSummary barber={barber} />
              <StartingPrice barber={barber} />
            </div>
            {barber.nextAvailableAt ? (
              <div className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-accent-soft px-2.5 py-1">
                <svg
                  aria-hidden="true"
                  viewBox="0 0 16 16"
                  className="h-3.5 w-3.5 shrink-0 text-accent-strong"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="8" cy="8" r="6" />
                  <path d="M8 4.8V8l2.2 1.4" />
                </svg>
                <NextSlot barber={barber} className="text-xs" />
              </div>
            ) : (
              <NextSlot barber={barber} className="mt-1.5" />
            )}
          </div>
        </div>

        {(audiences.length > 0 || barber.techniques.length > 0 || barber.places.length > 0) && (
          <div className="mt-3 flex flex-wrap gap-1">
            {audiences.map((audienceLabel) => (
              <Badge key={audienceLabel} variant="accent" size="sm">
                {audienceLabel}
              </Badge>
            ))}
            {barber.places.map((place) => (
              <Badge key={place} variant="neutral" size="sm">
                {label("servicePlace", place)}
              </Badge>
            ))}
            {barber.techniques.map((code) => (
              <Badge key={code} variant="neutral" size="sm">
                {label("technique", code)}
              </Badge>
            ))}
          </div>
        )}

        <div className="mt-3.5 flex flex-wrap items-center gap-2 border-t border-border/70 pt-3">
          <Link
            to={`/barbers/${barber.id}`}
            className={buttonClasses("secondary", "sm", "pointer-events-auto flex-1")}
          >
            {t("search.result.viewProfile")}
          </Link>
          <Link
            to={`/barbers/${barber.id}#reserver`}
            className={buttonClasses("primary", "sm", "pointer-events-auto flex-1 shadow-cta")}
          >
            {t("map.card.book")}
          </Link>
        </div>
      </div>
    </Card>
  );
}
