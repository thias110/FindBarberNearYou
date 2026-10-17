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
import { EmptyState } from "../../components/ui/EmptyState";
import { ErrorState } from "../../components/ui/ErrorState";
import { Skeleton } from "../../components/ui/Skeleton";
import { HomeHero, type HeroPlace } from "../../components/home/HomeHero";
import { CategoryChips } from "../../components/home/CategoryChips";
import { BarberPreviewCard } from "../../components/home/BarberPreviewCard";
import { buttonClasses } from "../../components/ui/buttonStyles";
import { PageContainer } from "../../components/ui/PageContainer";

// « Barbers à découvrir » (issue #54) : carrousel sur mobile ; à partir de
// `lg:`, grille bento (une grande carte + quatre) s'il y a au moins cinq
// barbers, sinon une rangée de cartes égales. Au-delà de cinq, les suivantes
// restent dans le carrousel mobile.
const PREVIEW_LIMIT = 8;
const BENTO_SIZE = 5;

const PRIMARY_LINK_CLASS = buttonClasses("primary");
const SECONDARY_LINK_CLASS = buttonClasses("secondary");
const INVERSE_LINK_CLASS = buttonClasses("inverse");

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

  // Recherche par ville et lieu : contrat d'URL de BarbersSearchPage
  // (`city`, `place`).
  function handleSearch(city: string, place: HeroPlace) {
    const params = new URLSearchParams();
    const trimmed = city.trim();
    if (trimmed) params.set("city", trimmed);
    if (place) params.set("place", place);
    const query = params.toString();
    navigate(query ? `/barbers?${query}` : "/barbers");
  }

  async function handleLogout() {
    await logout();
    navigate("/login", { replace: true });
  }

  const bento = barbers.length >= BENTO_SIZE;

  const hero = (
    <HomeHero user={user} onSearch={handleSearch} fullBleed={!user} />
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Visiteur : hero de nuit pleine largeur sous la barre flottante. */}
      {!user && hero}
      <div className="p-4 sm:p-8">
        <PageContainer width="wide" stack="none" className="space-y-section">
          {accountDeleted && (
            <Alert variant="success">{t("home.accountDeleted")}</Alert>
          )}

          {user && hero}

          <div className="space-y-12">
            <CategoryChips techniques={popularTechniques} />

            <section aria-labelledby="home-barbers-title">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h2
                    id="home-barbers-title"
                    className="font-display text-h2 font-bold text-foreground"
                  >
                    {t("home.barbers.title")}
                  </h2>
                  <p className="mt-1 text-sm text-foreground-muted">
                    {t("home.barbers.subtitle")}
                  </p>
                </div>
                <Link to="/barbers" className={SECONDARY_LINK_CLASS}>
                  {t("home.barbers.viewAll")}
                </Link>
              </div>

              {loading ? (
                <div
                  aria-busy="true"
                  className="mt-6 flex gap-4 overflow-hidden lg:grid lg:auto-rows-[18.75rem] lg:grid-cols-4"
                >
                  <span className="sr-only" role="status">
                    {t("home.barbers.loading")}
                  </span>
                  {[0, 1, 2, 3, 4].map((index) => (
                    <Skeleton
                      key={index}
                      className={
                        index === 0
                          ? "aspect-[4/5] w-[78%] shrink-0 rounded-3xl sm:w-[calc(50%-0.5rem)] lg:col-span-2 lg:row-span-2 lg:aspect-auto lg:w-auto"
                          : "aspect-[4/5] w-[78%] shrink-0 rounded-3xl sm:w-[calc(50%-0.5rem)] max-lg:[&:nth-child(n+4)]:hidden lg:aspect-auto lg:w-auto"
                      }
                    />
                  ))}
                </div>
              ) : error ? (
                <ErrorState
                  className="mt-6"
                  title={error}
                  onRetry={() => setReloadToken((token) => token + 1)}
                  retryLabel={t("home.barbers.retry")}
                />
              ) : barbers.length === 0 ? (
                <EmptyState
                  className="mt-6"
                  title={t("home.barbers.empty")}
                  action={
                    <Link to="/barbers" className={PRIMARY_LINK_CLASS}>
                      {t("home.barbers.search")}
                    </Link>
                  }
                />
              ) : (
                // Mobile : carrousel horizontal (glissement au doigt, accroche
                // par carte ; le focus fait défiler la carte en vue).
                // Desktop : grille bento, la première carte en grand.
                <ul
                  aria-label={t("home.barbers.title")}
                  className={
                    "-mx-4 mt-6 flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-px-4 px-4 pb-3 sm:-mx-8 sm:scroll-px-8 sm:px-8 " +
                    "lg:mx-0 lg:grid lg:overflow-visible lg:p-0 " +
                    (bento
                      ? "lg:auto-rows-[18.75rem] lg:grid-cols-4"
                      : "lg:auto-rows-[26rem] lg:grid-cols-3")
                  }
                >
                  {barbers.map((barber, index) => (
                    <li
                      key={barber.id}
                      className={
                        "w-[78%] shrink-0 snap-start sm:w-[calc(50%-0.5rem)] lg:w-auto " +
                        (bento && index === 0 ? "lg:col-span-2 lg:row-span-2 " : "") +
                        (index >= (bento ? BENTO_SIZE : 3) ? "lg:hidden" : "")
                      }
                    >
                      <BarberPreviewCard
                        barber={barber}
                        featured={bento && index === 0}
                        distanceKm={position ? distanceKm(position, barber) : null}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          {user ? (
            <section aria-labelledby="home-appointments-title">
              <Card className="flex flex-col gap-3 p-6 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2
                    id="home-appointments-title"
                    className="text-h3 font-bold text-foreground"
                  >
                    {t("home.appointments.title")}
                  </h2>
                  <p className="mt-1 text-sm text-foreground-muted">
                    {t("home.appointments.description")}
                  </p>
                </div>
                <Link to="/appointments" className={buttonClasses("primary", "md", "shrink-0")}>
                  {t("home.appointments.view")}
                </Link>
              </Card>
            </section>
          ) : (
            <section
              aria-labelledby="home-join-title"
              className="grid gap-4 md:grid-cols-2"
            >
              <h2 id="home-join-title" className="sr-only">
                {t("home.join.title")}
              </h2>
              <Card className="flex flex-col gap-3 p-8">
                <p className="font-display text-h3 font-bold text-foreground">
                  {t("home.join.clientTitle")}
                </p>
                <p className="text-sm text-foreground-muted">
                  {t("home.join.clientDescription")}
                </p>
                <div className="mt-auto flex flex-wrap gap-2 pt-3">
                  <Link to="/register" className={PRIMARY_LINK_CLASS}>
                    {t("home.join.register")}
                  </Link>
                  <Link to="/login" className={SECONDARY_LINK_CLASS}>
                    {t("home.join.login")}
                  </Link>
                </div>
              </Card>
              {/* Pour les pros : panneau nuit, en écho au hero. */}
              <div className="flex flex-col gap-3 rounded-2xl bg-night p-8 text-white shadow-1">
                <p className="font-display text-h3 font-bold">
                  {t("home.join.barberTitle")}
                </p>
                <p className="text-sm text-night-muted">
                  {t("home.join.barberDescription")}
                </p>
                <div className="mt-auto pt-3">
                  <Link to="/register?role=BARBER" className={INVERSE_LINK_CLASS}>
                    {t("home.join.barberCta")}
                  </Link>
                </div>
              </div>
            </section>
          )}

          <section aria-labelledby="home-steps-title">
            <h2
              id="home-steps-title"
              className="font-display text-h2 font-bold text-foreground"
            >
              {t("home.steps.title")}
            </h2>
            {/* Vraie séquence : les numéros portent l'ordre des étapes. */}
            <ol className="mt-6 grid gap-6 sm:grid-cols-3">
              {STEPS.map((step, index) => (
                <li key={step} className="border-t-2 border-foreground pt-4">
                  <span
                    aria-hidden="true"
                    className="font-display text-h2 font-extrabold text-accent-strong"
                  >
                    {index + 1}
                  </span>
                  <p className="mt-2 font-semibold text-foreground">
                    {t(`home.steps.${step}.title`)}
                  </p>
                  <p className="mt-1 text-sm text-foreground-muted">
                    {t(`home.steps.${step}.description`)}
                  </p>
                </li>
              ))}
            </ol>
          </section>

          {user && (
            <div className="flex justify-center pb-4">
              <Button variant="ghost" onClick={() => void handleLogout()}>
                {t("home.logout")}
              </Button>
            </div>
          )}
        </PageContainer>
      </div>
    </div>
  );
}
