import { useTranslation } from "react-i18next";
import type { PublicBarberProfile } from "@findbarber/shared/types";
import { localizedCountryName } from "../../lib/countryName";
import { resolveUploadUrl } from "../../lib/apiClient";
import { formatRating } from "../../lib/formatters";
import { label } from "../../lib/labels";
import { FavoriteButton } from "../client/FavoriteButton";
import { StarIcon } from "../search/BarberHighlights";
import { Badge } from "../ui/Badge";
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
    <Card className="p-6">
      <div className="flex items-start gap-4">
        {profile.avatarPath ? (
          <img
            src={resolveUploadUrl(profile.avatarPath) ?? ""}
            alt={t("public.header.avatarAlt", { name: profile.displayName })}
            className="h-20 w-20 shrink-0 rounded-full object-cover"
          />
        ) : (
          <div
            aria-hidden="true"
            className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-accent-soft text-2xl font-semibold text-foreground"
          >
            {profile.displayName.charAt(0).toUpperCase()}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-foreground">
            {profile.displayName}
          </h1>
          {profile.certified && <CertifiedBadge className="mt-1" />}
          <p className="mt-1 text-sm text-foreground-muted">
            {profile.postalCode ? `${profile.postalCode}, ` : ""}
            {profile.city}, {countryName}
          </p>
          {hasRating && (
            // Bloc de note (plan §2.6.5) : 56 × 56 px, note en Bricolage 800.
            <div className="mt-3 flex items-center gap-3">
              <span className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-xl bg-brass-soft text-foreground">
                <span className="font-display text-2xl font-extrabold leading-none tabular-nums">
                  {formatRating(averageRating)}
                </span>
                <StarIcon className="mt-0.5 h-3.5 w-3.5" />
              </span>
              <span className="text-sm text-foreground-muted">
                {t("common.reviewCount", { count: totalReviews })}
              </span>
            </div>
          )}
        </div>
        <FavoriteButton barberId={profile.id} name={profile.displayName} />
      </div>

      <p className="mt-4 whitespace-pre-line text-foreground">
        {profile.description}
      </p>

      <div className="mt-3 flex flex-wrap gap-1">
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

      <p className="mt-2 text-xs text-foreground-muted">
        {t("labels:approximateLocation")}
      </p>
    </Card>
  );
}
