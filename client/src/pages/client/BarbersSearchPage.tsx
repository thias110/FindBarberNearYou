import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import type { BarbersSearchResponse } from "@findbarber/shared/types";
import { COUNTRIES, COUNTRY_NAME_BY_CODE } from "@findbarber/shared/countries";
import {
  AUDIENCE_LABELS,
  AUDIENCES,
  TECHNIQUE_LABELS,
  TECHNIQUES,
  type Audience,
} from "@findbarber/shared/constants";
import { barbersApi } from "../../lib/apiClient";

const COUNTRIES_SORTED = [...COUNTRIES].sort((a, b) =>
  a.nameFr.localeCompare(b.nameFr, "fr"),
);

interface Filters {
  q: string;
  city: string;
  countryCode: string;
  audience: string;
  technique: string;
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
  };
}

function pageFromParams(sp: URLSearchParams): number {
  const value = Number(sp.get("page") ?? "1");
  return Number.isInteger(value) && value > 0 ? value : 1;
}

function audienceChips(audiences: Audience[]): string[] {
  const labels: string[] = [];
  if (audiences.includes("FEMME") && audiences.includes("HOMME")) {
    labels.push("Mixte");
  } else {
    if (audiences.includes("FEMME")) labels.push(AUDIENCE_LABELS.FEMME);
    if (audiences.includes("HOMME")) labels.push(AUDIENCE_LABELS.HOMME);
  }
  if (audiences.includes("ENFANT")) labels.push(AUDIENCE_LABELS.ENFANT);
  return labels;
}

export function BarbersSearchPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [form, setForm] = useState<Filters>(() => filtersFromParams(searchParams));
  const [data, setData] = useState<BarbersSearchResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const abortRef = useRef<AbortController | null>(null);
  const requestSeq = useRef(0);

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
  const canNext = Boolean(
    pagination && page < (pagination.totalPages || 0),
  );

  return (
    <div className="min-h-screen bg-brand-50 p-4 sm:p-8">
      <div className="mx-auto max-w-4xl space-y-6">
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
          className="space-y-4 rounded-2xl bg-white p-5 shadow"
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="text-sm text-gray-700">Nom</span>
              <input
                value={form.q}
                onChange={(e) => setForm((f) => ({ ...f, q: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
                placeholder="Nom du barbier"
              />
            </label>
            <label className="block">
              <span className="text-sm text-gray-700">Ville</span>
              <input
                value={form.city}
                onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
                placeholder="Ville"
              />
            </label>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <label className="block">
              <span className="text-sm text-gray-700">Pays</span>
              <select
                value={form.countryCode}
                onChange={(e) =>
                  setForm((f) => ({ ...f, countryCode: e.target.value }))
                }
                className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2"
              >
                <option value="">Tous les pays</option>
                {COUNTRIES_SORTED.map((country) => (
                  <option key={country.code} value={country.code}>
                    {country.nameFr}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-sm text-gray-700">Public</span>
              <select
                value={form.audience}
                onChange={(e) =>
                  setForm((f) => ({ ...f, audience: e.target.value }))
                }
                className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2"
              >
                <option value="">Tous les publics</option>
                {AUDIENCES.map((code) => (
                  <option key={code} value={code}>
                    {AUDIENCE_LABELS[code]}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-sm text-gray-700">Prestation</span>
              <select
                value={form.technique}
                onChange={(e) =>
                  setForm((f) => ({ ...f, technique: e.target.value }))
                }
                className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2"
              >
                <option value="">Toutes les prestations</option>
                {TECHNIQUES.map((code) => (
                  <option key={code} value={code}>
                    {TECHNIQUE_LABELS[code]}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              className="rounded-lg bg-brand-700 px-4 py-2 text-white"
            >
              Rechercher
            </button>
            <button
              type="button"
              onClick={handleReset}
              className="rounded-lg border border-gray-300 px-4 py-2 text-gray-700"
            >
              Réinitialiser
            </button>
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
            <p className="text-sm text-gray-600">
              {pagination ? `${pagination.total} résultat(s)` : ""}
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              {data?.barbers.map((barber) => (
                <Link
                  key={barber.id}
                  to={`/barbers/${barber.id}`}
                  className="block rounded-2xl bg-white p-5 shadow transition hover:shadow-md"
                >
                  <h2 className="text-lg font-semibold text-brand-900">
                    {barber.displayName}
                  </h2>
                  <p className="mt-1 text-sm text-gray-600">
                    {barber.city}
                    {barber.countryCode
                      ? `, ${COUNTRY_NAME_BY_CODE[barber.countryCode] ?? barber.countryCode}`
                      : ""}
                  </p>
                  <p className="mt-1 text-sm text-gray-600">
                    {barber.activeServiceCount} service(s) actif(s)
                  </p>
                  {(barber.audiences.length > 0 || barber.techniques.length > 0) && (
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
                </Link>
              ))}
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
