import {
  lazy,
  Suspense,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { useSearchParams } from "react-router-dom";
import type { BarbersSearchResponse } from "@findbarber/shared/types";
import { APPROXIMATE_LOCATION_LABEL } from "@findbarber/shared/constants";
import { barbersApi } from "../../lib/apiClient";
import { cn } from "../../lib/cn";
import { useMediaQuery, usePrefersReducedMotion } from "../../lib/media";
import { useTheme } from "../../app/theme-context";
import { MapErrorBoundary } from "../../components/MapErrorBoundary";
import { BarbersMapCard } from "../../components/BarbersMapCard";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { Skeleton } from "../../components/ui/Skeleton";
import {
  SearchFilters,
  type SearchFiltersValues,
} from "../../components/search/SearchFilters";
import { BarberResultCard } from "../../components/search/BarberResultCard";

// Chargement différé : MapLibre (volumineux) sort du bundle initial de la recherche.
const BarbersMap = lazy(() => import("../../components/BarbersMap"));

type Filters = SearchFiltersValues;

// Les codes (pays, public, technique) sont normalisés trim + majuscules pour que
// les sélecteurs affichent la valeur réellement appliquée par le serveur.
function normalizeCode(value: string | null): string {
  return (value ?? "").trim().toUpperCase();
}

function filtersFromParams(sp: URLSearchParams): Filters {
  return {
    q: sp.get("q") ?? "",
    city: sp.get("city") ?? "",
    countryCode: normalizeCode(sp.get("countryCode")),
    audience: normalizeCode(sp.get("audience")),
    technique: normalizeCode(sp.get("technique")),
    place: normalizeCode(sp.get("place")),
  };
}

function pageFromParams(sp: URLSearchParams): number {
  const value = Number(sp.get("page") ?? "1");
  return Number.isInteger(value) && value > 0 ? value : 1;
}

export function BarbersSearchPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [form, setForm] = useState<Filters>(() => filtersFromParams(searchParams));
  const [data, setData] = useState<BarbersSearchResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [view, setView] = useState<"list" | "map">("list");
  const [mapRetryToken, setMapRetryToken] = useState(0);
  // Panneau de filtres avancés (nom, pays, public, prestation) replié par défaut
  // sur mobile ; toujours affiché à partir de 1024 px.
  const [filtersOpen, setFiltersOpen] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const requestSeq = useRef(0);
  const listRef = useRef<HTMLDivElement | null>(null);

  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const reducedMotion = usePrefersReducedMotion();
  const { resolvedTheme } = useTheme();

  // Nombre de filtres supplémentaires actifs (hors ville, toujours visible).
  const extraFilterCount = [
    form.q,
    form.countryCode,
    form.audience,
    form.technique,
    form.place,
  ].filter((value) => value.trim() !== "").length;

  // L'URL est la source de vérité : synchronise le formulaire à chaque
  // changement (recherche, réinitialisation, précédent/suivant).
  useEffect(() => {
    setForm(filtersFromParams(searchParams));
  }, [searchParams]);

  useEffect(() => {
    const seq = ++requestSeq.current;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const page = pageFromParams(searchParams);
    setLoading(true);
    setError(null);

    barbersApi
      .search(
        {
          q: searchParams.get("q") ?? undefined,
          city: searchParams.get("city") ?? undefined,
          countryCode: normalizeCode(searchParams.get("countryCode")) || undefined,
          audience: normalizeCode(searchParams.get("audience")) || undefined,
          technique: normalizeCode(searchParams.get("technique")) || undefined,
          place: normalizeCode(searchParams.get("place")) || undefined,
          page,
          pageSize: 12,
        },
        controller.signal,
      )
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
  }, [searchParams, reloadToken]);

  // Après changement de page ou de filtres, une sélection devenue absente est retirée.
  useEffect(() => {
    if (selectedId && data && !data.barbers.some((b) => b.id === selectedId)) {
      setSelectedId(null);
    }
  }, [data, selectedId]);

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

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const next = new URLSearchParams();
    for (const [key, value] of Object.entries(form)) {
      const trimmed = value.trim();
      if (trimmed) next.set(key, trimmed);
    }
    // Nouvelle recherche → page 1 (paramètre "page" absent).
    setSearchParams(next);
  }

  function handleReset() {
    setSearchParams({});
  }

  function goToPage(target: number) {
    const next = new URLSearchParams(searchParams);
    if (target <= 1) next.delete("page");
    else next.set("page", String(target));
    setSearchParams(next);
  }

  const page = pageFromParams(searchParams);
  const pagination = data?.pagination;
  const canPrev = Boolean(pagination && page > 1);
  const canNext = Boolean(pagination && page < (pagination.totalPages || 0));
  const barbers = data?.barbers ?? [];
  const selectedBarber = barbers.find((b) => b.id === selectedId) ?? null;

  // Desktop : liste et carte toujours visibles. Mobile : une seule vue à la fois,
  // liste par défaut ; la carte n'est montée qu'à l'ouverture de la vue Carte.
  const showMap = isDesktop || view === "map";
  const showList = isDesktop || view === "list";

  return (
    <div className="min-h-screen bg-background p-4 sm:p-8">
      <div className="mx-auto max-w-7xl space-y-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">
            Rechercher un barbier
          </h1>
          <p className="mt-1 text-sm text-foreground-muted">
            Par nom, ville, pays, public ou prestation.
          </p>
        </div>

        <SearchFilters
          form={form}
          onChange={setForm}
          onSubmit={handleSubmit}
          onReset={handleReset}
          filtersOpen={filtersOpen}
          onToggleFilters={() => setFiltersOpen((open) => !open)}
          extraFilterCount={extraFilterCount}
          advancedVisible={isDesktop}
        />

        {loading ? (
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
        ) : data && data.barbers.length === 0 ? (
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
              <p className="text-sm text-foreground-muted">
                {pagination ? `${pagination.total} résultat(s)` : ""}
              </p>
              <div
                role="group"
                aria-label="Mode d'affichage des résultats"
                className="inline-flex rounded-lg border border-border bg-surface p-0.5 lg:hidden"
              >
                <button
                  type="button"
                  aria-pressed={view === "list"}
                  onClick={() => setView("list")}
                  className={cn(
                    "inline-flex min-h-[44px] items-center rounded-md px-3 text-sm",
                    view === "list"
                      ? "bg-accent text-accent-foreground"
                      : "text-foreground-muted",
                  )}
                >
                  Liste
                </button>
                <button
                  type="button"
                  aria-pressed={view === "map"}
                  onClick={() => setView("map")}
                  className={cn(
                    "inline-flex min-h-[44px] items-center rounded-md px-3 text-sm",
                    view === "map"
                      ? "bg-accent text-accent-foreground"
                      : "text-foreground-muted",
                  )}
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
