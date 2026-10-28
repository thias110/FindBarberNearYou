import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import type { PublicBarberSearchItem } from "@findbarber/shared/types";
import { formatDistance } from "../lib/geo";
import { label } from "../lib/labels";
import { CertifiedBadge } from "./barber/CertifiedBadge";
import { Badge } from "./ui/Badge";
import { buttonClasses } from "./ui/buttonStyles";
import {
  BarberPhoto,
  NextSlot,
  RatingSummary,
  StartingPrice,
} from "./search/BarberHighlights";

interface BarbersMapCardProps {
  barber: PublicBarberSearchItem;
  distanceKm?: number | null;
  onClose: () => void;
}

// Fiche du barber sélectionné sur la carte (issue #53) : photo, nom, note,
// nombre d'avis, prix « à partir de » et bouton « Réserver ». Contenu React
// (JSX auto-échappé), données de la recherche publique uniquement. Se ferme
// par le bouton ×, la touche Échap ou un glissement vers le bas (mobile).
export function BarbersMapCard({
  barber,
  distanceKm = null,
  onClose,
}: BarbersMapCardProps) {
  const { t } = useTranslation("client");
  const touchStartY = useRef<number | null>(null);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <section
      data-testid="barbers-map-card"
      aria-label={t("map.card.label", { name: barber.displayName })}
      onTouchStart={(event) => {
        touchStartY.current = event.touches[0]?.clientY ?? null;
      }}
      onTouchEnd={(event) => {
        const start = touchStartY.current;
        const end = event.changedTouches[0]?.clientY;
        touchStartY.current = null;
        // Glissement vers le bas d'au moins 60 px : ferme la fiche.
        if (start !== null && end !== undefined && end - start > 60) onClose();
      }}
      // Mobile : au-dessus du panneau de liste replié. Desktop : en bas à
      // droite, hors du panneau latéral.
      className="pointer-events-auto absolute inset-x-3 bottom-24 z-10 mx-auto max-w-md overflow-hidden rounded-3xl border border-border/85 bg-surface/95 shadow-3 backdrop-blur-xl backdrop-saturate-150 supports-[not(backdrop-filter:blur(1px))]:bg-surface lg:inset-x-auto lg:bottom-10 lg:right-6 lg:w-[25rem]"
    >
      <div aria-hidden="true" className="flex justify-center pt-2 sm:hidden">
        <span className="h-1.5 w-10 rounded-full bg-border-strong" />
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label={t("map.card.close")}
        className="absolute right-2.5 top-2.5 z-10 flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full bg-surface/90 text-xl leading-none text-foreground-muted transition-colors hover:bg-surface-muted hover:text-foreground focus-ring"
      >
        <span aria-hidden="true">×</span>
      </button>

      <div className="flex gap-4 p-4 pr-12">
        <div className="relative shrink-0">
          <BarberPhoto
            barber={barber}
            className="h-24 w-24 rounded-2xl text-3xl ring-1 ring-border/70"
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
        <div className="min-w-0 flex-1">
          <h3 className="break-words text-lg font-bold leading-snug text-foreground">
            {barber.displayName}
          </h3>
          <p className="text-sm text-foreground-muted">
            {barber.city}
            {distanceKm !== null && ` · ${formatDistance(distanceKm)}`}
          </p>
          <RatingSummary barber={barber} className="mt-1" />
          <StartingPrice barber={barber} className="mt-0.5" />
          <NextSlot barber={barber} className="mt-1" />
        </div>
      </div>

      {(barber.certified || barber.places.length > 0) && (
        <div className="flex flex-wrap gap-1 px-4">
          {barber.certified && <CertifiedBadge />}
          {barber.places.map((place) => (
            <Badge key={place} variant="neutral">
              {label("servicePlace", place)}
            </Badge>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 p-4">
        <Link
          to={`/barbers/${barber.id}#reserver`}
          className={buttonClasses("primary", "md", "flex-1 shadow-cta")}
        >
          {t("map.card.book")}
        </Link>
        <Link
          to={`/barbers/${barber.id}`}
          className={buttonClasses("secondary", "md", "flex-1")}
        >
          {t("map.card.viewProfile")}
        </Link>
      </div>
      <p className="border-t border-border/60 bg-surface-muted/40 px-4 py-2.5 text-xs text-foreground-muted">
        {t("labels:approximateLocation")}
      </p>
    </section>
  );
}
