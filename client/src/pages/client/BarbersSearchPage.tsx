import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";
import type {
  BarbersSearchResponse,
  PublicBarberSearchItem,
} from "@findbarber/shared/types";
import i18n from "../../i18n";
import { barbersApi, type BarbersSearchParams } from "../../lib/apiClient";
import {
  boundsAround,
  distanceKm,
  normalizeBounds,
  type GeoBounds,
} from "../../lib/geo";
import { cn } from "../../lib/cn";
import { useMediaQuery, usePrefersReducedMotion } from "../../lib/media";
import { useFillViewport } from "../../lib/useFillViewport";
import { legacyFilterTags, parseSearchUrl } from "../../lib/searchUrl";
import {
  requestVisitorPosition,
  useVisitorPosition,
} from "../../lib/visitorPosition";
import { useTheme } from "../../app/theme-context";
import { MapErrorBoundary } from "../../components/MapErrorBoundary";
import { BarbersMapCard } from "../../components/BarbersMapCard";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { Skeleton } from "../../components/ui/Skeleton";
import {
  SearchFilters,
  type SmartFilters,
} from "../../components/search/SearchFilters";
import { BarberResultCard } from "../../components/search/BarberResultCard";

// Chargement différé : MapLibre (volumineux) sort du bundle initial de la recherche.
const BarbersMap = lazy(() => import("../../components/BarbersMap"));

const PAGE_SIZE = 12;
// Avec un rayon, le serveur reçoit le rectangle englobant (jamais la position) :
// on charge une page maximale puis on garde, ici, les barbers dans le cercle.
const RADIUS_PAGE_SIZE = 50;

