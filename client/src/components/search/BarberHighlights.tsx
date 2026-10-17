import { useTranslation } from "react-i18next";
import type { PublicBarberSearchItem } from "@findbarber/shared/types";
import { resolveUploadUrl } from "../../lib/apiClient";
import { cn } from "../../lib/cn";
import { formatCurrency, formatRating } from "../../lib/formatters";
import { FadeMotif } from "../ui/FadeMotif";

// Éléments communs aux cartes de barber (résultat, fiche carte, accueil) :
// photo, note et prix « à partir de » issus de la recherche publique (#48).
// Aucune donnée inventée : sans photo → initiale sur le motif « dégradé », sans
// avis → « Nouveau sur FindBarber » (jamais « 0,0 »), sans service actif → pas
// de prix.
//
// `tone="onNight"` : texte clair, pour les cartes vitrine posées sur une photo
// voilée de nuit.

export type HighlightTone = "default" | "onNight";

type BarberLike = Pick<
  PublicBarberSearchItem,
  | "displayName"
  | "avatarPath"
  | "averageRating"
  | "reviewCount"
  | "startingPriceMinor"
  | "currency"
>;

/** Étoile de note (16 px, laiton). Décorative. */
export function StarIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="currentColor"
      className={cn("h-4 w-4 shrink-0 text-brass", className)}
    >
      <path d="M12 2.5l2.9 6.1 6.6.9-4.8 4.6 1.2 6.6L12 17.6l-5.9 3.1 1.2-6.6L2.5 9.5l6.6-.9z" />
    </svg>
  );
}

/**
 * Photo du barber ou visuel par défaut (initiale sur le motif « dégradé »).
 * `className` fixe la taille ; l'image est `lazy` et ses dimensions sont
 * réservées par l'appelant (pas de saut de mise en page).
 */
export function BarberPhoto({
  barber,
  className,
}: {
  barber: BarberLike;
  className?: string;
}) {
  const url = barber.avatarPath ? resolveUploadUrl(barber.avatarPath) : null;
  if (url) {
    return (
      <img
        src={url}
        alt=""
        loading="lazy"
        className={cn("shrink-0 bg-surface-muted object-cover", className)}
      />
    );
  }
  return (
    <div
      aria-hidden="true"
      // Empilement en grille (et non en `absolute`) : l'appelant reste libre de
      // positionner la photo (ex. `absolute inset-0` dans la carte vitrine).
      className={cn(
        "grid shrink-0 place-items-center overflow-hidden bg-accent-soft font-display font-bold text-accent-strong",
        className,
      )}
    >
      <FadeMotif className="h-1/2 w-full self-end text-accent/15 [grid-area:1/1]" />
      <span className="[grid-area:1/1]">
        {barber.displayName.charAt(0).toUpperCase()}
      </span>
    </div>
  );
}

/** Note moyenne + nombre d'avis, ou « Pas encore d'avis ». */
export function RatingSummary({
  barber,
  tone = "default",
  className,
}: {
  barber: BarberLike;
  tone?: HighlightTone;
  className?: string;
}) {
  const { t } = useTranslation("client");
  const muted = tone === "onNight" ? "text-night-muted" : "text-foreground-muted";
  if (barber.reviewCount === 0 || barber.averageRating === null) {
    return (
      <p className={cn("text-sm", muted, className)}>
        {t("search.highlights.noReviews")}
      </p>
    );
  }
  const rating = formatRating(barber.averageRating);
  return (
    <p
      className={cn(
        "flex items-center gap-1 text-sm",
        tone === "onNight" ? "text-white" : "text-foreground",
        className,
      )}
      aria-label={t("search.highlights.ratingAria", {
        rating,
        count: barber.reviewCount,
      })}
    >
      <StarIcon />
      <span className="font-semibold">{rating}</span>
      <span className={muted}>
        {t("search.highlights.reviewCount", { count: barber.reviewCount })}
      </span>
    </p>
  );
}

/** « À partir de 25.00 CHF », ou rien sans service actif. */
export function StartingPrice({
  barber,
  tone = "default",
  className,
}: {
  barber: BarberLike;
  tone?: HighlightTone;
  className?: string;
}) {
  const { t } = useTranslation("client");
  if (barber.startingPriceMinor === null) return null;
  return (
    <p
      className={cn(
        "text-sm tabular-nums",
        tone === "onNight" ? "text-white" : "text-foreground",
        className,
      )}
    >
      <span className={tone === "onNight" ? "text-night-muted" : "text-foreground-muted"}>
        {t("search.highlights.startingFrom")}{" "}
      </span>
      <span className="font-semibold">
        {formatCurrency(barber.startingPriceMinor, barber.currency)}
      </span>
    </p>
  );
}
