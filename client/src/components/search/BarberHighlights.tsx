import { useTranslation } from "react-i18next";
import type { PublicBarberSearchItem } from "@findbarber/shared/types";
import { resolveUploadUrl } from "../../lib/apiClient";
import { cn } from "../../lib/cn";
import { formatCurrency, formatRating } from "../../lib/formatters";
import { describeNextSlot } from "../../lib/nextSlot";

// Éléments communs aux cartes de barber (résultat, fiche carte, accueil) :
// photo, note et prix « à partir de » issus de la recherche publique (#48).
// Aucune donnée inventée : sans photo → monogramme studio, sans avis →
// « Nouveau sur FindBarber » (jamais « 0,0 »), sans service actif → pas de prix.
//
// `tone="onNight"` : texte clair et repli photo studio sombre, pour les cartes
// vitrine posées sur un fond de nuit.

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
 * Photo du barber ou visuel par défaut (monogramme).
 * `className` fixe la taille ; l'image est `lazy` et ses dimensions sont
 * réservées par l'appelant (pas de saut de mise en page).
 * En `tone="onNight"`, le repli sans photo adopte une toile nuit éclairée au
 * cobalt et au laiton, cohérente avec les cartes vitrine de l'accueil.
 */
export function BarberPhoto({
  barber,
  tone = "default",
  className,
}: {
  barber: BarberLike;
  tone?: HighlightTone;
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
  const initial = barber.displayName.charAt(0).toUpperCase();
  if (tone === "onNight") {
    return (
      <div
        aria-hidden="true"
        className={cn(
          "shrink-0 overflow-hidden bg-night-2 font-display font-bold text-white",
          "bg-[radial-gradient(90%_75%_at_80%_16%,rgb(var(--fb-cobalt)/0.44),transparent_68%),radial-gradient(75%_65%_at_16%_80%,rgb(var(--fb-brass)/0.26),transparent_70%)]",
          className,
        )}
      >
        <div className="relative grid h-full w-full place-items-center">
          {/* Halo géométrique d'atelier en arrière-plan */}
          <div className="pointer-events-none h-44 w-44 rounded-full border border-white/10 bg-white/[0.02]" />
          {/* Médaillon biseauté d'atelier au centre supérieur */}
          <div className="absolute inset-0 flex flex-col items-center justify-center pb-24">
            <div className="relative flex h-24 w-24 items-center justify-center rounded-3xl border border-white/20 bg-night/55 shadow-[0_20px_40px_-16px_rgb(0_0_0/0.7),inset_0_1px_0_rgb(255_255_255/0.22)] backdrop-blur-md">
              <span className="text-4xl font-extrabold tracking-tight text-white">
                {initial}
              </span>
              <span className="absolute -bottom-2 -right-2 flex h-7 w-7 items-center justify-center rounded-full border border-brass/50 bg-night text-brass shadow-1">
                <svg
                  viewBox="0 0 20 20"
                  className="h-3.5 w-3.5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.8}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="6" cy="6" r="2.2" />
                  <circle cx="6" cy="14" r="2.2" />
                  <path d="M7.9 7.3L16 14.8M7.9 12.7L16 5.2" />
                </svg>
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  }
  return (
    <div
      aria-hidden="true"
      className={cn(
        "grid shrink-0 place-items-center overflow-hidden bg-night-2 font-display font-extrabold text-white",
        "bg-[radial-gradient(85%_85%_at_80%_15%,rgb(var(--fb-cobalt)/0.42),transparent_70%),radial-gradient(75%_75%_at_15%_85%,rgb(var(--fb-brass)/0.24),transparent_72%)]",
        className,
      )}
    >
      <span className="drop-shadow-sm">{initial}</span>
    </div>
  );
}

/** Note moyenne + nombre d'avis, ou « Nouveau sur FindBarber ». */
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
      <span
        className={cn(
          "font-semibold",
          tone === "onNight" && "font-display text-base font-bold text-white",
        )}
      >
        {formatCurrency(barber.startingPriceMinor, barber.currency)}
      </span>
    </p>
  );
}

/**
 * Prochain créneau libre (lot N1) : « Prochain créneau : aujourd'hui à 14:30 ».
 * Indicatif (calcul serveur mis en cache 60 s) : la réservation recalcule
 * toujours le créneau. Sans créneau dans les 7 jours, mention explicite.
 */
export function NextSlot({
  barber,
  className,
}: {
  barber: Pick<PublicBarberSearchItem, "nextAvailableAt">;
  className?: string;
}) {
  const { t } = useTranslation("client");
  if (!barber.nextAvailableAt) {
    return (
      <p className={cn("text-sm text-foreground-muted", className)}>
        {t("search.availability.none")}
      </p>
    );
  }
  const slot = describeNextSlot(barber.nextAvailableAt);
  const when =
    slot.day === "today"
      ? t("search.availability.todayAt", { time: slot.time })
      : slot.day === "tomorrow"
        ? t("search.availability.tomorrowAt", { time: slot.time })
        : t("search.availability.dayAt", { day: slot.weekday, time: slot.time });
  return (
    <p className={cn("text-sm font-semibold text-accent-strong", className)}>
      {t("search.availability.next", { when })}
    </p>
  );
}
