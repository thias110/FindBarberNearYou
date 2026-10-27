import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { LIMITS } from "@findbarber/shared/constants";
import { useAuth } from "../../app/auth-context";
import { useFavorites } from "../../app/favorites-context";
import { ApiError } from "../../lib/apiClient";
import { cn } from "../../lib/cn";
import { buttonClasses } from "../ui/buttonStyles";

const HEART =
  "M12 20.5s-7.5-4.6-7.5-10.3A4.2 4.2 0 0 1 12 7.6a4.2 4.2 0 0 1 7.5 2.6c0 5.7-7.5 10.3-7.5 10.3z";

function Heart({ filled }: { filled: boolean }) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinejoin="round"
    >
      <path d={HEART} />
    </svg>
  );
}

// Bouton cœur (lot N5, plan §2.6.4) : `secondary` de 44 px (variante `icon`).
// Un CLIENT ajoute ou retire le favori ; un visiteur est invité à se connecter ;
// les rôles BARBER et ADMIN ne voient rien. Les erreurs sont annoncées aux
// lecteurs d'écran et affichées en infobulle.
export function FavoriteButton({
  barberId,
  name,
  className,
}: {
  barberId: string;
  name: string;
  className?: string;
}) {
  const { t } = useTranslation("client");
  const { user } = useAuth();
  const { ids, pendingIds, toggle } = useFavorites();
  const [error, setError] = useState<string | null>(null);

  if (user && user.role !== "CLIENT") return null;

  const classes = buttonClasses("secondary", "icon", cn("rounded-full", className));

  if (!user) {
    return (
      <Link
        to="/login"
        aria-label={t("favorites.loginToAdd", { name })}
        title={t("favorites.loginToAdd", { name })}
        className={classes}
      >
        <Heart filled={false} />
      </Link>
    );
  }

  const isFavorite = ids.has(barberId);
  const label = t(isFavorite ? "favorites.remove" : "favorites.add", { name });

  const onClick = async () => {
    setError(null);
    try {
      await toggle(barberId);
    } catch (err) {
      setError(
        err instanceof ApiError && err.code === "FAVORITES_LIMIT_REACHED"
          ? t("favorites.limitReached", { count: LIMITS.favoritesMax })
          : t("favorites.error"),
      );
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={onClick}
        disabled={pendingIds.has(barberId)}
        aria-pressed={isFavorite}
        aria-label={label}
        title={error ?? label}
        className={cn(classes, isFavorite && "text-accent-strong")}
      >
        <Heart filled={isFavorite} />
      </button>
      {error && (
        <span role="alert" className="sr-only">
          {error}
        </span>
      )}
    </>
  );
}
