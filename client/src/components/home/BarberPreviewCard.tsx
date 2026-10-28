import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import type { PublicBarberSearchItem } from "@findbarber/shared/types";
import { formatDistance } from "../../lib/geo";
import { label } from "../../lib/labels";
import { describeNextSlot } from "../../lib/nextSlot";
import { CertifiedBadge } from "../barber/CertifiedBadge";
import { Badge } from "../ui/Badge";
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
  /** Grande carte de la grille bento (desktop) : nom plus grand. */
  featured?: boolean;
}

// Carte « vitrine » (issue #54, gabarit du lot DS-3 : plan §2.6.4) : photo
// plein cadre en 4/5 voilée de nuit vers le bas, pastille de note en verre et
// disponibilité en haut, barre d'information en verre sombre en bas (modes
// d'accueil, nom, ville, prix « dès » et bouton « Réserver »).
// Le nom est un lien étendu à toute la carte ; la barre en verre utilise un
// empilement CSS Grid (`relative -z-[5]`, entre le fond `-z-10` et le texte en
// flux normal) sans bloc englobant relatif autour du lien pour ne jamais
// restreindre `after:inset-0` ni flouter le texte. Le bouton « Réserver » reste
// focalisable à part : il se replie en icône sur les appareils qui survolent et
// se déplie au survol ou au focus de la carte ; il reste déplié sur mobile.
export function BarberPreviewCard({
  barber,
  distanceKm,
  featured = false,
}: BarberPreviewCardProps) {
  const { t } = useTranslation("client");
  const profileUrl = `/barbers/${barber.id}`;

  const nextSlotLabel =
    !barber.availableToday && barber.nextAvailableAt
      ? (() => {
          const slot = describeNextSlot(barber.nextAvailableAt);
          return slot.day === "today"
            ? t("search.availability.todayAt", { time: slot.time })
            : slot.day === "tomorrow"
              ? t("search.availability.tomorrowAt", { time: slot.time })
              : t("search.availability.dayAt", {
                  day: slot.weekday,
                  time: slot.time,
                });
        })()
      : null;

  return (
    <article
      className={
        // 4/5 dans le carrousel ; dans la grille bento (`lg:`), la carte prend
        // la hauteur de sa case.
        "group relative isolate flex aspect-[4/5] w-full flex-col justify-between overflow-hidden rounded-3xl bg-night shadow-1 ring-1 ring-inset ring-white/10 lg:aspect-auto lg:h-full " +
        "transition-[transform,box-shadow] duration-base ease-out hover:shadow-3 hover:ring-white/25 motion-safe:hover:-translate-y-1.5 " +
        "has-[.fb-card-link:focus-visible]:ring-2 has-[.fb-card-link:focus-visible]:ring-ring has-[.fb-card-link:focus-visible]:ring-offset-2 has-[.fb-card-link:focus-visible]:ring-offset-background"
      }
    >
      <BarberPhoto
        barber={barber}
        tone="onNight"
        className="absolute inset-0 -z-10 h-full w-full text-6xl transition-transform duration-[600ms] ease-out motion-safe:group-hover:scale-[1.05]"
      />
      {/* Voile de nuit : lisibilité du texte clair posé sur la photo. */}
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-gradient-to-t from-night via-night/45 to-night/10"
      />

      <div className="flex items-start justify-between gap-2 p-3.5 sm:p-4">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="rounded-full border border-white/15 bg-night/75 px-3 py-1 backdrop-blur-md">
            <RatingSummary barber={barber} tone="onNight" />
          </span>
          {/* Lot N1 : badge « Libre aujourd'hui » (point qui pulse), ou prochain créneau. */}
          {barber.availableToday ? (
            // Fond opaque sous le badge : même contraste que sur une carte
            // (testé), quelle que soit la photo.
            <span className="rounded-full bg-surface shadow-1">
              <Badge variant="live">{t("search.availability.today")}</Badge>
            </span>
          ) : nextSlotLabel ? (
            <span className="rounded-full border border-white/15 bg-night/75 px-2.5 py-1 text-xs font-semibold text-night-muted backdrop-blur-md">
              {nextSlotLabel}
            </span>
          ) : null}
        </div>
        {barber.certified && <CertifiedBadge />}
      </div>

      {/* Socle d'information en verre sombre : `-z-[5]` place le flou au-dessus
          du fond (`-z-10`) mais strictement sous le texte en flux normal. */}
      <div className="grid p-3 sm:p-3.5">
        <div
          aria-hidden="true"
          className="relative -z-[5] rounded-2xl border border-white/18 bg-night/85 shadow-[inset_0_1px_0_rgb(255_255_255/0.16),0_16px_36px_-14px_rgb(0_0_0/0.6)] backdrop-blur-md transition-colors duration-base [grid-area:1/1] group-hover:border-white/30 group-hover:bg-night/90"
        />
        <div className="p-3.5 [grid-area:1/1] sm:p-4">
          {barber.places.length > 0 && (
            <p className="mb-1 flex flex-wrap items-center gap-1.5 text-xs font-semibold text-ring-on-night">
              {barber.places.map((place, index) => (
                <span key={place} className="inline-flex items-center gap-1.5">
                  {index > 0 && (
                    <span aria-hidden="true" className="text-night-muted">
                      ·
                    </span>
                  )}
                  {label("servicePlace", place)}
                </span>
              ))}
            </p>
          )}
          <h3
            className={
              featured
                ? "font-display text-xl font-bold leading-tight text-white lg:text-h2"
                : "font-display text-xl font-bold leading-tight text-white"
            }
          >
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
          <div className="mt-3 flex items-center justify-between gap-3 border-t border-white/10 pt-2.5">
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
      </div>
    </article>
  );
}
