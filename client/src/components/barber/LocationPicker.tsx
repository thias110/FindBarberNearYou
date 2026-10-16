import { lazy, Suspense, useEffect, useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { AddressSuggestion } from "@findbarber/shared/types";
import { useTheme } from "../../app/theme-context";
import { ApiError, barberApi } from "../../lib/apiClient";
import { cn } from "../../lib/cn";
import { MapErrorBoundary } from "../MapErrorBoundary";
import { Input } from "../ui/Input";
import type { MapPosition } from "./LocationMap";

const LocationMap = lazy(() => import("./LocationMap"));

const SEARCH_DEBOUNCE_MS = 350;
const MIN_QUERY_LENGTH = 3;

interface LocationPickerProps {
  position: MapPosition | null;
  onChange: (position: MapPosition) => void;
  /** Pays du profil : restreint les suggestions d'adresse. */
  countryCode: string;
  /** Recherche proposée à l'ouverture (adresse et ville déjà saisies). */
  initialQuery: string;
  error?: string;
}

/**
 * Position du profil sans latitude ni longitude à saisir (issue #45) : le
 * barber choisit une adresse suggérée (géocodage côté serveur) ou clique sur la
 * carte de prévisualisation. Sans carte disponible, la recherche suffit.
 */
export function LocationPicker({
  position,
  onChange,
  countryCode,
  initialQuery,
  error,
}: LocationPickerProps) {
  const { t } = useTranslation("barber");
  const { resolvedTheme } = useTheme();
  const id = useId();
  const listId = `${id}-suggestions`;
  const errorId = `${id}-error`;
  const statusId = `${id}-status`;
  const [query, setQuery] = useState(initialQuery);
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [chosenLabel, setChosenLabel] = useState<string | null>(null);
  const [mapUnavailable, setMapUnavailable] = useState(false);
  // Pas de recherche automatique tant que le barber n'a pas modifié la saisie
  // ou demandé la recherche (évite un appel à chaque ouverture de l'étape).
  const touched = useRef(false);
  // Relance explicite de la recherche (focus sur l'adresse déjà proposée).
  const [searchRequest, setSearchRequest] = useState(0);

  useEffect(() => {
    if (!touched.current) return;
    const trimmed = query.trim();
    if (trimmed.length < MIN_QUERY_LENGTH) {
      setSuggestions([]);
      setSearchError(null);
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setSearching(true);
      barberApi
        .suggestAddresses(trimmed, countryCode, controller.signal)
        .then((res) => {
          setSuggestions(res.suggestions);
          setSearchError(
            res.suggestions.length === 0
              ? t("location.noResults")
              : null,
          );
        })
        .catch((err: unknown) => {
          if (controller.signal.aborted) return;
          setSuggestions([]);
          setSearchError(
            err instanceof ApiError && err.code === "GEOCODING_UNAVAILABLE"
              ? t("location.geocodingUnavailable")
              : err instanceof Error
                ? err.message
                : t("location.searchFailed"),
          );
        })
        .finally(() => {
          if (!controller.signal.aborted) setSearching(false);
        });
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
    // `t` change avec la langue : pas de nouvelle recherche pour autant.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, countryCode, searchRequest]);

  function choose(suggestion: AddressSuggestion) {
    onChange({ latitude: suggestion.latitude, longitude: suggestion.longitude });
    setChosenLabel(suggestion.label);
    setSuggestions([]);
    setSearchError(null);
  }

  const describedBy = [error ? errorId : null, statusId].filter(Boolean).join(" ");

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <label htmlFor={`${id}-search`} className="block text-sm font-semibold text-foreground">
          {t("location.searchLabel")}
        </label>
        <Input
          id={`${id}-search`}
          type="search"
          autoComplete="off"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={suggestions.length > 0}
          aria-controls={listId}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          value={query}
          placeholder={t("location.searchPlaceholder")}
          onChange={(event) => {
            touched.current = true;
            setQuery(event.target.value);
          }}
          onFocus={() => {
            // Première prise de focus : propose l'adresse déjà saisie.
            if (!touched.current && query.trim().length >= MIN_QUERY_LENGTH) {
              touched.current = true;
              setSearchRequest((count) => count + 1);
            }
          }}
        />
        <p className="text-sm text-foreground-muted">
          {t("location.hint")}
        </p>
      </div>

      <ul
        id={listId}
        role="listbox"
        aria-label={t("location.suggestionsLabel")}
        className={cn("space-y-1", suggestions.length === 0 && "hidden")}
      >
        {suggestions.map((suggestion) => (
          <li key={`${suggestion.label}-${suggestion.latitude}-${suggestion.longitude}`} role="option" aria-selected={false}>
            <button
              type="button"
              onClick={() => choose(suggestion)}
              className="min-h-11 w-full rounded-xl border border-border px-3 py-2 text-left text-sm text-foreground hover:border-accent/60 focus-ring"
            >
              {suggestion.label}
            </button>
          </li>
        ))}
      </ul>

      <p id={statusId} role="status" className="text-sm text-foreground-muted">
        {searching
          ? t("location.searching")
          : searchError
            ? searchError
            : position
              ? chosenLabel
                ? t("location.savedAddress", { label: chosenLabel })
                : t("location.setOnMap")
              : t("location.none")}
      </p>
      {error && (
        <p id={errorId} className="text-sm text-danger">
          {error}
        </p>
      )}

      {mapUnavailable ? (
        <p className="rounded-xl border border-border p-3 text-sm text-foreground-muted">
          {t("location.mapUnavailable")}
        </p>
      ) : (
        <MapErrorBoundary
          fallback={
            <p className="rounded-xl border border-border p-3 text-sm text-foreground-muted">
              {t("location.mapUnavailable")}
            </p>
          }
        >
          <Suspense fallback={<div className="h-64 w-full rounded-xl border border-border bg-surface-muted" />}>
            <LocationMap
              position={position}
              onPick={(next) => {
                onChange(next);
                setChosenLabel(null);
              }}
              theme={resolvedTheme}
              onUnavailable={() => setMapUnavailable(true)}
            />
          </Suspense>
        </MapErrorBoundary>
      )}
    </div>
  );
}
