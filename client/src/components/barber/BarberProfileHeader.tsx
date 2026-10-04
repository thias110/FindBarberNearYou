import { COUNTRY_NAME_BY_CODE } from "@findbarber/shared/countries";
import {
  APPROXIMATE_LOCATION_LABEL,
  SERVICE_PLACE_LABELS,
} from "@findbarber/shared/constants";
import type { PublicBarberProfile } from "@findbarber/shared/types";
import { resolveUploadUrl } from "../../lib/apiClient";
import { Badge } from "../ui/Badge";
import { Card } from "../ui/Card";

function StarIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="currentColor"
      className="h-4 w-4 text-gold"
    >
      <path d="M12 2.5l2.9 6.1 6.6.9-4.8 4.6 1.2 6.6L12 17.6l-5.9 3.1 1.2-6.6L2.5 9.5l6.6-.9z" />
    </svg>
  );
}

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
  const countryName =
    COUNTRY_NAME_BY_CODE[profile.countryCode] ?? profile.countryCode;
  // Note affichée uniquement s'il existe au moins un avis (jamais inventée).
  const hasRating = totalReviews > 0 && averageRating !== null;

  return (
    <Card className="p-6">
      <div className="flex items-start gap-4">
        {profile.avatarPath ? (
          <img
            src={resolveUploadUrl(profile.avatarPath) ?? ""}
            alt={`Avatar de ${profile.displayName}`}
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
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold text-foreground">
            {profile.displayName}
          </h1>
          <p className="mt-1 text-sm text-foreground-muted">
            {profile.postalCode ? `${profile.postalCode}, ` : ""}
            {profile.city}, {countryName}
          </p>
          {hasRating && (
            <p className="mt-1 flex items-center gap-1 text-sm text-foreground">
              <StarIcon />
              <span className="font-medium">{averageRating.toFixed(1)}</span>
              <span className="text-foreground-muted">
                ({totalReviews} avis)
              </span>
            </p>
          )}
        </div>
      </div>

      <p className="mt-4 whitespace-pre-line text-foreground">
        {profile.description}
      </p>

      <div className="mt-3 flex flex-wrap gap-1">
        {profile.places.length === 0 ? (
          <Badge variant="neutral">Lieux non renseignés</Badge>
        ) : (
          profile.places.map((place) => (
            <Badge key={place} variant="neutral">
              {SERVICE_PLACE_LABELS[place]}
            </Badge>
          ))
        )}
      </div>

      <p className="mt-2 text-xs text-foreground-muted">
        {APPROXIMATE_LOCATION_LABEL}
      </p>
    </Card>
  );
}
