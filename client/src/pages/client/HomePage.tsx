import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useLocation, useNavigate } from "react-router-dom";
import type { PublicBarberSearchItem } from "@findbarber/shared/types";
import {
  DEFAULT_POPULAR_TECHNIQUES,
  type Technique,
} from "@findbarber/shared/constants";
import { useAuth } from "../../app/auth-context";
import i18n from "../../i18n";
import { barbersApi } from "../../lib/apiClient";
import { distanceKm } from "../../lib/geo";
import { useVisitorPosition } from "../../lib/visitorPosition";
import { Alert } from "../../components/ui/Alert";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { Skeleton } from "../../components/ui/Skeleton";
import { HomeHero } from "../../components/home/HomeHero";
import { CategoryChips } from "../../components/home/CategoryChips";
import { BarberPreviewCard } from "../../components/home/BarberPreviewCard";
import { buttonClasses } from "../../components/ui/buttonStyles";
import { PageContainer } from "../../components/ui/PageContainer";

// Carrousel « Barbers à découvrir » (issue #54).
const PREVIEW_LIMIT = 8;

const PRIMARY_LINK_CLASS = buttonClasses("primary");
const SECONDARY_LINK_CLASS = buttonClasses("secondary");

// Étapes « Comment ça marche » : textes dans `client:home.steps.<clé>`.
const STEPS = ["search", "compare", "book"] as const;

