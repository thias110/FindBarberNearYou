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
import { cn } from "../../lib/cn";
import { distanceKm } from "../../lib/geo";
import {
  requestVisitorPosition,
  useVisitorPosition,
} from "../../lib/visitorPosition";
import { Alert } from "../../components/ui/Alert";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { EmptyState } from "../../components/ui/EmptyState";
import { ErrorState } from "../../components/ui/ErrorState";
import { Skeleton } from "../../components/ui/Skeleton";
import { HomeHero, type HeroPlace } from "../../components/home/HomeHero";
import { CategoryChips } from "../../components/home/CategoryChips";
import { BarberPreviewCard } from "../../components/home/BarberPreviewCard";
import { HomeStepsShowcase } from "../../components/home/HomeStepsShowcase";
import { buttonClasses } from "../../components/ui/buttonStyles";
import { PageContainer } from "../../components/ui/PageContainer";

// « Barbers à découvrir » (issue #54) : carrousel sur mobile ; à partir de
// `lg:`, grille bento adaptative (grande carte + quatre s'il y a au moins cinq
// barbers, duo asymétrique 7/5 pour deux barbers, sinon rangée équilibrée).
const PREVIEW_LIMIT = 8;
const BENTO_SIZE = 5;

const PRIMARY_LINK_CLASS = buttonClasses("primary", "lg", "shadow-cta");
const SECONDARY_LINK_CLASS = buttonClasses("secondary", "lg");
const VIEW_ALL_LINK_CLASS = buttonClasses("secondary");
const INVERSE_LINK_CLASS = buttonClasses("inverse", "lg");

