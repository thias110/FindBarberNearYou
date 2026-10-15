import {
  lazy,
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { useSearchParams } from "react-router-dom";
import type {
  BarbersSearchResponse,
  PublicBarberSearchItem,
} from "@findbarber/shared/types";
import { APPROXIMATE_LOCATION_LABEL } from "@findbarber/shared/constants";
import { barbersApi, type BarbersSearchParams } from "../../lib/apiClient";
import { boundsAround, distanceKm } from "../../lib/geo";
import { useMediaQuery, usePrefersReducedMotion } from "../../lib/media";
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
import { segmentClasses } from "../../components/ui/chipStyles";

// Chargement différé : MapLibre (volumineux) sort du bundle initial de la recherche.
const BarbersMap = lazy(() => import("../../components/BarbersMap"));

const PAGE_SIZE = 12;
// Avec un rayon, le serveur reçoit le rectangle englobant (jamais la position) :
// on charge une page maximale puis on garde, ici, les barbers dans le cercle.
const RADIUS_PAGE_SIZE = 50;

export function BarbersSearchPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const urlState = useMemo(() => parseSearchUrl(searchParams), [searchParams]);
  const [city, setCity] = useState(urlState.city);
  const [data, setData] = useState<BarbersSearchResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [view, setView] = useState<"list" | "map">("list");
  const [mapRetryToken, setMapRetryToken] = useState(0);
  // Panneau de filtres replié par défaut sur mobile ; toujours affiché à
  // partir de 1024 px.
  const [filtersOpen, setFiltersOpen] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const requestSeq = useRef(0);
  const listRef = useRef<HTMLDivElement | null>(null);

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
    }
    return base;
  }, [urlState, radiusActive, radiusKm, position, waitingForPosition]);

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
          setError(err instanceof Error ? err.message : "Recherche impossible.");
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

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    updateParams((next) => {
      const trimmed = city.trim();
      if (trimmed) next.set("city", trimmed);
      else next.delete("city");
    });
  }

  function handleReset() {
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
  const resultCountLabel = radiusActive
    ? `${barbers.length} résultat(s) à moins de ${radiusKm} km`
    : pagination
      ? `${pagination.total} résultat(s)`
      : "";

  // Desktop : liste et carte toujours visibles. Mobile : une seule vue à la fois,
  // liste par défaut ; la carte n'est montée qu'à l'ouverture de la vue Carte.
  const showMap = isDesktop || view === "map";
  const showList = isDesktop || view === "list";

  return (
    <div className="min-h-screen bg-background p-4 sm:p-8">
      <div className="mx-auto max-w-7xl space-y-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-foreground">
            Rechercher un barber
          </h1>
          <p className="mt-1 text-sm text-foreground-muted">
            Par ville, prix, distance ou note.
          </p>
        </div>

        <SearchFilters
          city={city}
          onCityChange={setCity}
          onSubmit={handleSubmit}
          onReset={handleReset}
          filters={smartFilters}
          onFiltersChange={handleFiltersChange}
          activeTags={legacyFilterTags(urlState)}
          onRemoveTag={handleRemoveTag}
          positionStatus={visitor.status}
          filtersOpen={filtersOpen}
          onToggleFilters={() => setFiltersOpen((open) => !open)}
          advancedVisible={isDesktop}
        />

        {loading || waitingForPosition ? (
          <div
            aria-busy="true"
            className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1"
          >
            <span className="sr-only" role="status">
              Chargement des résultats…
            </span>
            {[0, 1, 2].map((index) => (
              <Skeleton key={index} className="h-40 w-full rounded-2xl" />
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
              Réessayer
            </Button>
          </Card>
        ) : data && barbers.length === 0 ? (
          pagination && pagination.total > 0 ? (
            <Card className="p-6 text-center">
              <p className="text-foreground-muted">
                Cette page ne contient aucun résultat.
              </p>
              <Button
                variant="secondary"
                className="mt-3 min-h-[44px]"
                onClick={() => goToPage(1)}
              >
                Revenir à la première page
              </Button>
            </Card>
          ) : (
            <Card className="p-6 text-center">
              <p className="text-foreground-muted">Aucun résultat.</p>
              <Button className="mt-3 min-h-[44px]" onClick={handleReset}>
                Réinitialiser les filtres
              </Button>
            </Card>
          )
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-foreground-muted" role="status">
                {resultCountLabel}
                {radiusTruncated &&
                  " · d'autres barbers existent dans ce rayon, affinez les filtres."}
              </p>
              <div
                role="group"
                aria-label="Mode d'affichage des résultats"
                className="inline-flex gap-1 rounded-full border border-border bg-surface p-1 lg:hidden"
              >
                <button
                  type="button"
                  aria-pressed={view === "list"}
                  onClick={() => setView("list")}
                  className={segmentClasses(view === "list")}
                >
                  Liste
                </button>
                <button
                  type="button"
                  aria-pressed={view === "map"}
                  onClick={() => setView("map")}
                  className={segmentClasses(view === "map")}
                >
                  Carte
                </button>
              </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
              <div ref={listRef} className={showList ? "space-y-4" : "hidden"}>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
                  {barbers.map((barber) => (
                    <div key={barber.id} data-barber-id={barber.id}>
                      <BarberResultCard
                        barber={barber}
                        distanceKm={distanceById.get(barber.id) ?? null}
                        selected={barber.id === selectedId}
                        onSelect={setSelectedId}
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div className={showMap ? "" : "hidden"}>
                <div className="lg:sticky lg:top-6">
                  <div
                    role="region"
                    aria-label="Carte des barbiers (résultats de cette page)"
                    className="relative h-72 overflow-hidden rounded-2xl border border-border bg-surface shadow lg:h-[34rem]"
                  >
                    <p className="sr-only">
                      La liste des résultats est l'alternative textuelle de
                      cette carte.
                    </p>
                    {showMap && (
                      <MapErrorBoundary
                        fallback={
                          <div
                            role="alert"
                            className="flex h-full items-center justify-center p-6 text-center text-sm text-foreground-muted"
                          >
                            La carte n'a pas pu être affichée. La liste des
                            résultats reste utilisable.
                          </div>
                        }
                      >
                        <Suspense
                          fallback={
                            <div className="flex h-full items-center justify-center text-sm text-foreground-muted">
                              Chargement de la carte…
                            </div>
                          }
                        >
                          <BarbersMap
                            key={mapRetryToken}
                            barbers={barbers}
                            selectedId={selectedId}
                            onSelect={setSelectedId}
                            reducedMotion={reducedMotion}
                            onRetry={() => setMapRetryToken((t) => t + 1)}
                            onShowList={() => setView("list")}
                            theme={resolvedTheme}
                          />
                        </Suspense>
                      </MapErrorBoundary>
                    )}
                    {selectedBarber && (
                      <BarbersMapCard
                        barber={selectedBarber}
                        onClose={() => setSelectedId(null)}
                      />
                    )}
                    <p className="pointer-events-none absolute left-3 top-3 z-10 rounded-full bg-surface/90 px-3 py-1 text-xs text-foreground-muted shadow-sm">
                      Carte : résultats de cette page ·{" "}
                      {APPROXIMATE_LOCATION_LABEL}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {pagination && pagination.totalPages > 0 && (
              <div className="flex items-center justify-between">
                <Button
                  variant="secondary"
                  className="min-h-[44px]"
                  disabled={!canPrev}
                  onClick={() => goToPage(page - 1)}
                >
                  Précédent
                </Button>
                <span className="text-sm text-foreground-muted">
                  Page {pagination.page} / {pagination.totalPages}
                </span>
                <Button
                  variant="secondary"
                  className="min-h-[44px]"
                  disabled={!canNext}
                  onClick={() => goToPage(page + 1)}
                >
                  Suivant
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