// Accueil : public pour les visiteurs (incitation à l'inscription), enrichi
// pour un CLIENT connecté (rendez-vous, déconnexion). Les BARBER et ADMIN sont
// redirigés vers leur espace par la route.
export function ClientHomePage() {
  const { t } = useTranslation("client");
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  // Arrivée après suppression du compte (issue #14).
  const accountDeleted = Boolean(
    (location.state as { accountDeleted?: boolean } | null)?.accountDeleted,
  );

  const [barbers, setBarbers] = useState<PublicBarberSearchItem[]>([]);
  // Distance affichée seulement si le visiteur a déjà partagé sa position
  // (aucune demande depuis l'accueil).
  const { position } = useVisitorPosition();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  // Liste par défaut affichée immédiatement, puis remplacée par le classement
  // du serveur (issue #47). En cas d'erreur, la liste par défaut reste.
  const [popularTechniques, setPopularTechniques] = useState<
    readonly Technique[]
  >(DEFAULT_POPULAR_TECHNIQUES);

  useEffect(() => {
    const controller = new AbortController();
    barbersApi
      .popularTechniques(controller.signal)
      .then((res) => {
        if (res.techniques.length > 0) setPopularTechniques(res.techniques);
      })
      .catch(() => {
        // Section secondaire : la liste par défaut suffit.
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    setLoading(true);
    setError(null);

    barbersApi
      .search({ page: 1, pageSize: PREVIEW_LIMIT }, controller.signal)
      .then((res) => {
        if (!cancelled) setBarbers(res.barbers);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        // Une annulation (démontage) n'est pas une erreur utilisateur.
        if (err instanceof DOMException && err.name === "AbortError") return;
        setError(
          err instanceof Error
            ? err.message
            : i18n.t("client:home.barbers.loadError"),
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [reloadToken]);

  // Recherche par ville : contrat d'URL de BarbersSearchPage (`city`).
  function handleSearch(city: string) {
    const trimmed = city.trim();
    navigate(
      trimmed ? `/barbers?city=${encodeURIComponent(trimmed)}` : "/barbers",
    );
  }

  async function handleLogout() {
    await logout();
    navigate("/login", { replace: true });
  }

  return (
    <div className="min-h-screen bg-background p-4 sm:p-8">
      <PageContainer width="wide" stack="lg">
        {accountDeleted && (
          <Alert variant="success">
            {t("home.accountDeleted")}
          </Alert>
        )}

        <HomeHero user={user} onSubmitCity={handleSearch} />

        <CategoryChips techniques={popularTechniques} />

        <section aria-labelledby="home-barbers-title">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2
                id="home-barbers-title"
                className="text-xl font-bold text-foreground"
              >
                {t("home.barbers.title")}
              </h2>
              <p className="mt-1 text-sm text-foreground-muted">
                {t("home.barbers.subtitle")}
              </p>
            </div>
            <Button
              variant="secondary"
              className="min-h-[44px]"
              onClick={() => navigate("/barbers")}
            >
              {t("home.barbers.viewAll")}
            </Button>
          </div>

          {loading ? (
            <div
              aria-busy="true"
              className="mt-4 flex gap-4 overflow-hidden"
            >
              <span className="sr-only" role="status">
                {t("home.barbers.loading")}
              </span>
              {[0, 1, 2].map((index) => (
                <Skeleton
                  key={index}
                  className="h-80 w-[78%] shrink-0 rounded-3xl sm:w-[calc(50%-0.5rem)] lg:w-[calc((100%-2rem)/3)]"
                />
              ))}
            </div>
          ) : error ? (
            <div
              role="alert"
              className="mt-4 rounded-2xl border border-danger/30 bg-danger/10 p-4 text-sm text-danger"
            >
              <p>{error}</p>
              <Button
                variant="secondary"
                className="mt-3 min-h-[44px]"
                onClick={() => setReloadToken((token) => token + 1)}
              >
                {t("home.barbers.retry")}
              </Button>
            </div>
          ) : barbers.length === 0 ? (
            <Card className="mt-4 p-6 text-center">
              <p className="text-foreground-muted">
                {t("home.barbers.empty")}
              </p>
              <Button
                className="mt-4 min-h-[44px]"
                onClick={() => navigate("/barbers")}
              >
                {t("home.barbers.search")}
              </Button>
            </Card>
          ) : (
            // Carrousel horizontal : glissement au doigt (accroche par carte),
            // et chaque carte est un lien atteignable au clavier (le focus fait
            // défiler la carte en vue).
            <ul
              aria-label={t("home.barbers.title")}
              className="-mx-4 mt-4 flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-px-4 px-4 pb-3 sm:-mx-8 sm:scroll-px-8 sm:px-8"
            >
              {barbers.map((barber) => (
                <li
                  key={barber.id}
                  className="w-[78%] shrink-0 snap-start sm:w-[calc(50%-0.5rem)] lg:w-[calc((100%-2rem)/3)]"
                >
                  <BarberPreviewCard
                    barber={barber}
                    popularRanking={popularTechniques}
                    distanceKm={position ? distanceKm(position, barber) : null}
                  />
                </li>
              ))}
            </ul>
          )}
        </section>

        {user ? (
          <section aria-labelledby="home-appointments-title">
            <Card className="flex flex-col gap-3 p-6 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2
                  id="home-appointments-title"
                  className="text-lg font-bold text-foreground"
                >
                  {t("home.appointments.title")}
                </h2>
                <p className="mt-1 text-sm text-foreground-muted">
                  {t("home.appointments.description")}
                </p>
              </div>
              <Button
                className="min-h-[44px] shrink-0"
                onClick={() => navigate("/appointments")}
              >
                {t("home.appointments.view")}
              </Button>
            </Card>
          </section>
        ) : (
          <section
            aria-labelledby="home-join-title"
            className="grid gap-4 sm:grid-cols-2"
          >
            <h2 id="home-join-title" className="sr-only">
              {t("home.join.title")}
            </h2>
            <Card className="flex flex-col gap-3 p-6">
              <p className="text-lg font-semibold text-foreground">
                {t("home.join.clientTitle")}
              </p>
              <p className="text-sm text-foreground-muted">
                {t("home.join.clientDescription")}
              </p>
              <div className="mt-auto flex flex-wrap gap-2">
                <Link to="/register" className={PRIMARY_LINK_CLASS}>
                  {t("home.join.register")}
                </Link>
                <Link to="/login" className={SECONDARY_LINK_CLASS}>
                  {t("home.join.login")}
                </Link>
              </div>
            </Card>
            <Card className="flex flex-col gap-3 p-6">
              <p className="text-lg font-semibold text-foreground">
                {t("home.join.barberTitle")}
              </p>
              <p className="text-sm text-foreground-muted">
                {t("home.join.barberDescription")}
              </p>
              <div className="mt-auto">
                <Link
                  to="/register?role=BARBER"
                  className={SECONDARY_LINK_CLASS}
                >
                  {t("home.join.barberCta")}
                </Link>
              </div>
            </Card>
          </section>
        )}

        <section aria-labelledby="home-steps-title">
          <h2
            id="home-steps-title"
            className="text-xl font-bold text-foreground"
          >
            {t("home.steps.title")}
          </h2>
          <ol className="mt-4 grid gap-4 sm:grid-cols-3">
            {STEPS.map((step) => (
              <li key={step}>
                <Card className="h-full p-5">
                  <p className="text-sm font-semibold text-foreground">
                    {t(`home.steps.${step}.title`)}
                  </p>
                  <p className="mt-2 text-sm text-foreground-muted">
                    {t(`home.steps.${step}.description`)}
                  </p>
                </Card>
              </li>
            ))}
          </ol>
        </section>

        {user && (
          <div className="flex justify-center pb-4">
            <Button
              variant="ghost"
              className="min-h-[44px]"
              onClick={() => void handleLogout()}
            >
              {t("home.logout")}
            </Button>
          </div>
        )}
      </PageContainer>
    </div>
  );
}