// Accueil : vitrine éditoriale publique pour les visiteurs, enrichie pour un
// CLIENT connecté (rendez-vous, déconnexion). Les BARBER et ADMIN sont
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
  // (aucune demande spontanée depuis l'accueil).
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

  // Recherche par ville et lieu : contrat d'URL de BarbersSearchPage (`city`, `place`).
  function handleSearch(city: string, place: HeroPlace) {
    const params = new URLSearchParams();
    const trimmed = city.trim();
    if (trimmed) params.set("city", trimmed);
    if (place) params.set("place", place);
    const query = params.toString();
    navigate(query ? `/barbers?${query}` : "/barbers");
  }

  // Recherche autour de la position du visiteur : demande explicite déclenchée
  // par le geste du clic, puis ouverture de la carte sur un rayon de 10 km.
  function handleAroundMe(place: HeroPlace) {
    requestVisitorPosition();
    const params = new URLSearchParams();
    params.set("radiusKm", "10");
    if (place) params.set("place", place);
    navigate(`/barbers?${params.toString()}`);
  }

  async function handleLogout() {
    await logout();
    navigate("/login", { replace: true });
  }

  const count = barbers.length;
  const bento = count >= BENTO_SIZE;

  const desktopGridClass = bento
    ? "lg:auto-rows-[19.5rem] lg:grid-cols-4"
    : count === 4
      ? "lg:auto-rows-[25rem] lg:grid-cols-4"
      : count === 3
        ? "lg:auto-rows-[26.5rem] lg:grid-cols-3"
        : count === 2
          ? "lg:auto-rows-[28rem] lg:grid-cols-12"
          : "lg:auto-rows-[28rem] lg:max-w-xl lg:grid-cols-1";

  const hero = (
    <HomeHero
      user={user}
      onSearch={handleSearch}
      onAroundMe={handleAroundMe}
      fullBleed={!user}
    />
  );

  return (
    <div className="fb-canvas-glow min-h-screen bg-background">
      {/* Visiteur : hero de nuit pleine largeur sous la barre flottante. */}
      {!user && hero}
      <div className="px-4 pb-12 pt-6 sm:px-8 sm:pb-16 sm:pt-10">
        <PageContainer width="wide" stack="none" className="space-y-section">
          {accountDeleted && (
            <Alert variant="success">{t("home.accountDeleted")}</Alert>
          )}

          {user && hero}

          <div className="space-y-16">
            <CategoryChips techniques={popularTechniques} />

            <section aria-labelledby="home-barbers-title">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <h2
                    id="home-barbers-title"
                    className="font-display text-h2 font-bold text-foreground"
                  >
                    {t("home.barbers.title")}
                  </h2>
                  <p className="mt-1 text-sm text-foreground-muted sm:text-base">
                    {t("home.barbers.subtitle")}
                  </p>
                </div>
                <Link
                  to="/barbers"
                  className={cn(VIEW_ALL_LINK_CLASS, "group/all")}
                >
                  {t("home.barbers.viewAll")}
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 20 20"
                    className="h-4 w-4 shrink-0 transition-transform duration-fast ease-out motion-safe:group-hover/all:translate-x-0.5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M4 10h11M11 5.5L15.5 10 11 14.5" />
                  </svg>
                </Link>
              </div>

              {loading ? (
                <div
                  aria-busy="true"
                  className="mt-6 flex gap-4 overflow-hidden lg:grid lg:auto-rows-[19.5rem] lg:grid-cols-4"
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
              ) : count === 0 ? (
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
                <ul
                  aria-label={t("home.barbers.title")}
                  className={cn(
                    "-mx-4 mt-6 flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-px-4 px-4 pb-3 sm:-mx-8 sm:scroll-px-8 sm:px-8",
                    "lg:mx-0 lg:grid lg:gap-5 lg:overflow-visible lg:p-0",
                    desktopGridClass,
                  )}
                >
                  {barbers.map((barber, index) => {
                    const isFeatured =
                      (bento && index === 0) || (count <= 2 && index === 0);
                    return (
                      <li
                        key={barber.id}
                        className={cn(
                          "w-[78%] shrink-0 snap-start sm:w-[calc(50%-0.5rem)] lg:w-auto",
                          bento && index === 0 && "lg:col-span-2 lg:row-span-2",
                          bento && index >= BENTO_SIZE && "lg:hidden",
                          count === 2 && index === 0 && "lg:col-span-7",
                          count === 2 && index === 1 && "lg:col-span-5",
                        )}
                      >
                        <BarberPreviewCard
                          barber={barber}
                          featured={isFeatured}
                          distanceKm={
                            position ? distanceKm(position, barber) : null
                          }
                        />
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          </div>

          <HomeStepsShowcase />

          {user ? (
            <section aria-labelledby="home-appointments-title">
              <Card className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
                <div>
                  <h2
                    id="home-appointments-title"
                    className="font-display text-h3 font-bold text-foreground"
                  >
                    {t("home.appointments.title")}
                  </h2>
                  <p className="mt-1 text-sm text-foreground-muted">
                    {t("home.appointments.description")}
                  </p>
                </div>
                <Link
                  to="/appointments"
                  className={buttonClasses("primary", "md", "shrink-0")}
                >
                  {t("home.appointments.view")}
                </Link>
              </Card>
            </section>
          ) : (
            <section aria-labelledby="home-join-title" className="space-y-8">
              <h2 id="home-join-title" className="sr-only">
                {t("home.join.title")}
              </h2>

              {/* Vitrine « Espace professionnel » pleine largeur : photographie d'atelier + aperçu agenda */}
              <div className="relative isolate grid gap-8 overflow-hidden rounded-4xl bg-night p-7 text-white shadow-3 ring-1 ring-inset ring-white/12 sm:p-10 lg:grid-cols-12 lg:items-center lg:gap-10 lg:p-12">
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(44rem_30rem_at_85%_15%,rgb(var(--fb-cobalt)/0.34),transparent_70%),radial-gradient(36rem_24rem_at_10%_90%,rgb(var(--fb-brass)/0.18),transparent_70%)]"
                />

                <div className="lg:col-span-6">
                  <p className="inline-flex w-fit items-center gap-2 rounded-full border border-white/15 bg-white/[0.08] px-3.5 py-1 text-xs font-semibold text-ring-on-night">
                    <span
                      aria-hidden="true"
                      className="h-1.5 w-1.5 rounded-full bg-brass"
                    />
                    {t("home.join.barberBadge")}
                  </p>
                  <p className="mt-4 font-display text-h2 font-extrabold text-white">
                    {t("home.join.barberTitle")}
                  </p>
                  <p className="mt-2.5 max-w-[46ch] text-base leading-relaxed text-night-muted">
                    {t("home.join.barberDescription")}
                  </p>

                  <ul className="mt-6 space-y-3 text-sm text-white">
                    {(["agenda", "places", "payments"] as const).map((perk) => (
                      <li key={perk} className="flex items-start gap-3">
                        <span
                          aria-hidden="true"
                          className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-brass/40 bg-brass/15 text-brass"
                        >
                          <svg
                            viewBox="0 0 20 20"
                            fill="currentColor"
                            className="h-3.5 w-3.5"
                          >
                            <path
                              fillRule="evenodd"
                              d="M16.7 5.3a1 1 0 0 1 0 1.4l-8 8a1 1 0 0 1-1.4 0l-4-4a1 1 0 1 1 1.4-1.4L8 12.6l7.3-7.3a1 1 0 0 1 1.4 0Z"
                              clipRule="evenodd"
                            />
                          </svg>
                        </span>
                        <span>{t(`home.join.barberPerks.${perk}`)}</span>
                      </li>
                    ))}
                  </ul>

                  <div className="mt-8">
                    <Link
                      to="/register?role=BARBER"
                      className={cn(INVERSE_LINK_CLASS, "group/pro")}
                    >
                      {t("home.join.barberCta")}
                      <svg
                        aria-hidden="true"
                        viewBox="0 0 20 20"
                        className="h-4 w-4 shrink-0 transition-transform duration-fast ease-out motion-safe:group-hover/pro:translate-x-0.5"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={2}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M4 10h11M11 5.5L15.5 10 11 14.5" />
                      </svg>
                    </Link>
                  </div>
                </div>

                <div
                  aria-hidden="true"
                  className="relative overflow-hidden rounded-3xl border border-white/15 bg-night-2 p-2.5 shadow-2 lg:col-span-6"
                >
                  <div className="relative min-h-[17.5rem] overflow-hidden rounded-2xl sm:min-h-0 sm:aspect-[16/10]">
                    <img
                      src="/images/editorial/pro-studio.webp"
                      alt=""
                      width={1280}
                      height={720}
                      decoding="async"
                      className="absolute inset-0 h-full w-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-night via-night/45 to-transparent" />

                    {/* Mini-aperçu d'agenda professionnel superposé en verre sombre */}
                    <div className="absolute inset-x-3 bottom-3 rounded-2xl border border-white/15 bg-night/85 p-3.5 backdrop-blur-xl sm:p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="font-display text-sm font-bold text-white">
                          {t("home.join.proPreview.title")}
                        </p>
                        <span className="rounded-full border border-brass/40 bg-brass/15 px-2.5 py-0.5 text-[0.6875rem] font-semibold text-white">
                          {t("home.join.proPreview.protected")}
                        </span>
                      </div>
                      <div className="mt-2.5 space-y-1.5 text-xs">
                        <div className="flex items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/[0.06] px-3 py-2">
                          <span className="font-medium text-white">
                            <span className="mr-2 font-bold tabular-nums text-ring-on-night">
                              09:30
                            </span>
                            {t("home.join.proPreview.slot1")}
                          </span>
                          <span className="font-semibold text-brass">
                            {t("home.join.proPreview.confirmed")}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/[0.06] px-3 py-2">
                          <span className="font-medium text-white">
                            <span className="mr-2 font-bold tabular-nums text-ring-on-night">
                              14:00
                            </span>
                            {t("home.join.proPreview.slot2")}
                          </span>
                          <span className="font-semibold text-brass">
                            {t("home.join.proPreview.confirmed")}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Vitrine « Espace client » éditoriale */}
              <div className="grid gap-6 overflow-hidden rounded-4xl border border-border bg-surface p-6 text-foreground shadow-2 sm:p-10 lg:grid-cols-12 lg:items-center lg:gap-10">
                <div
                  aria-hidden="true"
                  className="relative aspect-[16/10] overflow-hidden rounded-3xl border border-border/70 lg:col-span-5 lg:aspect-[4/3]"
                >
                  <img
                    src="/images/editorial/craft-home.webp"
                    alt=""
                    width={800}
                    height={600}
                    decoding="async"
                    className="h-full w-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-night/80 via-transparent to-transparent" />
                  <p className="absolute bottom-3.5 left-3.5 rounded-full border border-white/20 bg-night/80 px-3 py-1 text-xs font-semibold text-white backdrop-blur-md">
                    {t("home.hero.showcase.modeBadge")}
                  </p>
                </div>

                <div className="lg:col-span-7">
                  <Badge variant="accent">{t("home.join.clientBadge")}</Badge>
                  <p className="mt-4 font-display text-h2 font-extrabold text-foreground">
                    {t("home.join.clientTitle")}
                  </p>
                  <p className="mt-2 max-w-[48ch] text-base leading-relaxed text-foreground-muted">
                    {t("home.join.clientDescription")}
                  </p>

                  <ul className="mt-6 space-y-2.5 text-sm text-foreground">
                    {(["favorites", "calendar", "privacy"] as const).map((perk) => (
                      <li key={perk} className="flex items-start gap-2.5">
                        <svg
                          aria-hidden="true"
                          viewBox="0 0 20 20"
                          fill="currentColor"
                          className="mt-0.5 h-4 w-4 shrink-0 text-accent-strong"
                        >
                          <path
                            fillRule="evenodd"
                            d="M16.7 5.3a1 1 0 0 1 0 1.4l-8 8a1 1 0 0 1-1.4 0l-4-4a1 1 0 1 1 1.4-1.4L8 12.6l7.3-7.3a1 1 0 0 1 1.4 0Z"
                            clipRule="evenodd"
                          />
                        </svg>
                        <span>{t(`home.join.clientPerks.${perk}`)}</span>
                      </li>
                    ))}
                  </ul>

                  <div className="mt-8 flex flex-wrap gap-3">
                    <Link to="/register" className={PRIMARY_LINK_CLASS}>
                      {t("home.join.register")}
                    </Link>
                    <Link to="/login" className={SECONDARY_LINK_CLASS}>
                      {t("home.join.login")}
                    </Link>
                  </div>
                </div>
              </div>
            </section>
          )}

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
