import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import {
  APPROXIMATE_LOCATION_LABEL,
  SERVICE_PLACE_LABELS,
} from "@findbarber/shared/constants";
import type { PublicBarberSearchItem } from "@findbarber/shared/types";
import { formatDistance } from "../lib/geo";
import { CertifiedBadge } from "./barber/CertifiedBadge";
import { Badge } from "./ui/Badge";
import { buttonClasses } from "./ui/buttonStyles";
import {
  BarberPhoto,
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
      aria-label={`Fiche de ${barber.displayName}`}
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
      className="pointer-events-auto absolute inset-x-3 bottom-24 z-10 mx-auto max-w-md overflow-hidden rounded-3xl border border-border bg-surface shadow-card lg:inset-x-auto lg:bottom-10 lg:right-6 lg:w-96"
    >
      <div aria-hidden="true" className="flex justify-center pt-2 sm:hidden">
        <span className="h-1.5 w-10 rounded-full bg-border-strong" />
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label="Fermer la fiche du barbier"
        className="absolute right-2 top-2 z-10 flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full bg-surface/90 text-xl leading-none text-foreground-muted transition-colors hover:bg-surface-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        <span aria-hidden="true">×</span>
      </button>

      <div className="flex gap-4 p-4 pr-12">
        <BarberPhoto barber={barber} className="h-24 w-24 rounded-2xl text-3xl" />
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
        </div>
      </div>

      {(barber.certified || barber.places.length > 0) && (
        <div className="flex flex-wrap gap-1 px-4">
          {barber.certified && <CertifiedBadge />}
          {barber.places.map((place) => (
            <Badge key={place} variant="neutral">
              {SERVICE_PLACE_LABELS[place]}
            </Badge>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 p-4">
        <Link
          to={`/barbers/${barber.id}#reserver`}
          className={buttonClasses("primary", "md", "flex-1")}
        >
          Réserver
        </Link>
        <Link
          to={`/barbers/${barber.id}`}
          className={buttonClasses("secondary", "md", "flex-1")}
        >
          Voir le profil
        </Link>
      </div>
      <p className="px-4 pb-3 text-xs text-foreground-muted">
        {APPROXIMATE_LOCATION_LABEL}
      </p>
    </section>
  );
}
