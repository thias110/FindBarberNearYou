import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import type { PublicBarberSearchItem } from "@findbarber/shared/types";
import { useFavorites } from "../../app/favorites-context";
import { userApi } from "../../lib/apiClient";
import { BarberCompactCard } from "../../components/search/BarberCompactCard";
import { FavoriteButton } from "../../components/client/FavoriteButton";
import { buttonClasses } from "../../components/ui/buttonStyles";
import { EmptyState } from "../../components/ui/EmptyState";
import { ErrorState } from "../../components/ui/ErrorState";
import { PageContainer } from "../../components/ui/PageContainer";
import { Skeleton } from "../../components/ui/Skeleton";

// Favoris du client (lot N5) : retrouver son barber et réserver de nouveau en
// deux clics (carte compacte → profil). Un barber retiré ici disparaît de la
// liste tout de suite ; il ne réapparaît qu'au prochain ajout.
export function FavoritesPage() {
  const { t } = useTranslation("client");
  const { ids } = useFavorites();
  const [barbers, setBarbers] = useState<PublicBarberSearchItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setFailed(false);
    userApi
      .listFavorites()
      .then((res) => setBarbers(res.barbers))
      .catch(() => setFailed(true))
      .finally(() => setLoading(false));
  }, []);

  useEffect(load, [load]);

  const shown = barbers.filter((barber) => ids.has(barber.id));

  return (
    <div className="min-h-screen bg-background p-4 sm:p-8">
      <PageContainer width="reading">
        <div>
          <h1 className="text-h2 font-extrabold text-foreground">
            {t("favorites.title")}
          </h1>
          <p className="mt-1 text-foreground-muted">{t("favorites.intro")}</p>
        </div>

        {loading ? (
          <div
            aria-busy="true"
            aria-label={t("favorites.loading")}
            className="space-y-3"
          >
            {[0, 1, 2].map((key) => (
              <Skeleton key={key} className="h-[4.75rem] rounded-xl" />
            ))}
          </div>
        ) : failed ? (
          <ErrorState
            title={t("favorites.loadError")}
            onRetry={load}
          />
        ) : shown.length === 0 ? (
          <EmptyState
            title={t("favorites.emptyTitle")}
            description={t("favorites.emptyDescription")}
            action={
              <Link to="/barbers" className={buttonClasses("primary", "md")}>
                {t("favorites.emptyAction")}
              </Link>
            }
          />
        ) : (
          <ul className="space-y-3">
            {shown.map((barber) => (
              <li key={barber.id}>
                <BarberCompactCard
                  barber={barber}
                  action={
                    <FavoriteButton
                      barberId={barber.id}
                      name={barber.displayName}
                    />
                  }
                />
              </li>
            ))}
          </ul>
        )}
      </PageContainer>
    </div>
  );
}
