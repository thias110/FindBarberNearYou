import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import type { PublicBarberSearchItem } from "@findbarber/shared/types";
import { formatDistance } from "../../lib/geo";
import { CertifiedBadge } from "../barber/CertifiedBadge";
import { buttonClasses } from "../ui/buttonStyles";
import {
  BarberPhoto,
  RatingSummary,
  StartingPrice,
} from "../search/BarberHighlights";

interface BarberPreviewCardProps {
  barber: PublicBarberSearchItem;
  /** Distance depuis la position partagée du visiteur, sinon null. */
  distanceKm: number | null;
}

// Carte « vitrine » (issue #54, gabarit du lot DS-3 : plan §2.6.4) : photo
// plein cadre en 4/5 voilée de nuit vers le bas, note et badge en haut, nom,
// lieu et prix en bas. Le nom est un lien étendu à toute la carte ; le bouton
// « Réserver » reste focalisable à part. Il se replie en icône sur les
// appareils qui survolent et se déplie au survol ou au focus de la carte ; il
// reste déplié sur mobile. Données de la recherche publique uniquement.
export function BarberPreviewCard({ barber, distanceKm }: BarberPreviewCardProps) {
  const { t } = useTranslation("client");
  const profileUrl = `/barbers/${barber.id}`;

  return (
    <article
      className={
        "group relative isolate flex aspect-[4/5] w-full flex-col justify-between overflow-hidden rounded-3xl bg-night shadow-1 " +
        "transition-[transform,box-shadow] duration-base ease-out hover:shadow-2 motion-safe:hover:-translate-y-1 " +
        "has-[.fb-card-link:focus-visible]:ring-2 has-[.fb-card-link:focus-visible]:ring-ring has-[.fb-card-link:focus-visible]:ring-offset-2 has-[.fb-card-link:focus-visible]:ring-offset-background"
      }
    >
      <BarberPhoto
        barber={barber}
        className="absolute inset-0 -z-10 h-full w-full text-6xl transition-transform duration-[600ms] ease-out motion-safe:group-hover:scale-[1.04]"
      />
      {/* Voile de nuit : lisibilité du texte clair posé sur la photo. */}
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-gradient-to-t from-night/95 via-night/40 to-transparent"
      />

      <div className="flex items-start justify-between gap-2 p-3">
        <span className="rounded-full bg-night/70 px-2.5 py-1 backdrop-blur-sm">
          <RatingSummary barber={barber} tone="onNight" />
        </span>
        {barber.certified && <CertifiedBadge />}
      </div>

      <div className="p-4">
        <h3 className="text-xl font-bold leading-tight text-white">
          {/* Lien étendu : toute la carte mène au profil. */}
          <Link
            to={profileUrl}
            className="fb-card-link rounded-sm outline-none after:absolute after:inset-0 after:content-['']"
          >
            {barber.displayName}
          </Link>
        </h3>
        <p className="mt-0.5 text-sm text-night-muted">
          {barber.city}
          {distanceKm !== null && ` · ${formatDistance(distanceKm)}`}
        </p>
        <div className="mt-3 flex items-end justify-between gap-3">
          <StartingPrice barber={barber} tone="onNight" />
          <Link
            to={`${profileUrl}#reserver`}
            className={buttonClasses(
              "inverse",
              "sm",
              "relative z-10 ml-auto gap-0 px-3 [@media(hover:hover)]:group-hover:gap-1.5 [@media(hover:hover)]:group-focus-within:gap-1.5",
            )}
          >
            <span
              className={
                "overflow-hidden whitespace-nowrap transition-[max-width,opacity] duration-base ease-out " +
                "[@media(hover:hover)]:max-w-0 [@media(hover:hover)]:opacity-0 " +
                "[@media(hover:hover)]:group-hover:max-w-[8rem] [@media(hover:hover)]:group-hover:opacity-100 " +
                "[@media(hover:hover)]:group-focus-within:max-w-[8rem] [@media(hover:hover)]:group-focus-within:opacity-100"
              }
            >
              {t("home.preview.book")}
            </span>
            <svg
              aria-hidden="true"
              viewBox="0 0 20 20"
              className="h-4 w-4 shrink-0"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M4 10h11M11 5.5L15.5 10 11 14.5" />
            </svg>
          </Link>
        </div>
      </div>
    </article>
  );
}