export function BarbersSearchPage() {
  const { t } = useTranslation("client");
  const [searchParams, setSearchParams] = useSearchParams();
  const urlState = useMemo(() => parseSearchUrl(searchParams), [searchParams]);
  const [city, setCity] = useState(urlState.city);
  const [data, setData] = useState<BarbersSearchResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Liste ouverte : panneau latéral (desktop) ou panneau du bas (mobile,
  // replié par défaut pour laisser la carte occuper l'écran).
  const [listOpen, setListOpen] = useState(() =>
    typeof window === "undefined" ? true : window.matchMedia("(min-width: 1024px)").matches,
  );
  // Mobile (plan §2.6.9) : liste repliée (poignée), à mi-hauteur (55 %) ou
  // agrandie (90 %). `listOpen` couvre les deux dernières positions.
  const [listExpanded, setListExpanded] = useState(false);
  const listTouchY = useRef<number | null>(null);
  const [mapRetryToken, setMapRetryToken] = useState(0);
  // Zone visible de la carte après un geste du visiteur (issue #50). Hors URL :
  // c'est un état de navigation, et elle se déduirait sinon de la position du
  // visiteur quand la carte est centrée sur lui.
  const [area, setArea] = useState<GeoBounds | null>(null);
  // Panneau de filtres replié par défaut sur mobile ; toujours affiché à
  // partir de 1024 px.
  const [filtersOpen, setFiltersOpen] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const requestSeq = useRef(0);
  const listRef = useRef<HTMLDivElement | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const height = useFillViewport(rootRef);

  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const reducedMotion = usePrefersReducedMotion();
  const { resolvedTheme } = useTheme();
  const visitor = useVisitorPosition();

  // Le rayon ne s'applique qu'avec une position connue ; refusée ou
  // introuvable, le filtre distance est ignoré (et désactivé dans le panneau).
  const radiusKm = urlState.radiusKm;
  const radiusActive = radiusKm !== null && visitor.status === "granted";
  const waitingForPosition =
    radiusKm !== null &&
    (visitor.status === "idle" || visitor.status === "pending");
  const position = visitor.position;

  // Un rayon présent dans l'URL (lien partagé, rechargement) redemande la position.
  useEffect(() => {
    if (radiusKm !== null && visitor.status === "idle") requestVisitorPosition();
  }, [radiusKm, visitor.status]);

  // L'URL est la source de vérité : synchronise le champ ville à chaque
  // changement (recherche, réinitialisation, précédent/suivant).
  useEffect(() => {
    setCity(urlState.city);
  }, [urlState.city]);

  const query: BarbersSearchParams | null = useMemo(() => {
    if (waitingForPosition) return null;
    const base: BarbersSearchParams = {
      q: urlState.q || undefined,
      city: urlState.city || undefined,
      audience: urlState.audience || undefined,
      technique: urlState.technique || undefined,
      place: urlState.place || undefined,
      page: urlState.page,
      pageSize: PAGE_SIZE,
    };
    if (urlState.maxPrice !== null) {
      base.maxPrice = urlState.maxPrice;
      base.currency = urlState.currency;
    }
    if (urlState.minRating !== null) base.minRating = urlState.minRating;
    if (radiusActive && position) {
      Object.assign(base, boundsAround(position, radiusKm as number));
      base.page = 1;
      base.pageSize = RADIUS_PAGE_SIZE;
    } else if (area) {
      // La zone visible remplace la ville : on cherche là où l'on regarde,
      // y compris de l'autre côté d'une frontière.
      Object.assign(base, area);
      base.city = undefined;
    }
    return base;
  }, [urlState, radiusActive, radiusKm, position, waitingForPosition, area]);

  useEffect(() => {
    if (!query) return;
    const seq = ++requestSeq.current;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError(null);

    barbersApi
      .search(query, controller.signal)
      .then((res) => {
        if (seq === requestSeq.current) setData(res);
      })
      .catch((err: unknown) => {
        // Une annulation n'est pas une erreur utilisateur.
        if (err instanceof DOMException && err.name === "AbortError") return;
        if (seq === requestSeq.current) {
          setError(
            err instanceof Error ? err.message : i18n.t("client:search.page.error"),
          );
        }
      })
      .finally(() => {
        if (seq === requestSeq.current) setLoading(false);
      });

    return () => controller.abort();
  }, [query, reloadToken]);

  // Distance calculée dans le navigateur, sur la position publique approximative.
  const results = useMemo(() => {
    const items = (data?.barbers ?? []).map((barber) => ({
      barber,
      distance: position ? distanceKm(position, barber) : null,
    }));
    if (!radiusActive) return items;
    return items
      .filter((item) => item.distance !== null && item.distance <= (radiusKm as number))
      .sort((a, b) => (a.distance as number) - (b.distance as number));
  }, [data, position, radiusActive, radiusKm]);
  const barbers: PublicBarberSearchItem[] = useMemo(
    () => results.map((item) => item.barber),
    [results],
  );

  // Après changement de page ou de filtres, une sélection devenue absente est retirée.
  useEffect(() => {
    if (selectedId && !barbers.some((b) => b.id === selectedId)) {
      setSelectedId(null);
    }
  }, [barbers, selectedId]);

  // Clic sur un marqueur → le résultat correspondant défile dans la liste.
  useEffect(() => {
    if (!selectedId) return;
    const node = listRef.current?.querySelector(
      `[data-barber-id="${CSS.escape(selectedId)}"]`,
    );
    if (node instanceof HTMLElement) {
      node.scrollIntoView({
        block: "nearest",
        behavior: reducedMotion ? "auto" : "smooth",
      });
    }
  }, [selectedId, reducedMotion]);

  // Toute modification de filtre repart de la page 1.
  function updateParams(mutate: (next: URLSearchParams) => void) {
    const next = new URLSearchParams(searchParams);
    mutate(next);
    next.delete("page");
    setSearchParams(next);
  }

  // Sélection depuis la liste ou un marqueur. Sur mobile, le panneau du bas se
  // replie pour laisser voir la fiche du barber sur la carte.
  function selectBarber(id: string) {
    setSelectedId(id);
    if (!isDesktop) {
      setListOpen(false);
      setListExpanded(false);
    }
  }

  // Geste du visiteur sur la carte : les résultats suivent la zone visible
  // (sauf avec un rayon, qui fixe déjà la zone autour de lui).
  function handleViewportChange(bounds: GeoBounds) {
    if (radiusActive) return;
    setArea(normalizeBounds(bounds));
    if (urlState.page !== 1 || urlState.city) {
      updateParams((next) => next.delete("city"));
    }
  }

  // Stable : la fiche écoute la touche Échap tant qu'elle est ouverte.
  const closeCard = useCallback(() => setSelectedId(null), []);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    // Nouvelle ville : la carte se recadre sur ses résultats.
    setArea(null);
    updateParams((next) => {
      const trimmed = city.trim();
      if (trimmed) next.set("city", trimmed);
      else next.delete("city");
    });
  }

  function handleReset() {
    setArea(null);
    setSearchParams({});
  }

  const smartFilters: SmartFilters = {
    maxPrice: urlState.maxPrice === null ? "" : String(urlState.maxPrice),
    currency: urlState.currency,
    minRating: urlState.minRating === null ? "" : String(urlState.minRating),
    radiusKm: radiusKm === null ? "" : String(radiusKm),
  };

  function handleFiltersChange(next: SmartFilters) {
    if (next.radiusKm && visitor.status !== "granted") requestVisitorPosition();
    if (next.radiusKm) setArea(null);
    updateParams((params) => {
      for (const key of ["maxPrice", "minRating", "radiusKm"] as const) {
        if (next[key]) params.set(key, next[key]);
        else params.delete(key);
      }
      // La devise n'a de sens qu'avec un prix maximum.
      if (next.maxPrice) params.set("currency", next.currency);
      else params.delete("currency");
    });
  }

  function handleRemoveTag(key: string) {
    if (key === "area") {
      setArea(null);
      return;
    }
    updateParams((next) => next.delete(key));
  }

  function goToPage(target: number) {
    const next = new URLSearchParams(searchParams);
    if (target <= 1) next.delete("page");
    else next.set("page", String(target));
    setSearchParams(next);
  }

  const page = urlState.page;
  const pagination = radiusActive ? null : data?.pagination;
  const canPrev = Boolean(pagination && page > 1);
  const canNext = Boolean(pagination && page < (pagination.totalPages || 0));
  const selectedBarber = barbers.find((b) => b.id === selectedId) ?? null;
  const distanceById = new Map(
    results.map((item) => [item.barber.id, item.distance] as const),
  );
  // Rayon : plus de barbers dans le rectangle que la page maximale chargée.
  const radiusTruncated = Boolean(
    radiusActive && data && data.pagination.total > data.barbers.length,
  );
  // Marge de cadrage de la carte : les marqueurs ne passent pas sous le
  // panneau latéral (desktop) ou sous la barre de recherche et le panneau du
  // bas (mobile).
  const mapPadding = isDesktop
    ? { top: 56, bottom: 56, left: listOpen ? 440 : 56, right: 56 }
    : { top: 150, bottom: 110, left: 32, right: 32 };
  const areaActive = area !== null && !radiusActive;
  const resultCountLabel = radiusActive
    ? t("search.page.resultCountRadius", { count: barbers.length, radius: radiusKm })
    : pagination
      ? areaActive
        ? t("search.page.resultCountInArea", { count: pagination.total })
        : t("search.page.resultCount", { count: pagination.total })
      : "";
  // Zone : plus de barbers que la page affichée → on l'indique (issue #50).
  const moreInArea = Boolean(
    areaActive && pagination && pagination.total > pagination.page * pagination.pageSize,
  );
  const activeTags = [
    ...(areaActive ? [{ key: "area", label: t("search.page.areaTag") }] : []),
    ...legacyFilterTags(urlState),
  ];

  const filtersPanel = (
    <SearchFilters
      city={city}
      onCityChange={setCity}
      onSubmit={handleSubmit}
      onReset={handleReset}
      filters={smartFilters}
      onFiltersChange={handleFiltersChange}
      activeTags={activeTags}
      onRemoveTag={handleRemoveTag}
      positionStatus={visitor.status}
      filtersOpen={filtersOpen}
      onToggleFilters={() => setFiltersOpen((open) => !open)}
      advancedVisible={isDesktop}
      resultCount={radiusActive ? barbers.length : (pagination?.total ?? null)}
    />
  );

  const resultsContent =
    loading || waitingForPosition ? (
      <div aria-busy="true" className="space-y-3">
        <span className="sr-only" role="status">
          {t("search.page.loading")}
        </span>
        {[0, 1, 2].map((index) => (
          <Skeleton key={index} className="h-32 w-full rounded-2xl" />
        ))}
      </div>
    ) : error ? (
      <Card role="alert" className="p-6 text-center">
        <p className="text-sm text-danger">{error}</p>
        <Button
          variant="secondary"
          className="mt-3 min-h-[44px]"
          onClick={() => setReloadToken((token) => token + 1)}
        >
          {t("search.page.retry")}
        </Button>
      </Card>
    ) : data && barbers.length === 0 ? (
      pagination && pagination.total > 0 ? (
        <Card className="p-6 text-center">
          <p className="text-foreground-muted">
            {t("search.page.emptyPage")}
          </p>
          <Button
            variant="secondary"
            className="mt-3 min-h-[44px]"
            onClick={() => goToPage(1)}
          >
            {t("search.page.firstPage")}
          </Button>
        </Card>
      ) : (
        <Card className="p-6 text-center">
          <p className="text-foreground-muted">{t("search.page.noResults")}</p>
          <Button className="mt-3 min-h-[44px]" onClick={handleReset}>
            {t("search.page.resetFilters")}
          </Button>
        </Card>
      )
    ) : (
      <>
        <div ref={listRef} className="space-y-3">
          {barbers.map((barber) => (
            <div key={barber.id} data-barber-id={barber.id}>
              <BarberResultCard
                barber={barber}
                distanceKm={distanceById.get(barber.id) ?? null}
                selected={barber.id === selectedId}
                onSelect={selectBarber}
              />
            </div>
          ))}
        </div>

        {pagination && pagination.totalPages > 1 && (
          <div className="mt-4 flex items-center justify-between gap-2">
            <Button
              variant="secondary"
              className="min-h-[44px]"
              disabled={!canPrev}
              onClick={() => goToPage(page - 1)}
            >
              {t("search.page.previous")}
            </Button>
            <span className="text-sm text-foreground-muted">
              {t("search.page.pageOf", {
                page: pagination.page,
                total: pagination.totalPages,
              })}
            </span>
            <Button
              variant="secondary"
              className="min-h-[44px]"
              disabled={!canNext}
              onClick={() => goToPage(page + 1)}
            >
              {t("search.page.next")}
            </Button>
          </div>
        )}
      </>
    );

  const resultsSummary = (
    <p className="text-sm text-foreground-muted" role="status">
      {loading || waitingForPosition ? t("search.page.searching") : resultCountLabel}
      {radiusTruncated && ` · ${t("search.page.radiusTruncated")}`}
      {moreInArea && ` · ${t("search.page.moreInArea")}`}
    </p>
  );

  // Carte plein écran (issue #49) : elle occupe tout l'espace sous le header.
  // La liste est AVANT la carte dans le DOM : au clavier, on l'atteint sans
  // traverser la carte. Desktop : panneau latéral repliable. Mobile : barre de
  // recherche en haut et liste en panneau qui s'ouvre depuis le bas.
  return (
    <div
      ref={rootRef}
      style={height ? { height } : undefined}
      className="relative h-[calc(100dvh-4.5rem)] overflow-hidden bg-background"
    >
      <h1 className="sr-only">{t("search.page.title")}</h1>

      {isDesktop ? (
        listOpen ? (
          // Panneau en verre (plan §2.4 et §2.6.9) : 400 px, `radius-xl`,
          // fond opaque si le navigateur ne gère pas `backdrop-filter`.
          <section
            id="search-results"
            aria-label={t("search.page.results")}
            className="absolute bottom-4 left-4 top-4 z-20 flex w-[25rem] flex-col overflow-hidden rounded-3xl border border-border bg-surface/80 shadow-3 backdrop-blur-[16px] backdrop-saturate-150 supports-[not(backdrop-filter:blur(1px))]:bg-surface"
          >
            <div className="space-y-3 overflow-y-auto p-4">
              {filtersPanel}
              <div className="flex items-center justify-between gap-2">
                {resultsSummary}
                <Button
                  variant="ghost"
                  className="min-h-[44px] shrink-0"
                  aria-controls="search-results"
                  aria-expanded="true"
                  onClick={() => setListOpen(false)}
                >
                  {t("search.page.hideList")}
                </Button>
              </div>
              {resultsContent}
            </div>
          </section>
        ) : (
          <Button
            className="absolute left-4 top-4 z-20 min-h-[44px] shadow-card"
            aria-controls="search-results"
            aria-expanded="false"
            onClick={() => setListOpen(true)}
          >
            {t("search.page.showList")}
          </Button>
        )
      ) : (
        <>
          <div className="absolute inset-x-3 top-3 z-20 max-h-[60%] overflow-y-auto rounded-2xl shadow-card">
            {filtersPanel}
          </div>
          <section
            id="search-results"
            aria-label={t("search.page.results")}
            // Feuille du bas à trois positions : poignée seule, 55 %, 90 %.
            // Glisser la poignée vers le haut ou le bas change de position.
            onTouchStart={(event) => {
              listTouchY.current = event.touches[0]?.clientY ?? null;
            }}
            onTouchEnd={(event) => {
              const start = listTouchY.current;
              const end = event.changedTouches[0]?.clientY;
              listTouchY.current = null;
              if (start === null || end === undefined) return;
              const delta = end - start;
              if (delta < -60) {
                if (!listOpen) setListOpen(true);
                else setListExpanded(true);
              } else if (delta > 60) {
                if (listExpanded) setListExpanded(false);
                else setListOpen(false);
              }
            }}
            className={cn(
              "absolute inset-x-0 bottom-0 z-20 flex flex-col rounded-t-3xl border-t border-border bg-surface shadow-3 transition-[max-height] duration-slow ease-out",
              !listOpen ? "max-h-20" : listExpanded ? "max-h-[90%]" : "max-h-[55%]",
            )}
          >
            {listOpen && (
              <button
                type="button"
                aria-pressed={listExpanded}
                aria-controls="search-results"
                onClick={() => setListExpanded((value) => !value)}
                aria-label={
                  listExpanded ? t("search.page.shrinkList") : t("search.page.expandList")
                }
                className="focus-ring absolute right-3 top-3 z-10 flex h-11 w-11 items-center justify-center rounded-full text-foreground-muted transition-colors duration-fast hover:bg-surface-muted hover:text-foreground"
              >
                <svg
                  aria-hidden="true"
                  viewBox="0 0 20 20"
                  className={cn(
                    "h-5 w-5 transition-transform duration-base ease-out",
                    listExpanded && "rotate-180",
                  )}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.8}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M5 12.5l5-5 5 5" />
                </svg>
              </button>
            )}
            <button
              type="button"
              aria-expanded={listOpen}
              aria-controls="search-results-list"
              onClick={() => {
                setListOpen((open) => !open);
                setListExpanded(false);
              }}
              className="flex min-h-[64px] w-full shrink-0 flex-col items-center justify-center gap-1 px-14 focus-ring-inset"
            >
              <span aria-hidden="true" className="h-1.5 w-10 rounded-full bg-border-strong" />
              <span className="text-sm font-semibold text-foreground">
                {listOpen ? t("search.page.hideList") : t("search.page.showList")}
                {" · "}
                {loading || waitingForPosition
                  ? t("search.page.searching")
                  : resultCountLabel}
              </span>
            </button>
            <div
              id="search-results-list"
              className={cn("overflow-y-auto px-3 pb-4", listOpen ? "" : "hidden")}
            >
              {(radiusTruncated || moreInArea) && (
                <div className="mb-2">{resultsSummary}</div>
              )}
              {resultsContent}
            </div>
          </section>
        </>
      )}

      <div
        role="region"
        aria-label={t("search.page.mapRegion")}
        className="fb-search-map absolute inset-0 z-0"
      >
        <p className="sr-only">
          {t("search.page.mapAlternative")}
        </p>
        <MapErrorBoundary
          fallback={
            <div
              role="alert"
              className="flex h-full items-center justify-center p-6 text-center text-sm text-foreground-muted"
            >
              {t("search.page.mapCrashed")}
            </div>
          }
        >
          <Suspense
            fallback={
              <div className="flex h-full items-center justify-center text-sm text-foreground-muted">
                {t("map.loading")}
              </div>
            }
          >
            <BarbersMap
              key={mapRetryToken}
              barbers={barbers}
              selectedId={selectedId}
              onSelect={selectBarber}
              reducedMotion={reducedMotion}
              onRetry={() => setMapRetryToken((n) => n + 1)}
              onShowList={() => setListOpen(true)}
              theme={resolvedTheme}
              padding={mapPadding}
              onViewportChange={handleViewportChange}
              autoFit={!areaActive}
            />
          </Suspense>
        </MapErrorBoundary>
        {selectedBarber && (
          <BarbersMapCard
            barber={selectedBarber}
            distanceKm={distanceById.get(selectedBarber.id) ?? null}
            onClose={closeCard}
          />
        )}
        {/* La fiche affiche déjà cette mention : pas de doublon. */}
        {!selectedBarber && (
          <p className="pointer-events-none absolute bottom-[7.5rem] left-3 z-10 rounded-full lg:bottom-8 lg:left-auto lg:right-3 bg-surface/90 px-3 py-1 text-xs text-foreground-muted shadow-sm">
            {t("labels:approximateLocation")}
          </p>
        )}
      </div>
    </div>
  );
}
