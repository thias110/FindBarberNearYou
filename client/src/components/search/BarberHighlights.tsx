import { useTranslation } from "react-i18next";
import type { PublicBarberSearchItem } from "@findbarber/shared/types";
import { resolveUploadUrl } from "../../lib/apiClient";
import { cn } from "../../lib/cn";
import { formatCurrency, formatRating } from "../../lib/formatters";

// Éléments communs aux cartes de barber (résultat, fiche carte, accueil) :
// photo, note et prix « à partir de » issus de la recherche publique (#48).
// Aucune donnée inventée : sans photo → initiale, sans avis → « Pas encore
// d'avis », sans service actif → pas de prix.

type BarberLike = Pick<
  PublicBarberSearchItem,
  | "displayName"
  | "avatarPath"
  | "averageRating"
  | "reviewCount"
  | "startingPriceMinor"
  | "currency"
>;

function StarIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="currentColor"
      className="h-4 w-4 shrink-0 text-gold"
    >
      <path d="M12 2.5l2.9 6.1 6.6.9-4.8 4.6 1.2 6.6L12 17.6l-5.9 3.1 1.2-6.6L2.5 9.5l6.6-.9z" />
    </svg>
  );
}

/** Photo du barber ou visuel par défaut (initiale). `className` fixe la taille. */
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
      className={cn(
        "flex shrink-0 items-center justify-center bg-accent-soft font-semibold text-foreground",
        className,
      )}
    >
      {barber.displayName.charAt(0).toUpperCase()}
    </div>
  );
}

/** Note moyenne + nombre d'avis, ou « Pas encore d'avis ». */
export function RatingSummary({
  barber,
  className,
}: {
  barber: BarberLike;
  className?: string;
}) {
  const { t } = useTranslation("client");
  if (barber.reviewCount === 0 || barber.averageRating === null) {
    return (
      <p className={cn("text-sm text-foreground-muted", className)}>
        {t("search.highlights.noReviews")}
      </p>
    );
  }
  const rating = formatRating(barber.averageRating);
  return (
    <p
      className={cn("flex items-center gap-1 text-sm text-foreground", className)}
      aria-label={t("search.highlights.ratingAria", {
        rating,
        count: barber.reviewCount,
      })}
    >
      <StarIcon />
      <span className="font-semibold">{rating}</span>
      <span className="text-foreground-muted">
        {t("search.highlights.reviewCount", { count: barber.reviewCount })}
      </span>
    </p>
  );
}

/** « À partir de 25.00 CHF », ou rien sans service actif. */
export function StartingPrice({
  barber,
  className,
}: {
  barber: BarberLike;
  className?: string;
}) {
  const { t } = useTranslation("client");
  if (barber.startingPriceMinor === null) return null;
  return (
    <p className={cn("text-sm text-foreground", className)}>
      <span className="text-foreground-muted">
        {t("search.highlights.startingFrom")}{" "}
      </span>
      <span className="font-semibold">
        {formatCurrency(barber.startingPriceMinor, barber.currency)}
      </span>
    </p>
  );
}
