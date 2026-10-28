import { useTranslation } from "react-i18next";
import type { PublicBarberProfile } from "@findbarber/shared/types";
import { localizedCountryName } from "../../lib/countryName";
import { resolveUploadUrl } from "../../lib/apiClient";
import { formatRating } from "../../lib/formatters";
import { label } from "../../lib/labels";
import { FavoriteButton } from "../client/FavoriteButton";
import { StarIcon } from "../search/BarberHighlights";
import { Badge } from "../ui/Badge";
import { FadeMotif } from "../ui/FadeMotif";
import { CertifiedBadge } from "./CertifiedBadge";
import { Card } from "../ui/Card";

interface BarberProfileHeaderProps {
  profile: PublicBarberProfile;
  averageRating: number | null;
  totalReviews: number;
}

export function BarberProfileHeader({
  profile,
  averageRating,
  totalReviews,
}: BarberProfileHeaderProps) {
  const { t } = useTranslation("barber");
  const countryName = localizedCountryName(profile.countryCode);
  // Note affichée uniquement s'il existe au moins un avis (jamais inventée).
  const hasRating = totalReviews > 0 && averageRating !== null;

  return (
    <Card className="overflow-hidden p-0 shadow-card">
      {/* Bandeau studio « Nuit / Dégradé » purement décoratif */}
      <div
        aria-hidden="true"
        className="relative flex h-28 flex-col justify-end overflow-hidden bg-night sm:h-36"
      >
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(65%_110%_at_85%_0%,rgb(var(--fb-cobalt)/0.38),transparent_70%),radial-gradient(45%_95%_at_10%_100%,rgb(var(--fb-brass)/0.22),transparent_70%)]" />
        <FadeMotif className="relative h-8 w-full text-cobalt/25" />
      </div>

      <div className="px-5 pb-6 sm:px-8 sm:pb-8">
        <div className="-mt-12 flex items-end justify-between gap-4 sm:-mt-14">
          {profile.avatarPath ? (
            <img
              src={resolveUploadUrl(profile.avatarPath) ?? ""}
              alt={t("public.header.avatarAlt", { name: profile.displayName })}
              className="relative z-10 h-24 w-24 shrink-0 rounded-2xl border-4 border-surface bg-surface object-cover shadow-2 sm:h-28 sm:w-28"
            />
          ) : (
            <div
              aria-hidden="true"
              className="relative z-10 grid h-24 w-24 shrink-0 place-items-center overflow-hidden rounded-2xl border-4 border-surface bg-accent-soft font-display text-3xl font-extrabold text-accent-strong shadow-2 sm:h-28 sm:w-28 sm:text-4xl"
            >
              <FadeMotif className="h-1/2 w-full self-end text-accent/15 [grid-area:1/1]" />
              <span className="[grid-area:1/1]">
                {profile.displayName.charAt(0).toUpperCase()}
              </span>
            </div>
          )}

          <div className="pt-14 sm:pt-16">
            <FavoriteButton barberId={profile.id} name={profile.displayName} />
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl">
                {profile.displayName}
              </h1>
              {profile.certified && <CertifiedBadge />}
            </div>

            <p className="mt-1.5 flex flex-wrap items-center gap-1.5 text-sm text-foreground-muted">
              <svg
                aria-hidden="true"
                viewBox="0 0 16 16"
                className="h-4 w-4 shrink-0 text-accent-strong"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M8 14s4.5-4.2 4.5-7.5a4.5 4.5 0 1 0-9 0C3.5 9.8 8 14 8 14Z" />
                <circle cx="8" cy="6.5" r="1.5" />
              </svg>
              <span>
                {profile.postalCode ? `${profile.postalCode}, ` : ""}
                {profile.city}, {countryName}
              </span>
              <span aria-hidden="true">·</span>
              <span className="text-xs">{t("labels:approximateLocation")}</span>
            </p>
          </div>

          {hasRating && (
            // Bloc de note (plan §2.6.5) : 56 × 56 px, note en Bricolage 800.
            <div className="flex items-center gap-3 self-start rounded-2xl border border-border bg-surface-muted/60 p-2 pr-4">
              <span className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-xl border border-brass/35 bg-brass-soft text-foreground shadow-1">
                <span className="font-display text-2xl font-extrabold leading-none tabular-nums">
                  {formatRating(averageRating)}
                </span>
                <StarIcon className="mt-0.5 h-3.5 w-3.5" />
              </span>
              <span className="text-sm font-medium text-foreground-muted">
                {t("common.reviewCount", { count: totalReviews })}
              </span>
            </div>
          )}
        </div>

        {profile.description && (
          <p className="mt-4 max-w-[70ch] whitespace-pre-line leading-relaxed text-foreground">
            {profile.description}
          </p>
        )}

        <div className="mt-4 flex flex-wrap gap-1.5 border-t border-border/70 pt-4">
          {profile.places.length === 0 ? (
            <Badge variant="neutral">{t("public.header.noPlaces")}</Badge>
          ) : (
            profile.places.map((place) => (
              <Badge key={place} variant="neutral">
                {label("servicePlace", place)}
              </Badge>
            ))
          )}
        </div>
      </div>
    </Card>
  );
}
