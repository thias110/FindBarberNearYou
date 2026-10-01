import { lazy, Suspense, useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import type { BarbersSearchResponse } from "@findbarber/shared/types";
import { COUNTRIES, COUNTRY_NAME_BY_CODE } from "@findbarber/shared/countries";
import {
  APPROXIMATE_LOCATION_LABEL,
  AUDIENCE_LABELS,
  AUDIENCES,
  SERVICE_PLACE_LABELS,
  SERVICE_PLACES,
  TECHNIQUE_LABELS,
  TECHNIQUES,
} from "@findbarber/shared/constants";
import { barbersApi } from "../../lib/apiClient";
import { audienceChips } from "../../lib/barberTags";
import { useMediaQuery, usePrefersReducedMotion } from "../../lib/media";
import { MapErrorBoundary } from "../../components/MapErrorBoundary";
import { BarbersMapCard } from "../../components/BarbersMapCard";

// Chargement différé : MapLibre (volumineux) sort du bundle initial de la recherche.
const BarbersMap = lazy(() => import("../../components/BarbersMap"));

const COUNTRIES_SORTED = [...COUNTRIES].sort((a, b) =>
  a.nameFr.localeCompare(b.nameFr, "fr"),
);

interface Filters {
  q: string;
  city: string;
  countryCode: string;
  audience: string;
  technique: string;
  place: string;
}

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
    <div className="min-h-screen bg-brand-50 p-4 sm:p-8">
      <div className="mx-auto max-w-7xl space-y-4">
        <div>
          <h1 className="text-2xl font-semibold text-brand-900">
            Rechercher un barbier
          </h1>
          <p className="mt-1 text-sm text-gray-600">
            Par nom, ville, pays, public ou prestation.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="space-y-3 rounded-2xl bg-white p-4 shadow sm:p-5"
        >
          {/* Ligne toujours visible : ville + recherche + accès aux filtres. */}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <label className="block min-w-0 flex-1">
              <span className="mb-1 block text-sm text-gray-700">Ville</span>
              <input
                value={form.city}
                onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2"
                placeholder="Ville"
              />
            </label>
            <div className="flex flex-wrap gap-2">
              <button
                type="submit"
                className="rounded-lg bg-brand-700 px-4 py-2 text-white"
              >
                Rechercher
              </button>
              <button
                type="button"
                onClick={() => setFiltersOpen((open) => !open)}
                aria-expanded={filtersOpen}
                aria-controls="advanced-filters"
                data-active-filters={extraFilterCount}
                className="rounded-lg border border-gray-300 px-4 py-2 text-gray-700 lg:hidden"
              >
                Filtres
                {extraFilterCount > 0 && (
                  <span className="ml-1 inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-brand-700 px-1.5 text-xs font-medium text-white">
                    {extraFilterCount}
                  </span>
                )}
              </button>
              <button
                type="button"
                onClick={handleReset}
                className="rounded-lg border border-gray-300 px-4 py-2 text-gray-700"
              >
                Réinitialiser
              </button>
            </div>
          </div>

          {/* Panneau avancé : dépliable sur mobile, toujours visible en desktop. */}
          <div
            id="advanced-filters"
            className={[
              isDesktop || filtersOpen ? "grid" : "hidden",
              "grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-5",
            ].join(" ")}
          >
            <label className="block min-w-0">
              <span className="mb-1 block text-sm text-gray-700">Nom</span>
              <input
                value={form.q}
                onChange={(e) => setForm((f) => ({ ...f, q: e.target.value }))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2"
                placeholder="Nom du barbier"
              />
            </label>
            <label className="block min-w-0">
              <span className="mb-1 block text-sm text-gray-700">Pays</span>
              <select
                value={form.countryCode}
                onChange={(e) =>
                  setForm((f) => ({ ...f, countryCode: e.target.value }))
                }
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2"
              >
                <option value="">Tous les pays</option>
                {COUNTRIES_SORTED.map((country) => (
                  <option key={country.code} value={country.code}>
                    {country.nameFr}
                  </option>
                ))}
              </select>
            </label>
            <label className="block min-w-0">
              <span className="mb-1 block text-sm text-gray-700">Public</span>
              <select
                value={form.audience}
                onChange={(e) =>
                  setForm((f) => ({ ...f, audience: e.target.value }))
                }
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2"
              >
                <option value="">Tous les publics</option>
                {AUDIENCES.map((code) => (
                  <option key={code} value={code}>
                    {AUDIENCE_LABELS[code]}
                  </option>
                ))}
              </select>
            </label>
            <label className="block min-w-0">
              <span className="mb-1 block text-sm text-gray-700">Prestation</span>
              <select
                value={form.technique}
                onChange={(e) =>
                  setForm((f) => ({ ...f, technique: e.target.value }))
                }
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2"
              >
                <option value="">Toutes les prestations</option>
                {TECHNIQUES.map((code) => (
                  <option key={code} value={code}>
                    {TECHNIQUE_LABELS[code]}
                  </option>
                ))}
              </select>
            </label>
            <label className="block min-w-0">
              <span className="mb-1 block text-sm text-gray-700">Lieu</span>
              <select
                value={form.place}
                onChange={(e) =>
                  setForm((f) => ({ ...f, place: e.target.value }))
                }
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2"
              >
                <option value="">Tous les lieux</option>
                {SERVICE_PLACES.map((code) => (
                  <option key={code} value={code}>
                    {SERVICE_PLACE_LABELS[code]}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </form>

        {loading ? (
          <p className="rounded-2xl bg-white p-6 text-center text-gray-500 shadow">
            Chargement…
          </p>
        ) : error ? (
          <div className="rounded-2xl bg-white p-6 text-center shadow">
            <p className="text-sm text-red-700">{error}</p>
            <button
              onClick={() => setReloadToken((t) => t + 1)}
              className="mt-3 rounded-lg border border-brand-700 px-4 py-2 text-brand-700"
            >
              Réessayer
            </button>
          </div>
        ) : data && data.barbers.length === 0 ? (
          pagination && pagination.total > 0 ? (
            <div className="rounded-2xl bg-white p-6 text-center shadow">
              <p className="text-gray-600">
                Cette page ne contient aucun résultat.
              </p>
              <button
                type="button"
                onClick={() => goToPage(1)}
                className="mt-3 rounded-lg border border-brand-700 px-4 py-2 text-brand-700"
              >
                Revenir à la première page
              </button>
            </div>
          ) : (
            <p className="rounded-2xl bg-white p-6 text-center text-gray-600 shadow">
              Aucun résultat.
            </p>
          )
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-gray-600">
                {pagination ? `${pagination.total} résultat(s)` : ""}
              </p>
              <div
                role="group"
                aria-label="Mode d'affichage des résultats"
                className="inline-flex rounded-lg border border-gray-300 bg-white p-0.5 lg:hidden"
              >
                <button
                  type="button"
                  aria-pressed={view === "list"}
                  onClick={() => setView("list")}
                  className={`rounded-md px-3 py-1.5 text-sm ${
                    view === "list"
                      ? "bg-brand-700 text-white"
                      : "text-gray-700"
                  }`}
                >
                  Liste
                </button>
                <button
                  type="button"
                  aria-pressed={view === "map"}
                  onClick={() => setView("map")}
                  className={`rounded-md px-3 py-1.5 text-sm ${
                    view === "map" ? "bg-brand-700 text-white" : "text-gray-700"
                  }`}
                >
                  Carte
                </button>
              </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
              <div
                ref={listRef}
                className={showList ? "space-y-4" : "hidden"}
              >
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
                  {barbers.map((barber) => {
                    const selected = barber.id === selectedId;
                    return (
                      <article
                        key={barber.id}
                        data-barber-id={barber.id}
                        className={`relative rounded-2xl bg-white p-5 shadow transition ${
                          selected
                            ? "ring-2 ring-brand-500"
                            : "hover:shadow-md"
                        }`}
                      >
                        {/* Zone d'action pleine carte : sélectionne le marqueur. */}
                        <button
                          type="button"
                          onClick={() => setSelectedId(barber.id)}
                          aria-label={`Afficher ${barber.displayName} sur la carte`}
                          aria-pressed={selected}
                          className="absolute inset-0 z-0 rounded-2xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500"
                        />
                        <div className="pointer-events-none relative z-10">
                          <h2 className="text-lg font-semibold text-brand-900">
                            {barber.displayName}
                          </h2>
                          <p className="mt-1 text-sm text-gray-600">
                            {barber.city}
                            {barber.countryCode
                              ? `, ${
                                  COUNTRY_NAME_BY_CODE[barber.countryCode] ??
                                  barber.countryCode
                                }`
                              : ""}
                          </p>
                          <p className="mt-1 text-sm text-gray-600">
                            {barber.activeServiceCount} service(s) actif(s)
                          </p>
                          {(barber.audiences.length > 0 ||
                            barber.techniques.length > 0) && (
                            <div className="mt-2 flex flex-wrap gap-1">
                              {audienceChips(barber.audiences).map((label) => (
                                <span
                                  key={label}
                                  className="rounded-full bg-brand-100 px-2 py-0.5 text-xs text-brand-800"
                                >
                                  {label}
                                </span>
                              ))}
                              {barber.techniques.map((code) => (
                                <span
                                  key={code}
                                  className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-700"
                                >
                                  {TECHNIQUE_LABELS[code]}
                                </span>
                              ))}
                            </div>
                          )}
                          {barber.places.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-1">
                              {barber.places.map((place) => (
                                <span
                                  key={place}
                                  className="rounded-full bg-white px-2 py-0.5 text-xs text-gray-700 ring-1 ring-gray-300"
                                >
                                  {SERVICE_PLACE_LABELS[place]}
                                </span>
                              ))}
                            </div>
                          )}
                          <Link
                            to={`/barbers/${barber.id}`}
                            className="pointer-events-auto mt-3 inline-block rounded-lg border border-brand-700 px-3 py-1.5 text-sm text-brand-700"
                          >
                            Voir le profil
                          </Link>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </div>

              <div className={showMap ? "" : "hidden"}>
                <div className="lg:sticky lg:top-6">
                  <div
                    role="region"
                    aria-label="Carte des barbiers (résultats de cette page)"
                    className="relative h-72 overflow-hidden rounded-2xl bg-white shadow lg:h-[34rem]"
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
                            className="flex h-full items-center justify-center p-6 text-center text-sm text-gray-600"
                          >
                            La carte n'a pas pu être affichée. La liste des
                            résultats reste utilisable.
                          </div>
                        }
                      >
                        <Suspense
                          fallback={
                            <div className="flex h-full items-center justify-center text-sm text-gray-500">
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
                    <p className="pointer-events-none absolute left-3 top-3 z-10 rounded-full bg-white/90 px-3 py-1 text-xs text-gray-600 shadow-sm">
                      Carte : résultats de cette page · {APPROXIMATE_LOCATION_LABEL}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {pagination && pagination.totalPages > 0 && (
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  disabled={!canPrev}
                  onClick={() => goToPage(page - 1)}
                  className="rounded-lg border border-brand-700 px-4 py-2 text-brand-700 disabled:opacity-40"
                >
                  Précédent
                </button>
                <span className="text-sm text-gray-600">
                  Page {pagination.page} / {pagination.totalPages}
                </span>
                <button
                  type="button"
                  disabled={!canNext}
                  onClick={() => goToPage(page + 1)}
                  className="rounded-lg border border-brand-700 px-4 py-2 text-brand-700 disabled:opacity-40"
                >
                  Suivant
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
