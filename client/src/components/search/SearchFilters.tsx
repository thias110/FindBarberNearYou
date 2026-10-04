import type { FormEvent } from "react";
import { COUNTRIES } from "@findbarber/shared/countries";
import {
  AUDIENCES,
  AUDIENCE_LABELS,
  SERVICE_PLACES,
  SERVICE_PLACE_LABELS,
  TECHNIQUES,
  TECHNIQUE_LABELS,
} from "@findbarber/shared/constants";
import { cn } from "../../lib/cn";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { Field } from "../ui/Field";
import { Input } from "../ui/Input";

export interface SearchFiltersValues {
  q: string;
  city: string;
  countryCode: string;
  audience: string;
  technique: string;
  place: string;
}

interface SearchFiltersProps {
  form: SearchFiltersValues;
  onChange: (next: SearchFiltersValues) => void;
  onSubmit: (event: FormEvent) => void;
  onReset: () => void;
  filtersOpen: boolean;
  onToggleFilters: () => void;
  extraFilterCount: number;
  /** `true` à partir de lg : le panneau avancé est toujours visible. */
  advancedVisible: boolean;
}

const COUNTRIES_SORTED = [...COUNTRIES].sort((a, b) =>
  a.nameFr.localeCompare(b.nameFr, "fr"),
);

// Selects HTML natifs (aucun composant Select dédié) stylés avec les tokens.
const SELECT_CLASSES =
  "block w-full min-h-[44px] rounded-lg border border-border bg-surface-muted px-3 py-2 text-sm text-foreground " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent " +
  "focus-visible:ring-offset-2 focus-visible:ring-offset-background";

export function SearchFilters({
  form,
  onChange,
  onSubmit,
  onReset,
  filtersOpen,
  onToggleFilters,
  extraFilterCount,
  advancedVisible,
}: SearchFiltersProps) {
  function update<K extends keyof SearchFiltersValues>(
    key: K,
    value: SearchFiltersValues[K],
  ) {
    onChange({ ...form, [key]: value });
  }

  return (
    <Card className="p-4 sm:p-5">
      <form onSubmit={onSubmit} className="space-y-3">
        {/* Ligne toujours visible : ville + recherche + accès aux filtres. */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <Field label="Ville" className="min-w-0 flex-1">
            {(control) => (
              <Input
                {...control}
                value={form.city}
                onChange={(event) => update("city", event.target.value)}
                placeholder="Ville"
                autoComplete="address-level2"
                className="min-h-[44px] bg-surface-muted"
              />
            )}
          </Field>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" className="min-h-[44px]">
              Rechercher
            </Button>
            <Button
              type="button"
              variant="secondary"
              className="min-h-[44px] lg:hidden"
              aria-expanded={filtersOpen}
              aria-controls="advanced-filters"
              data-active-filters={extraFilterCount}
              onClick={onToggleFilters}
            >
              Filtres
              {extraFilterCount > 0 && (
                <span className="inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-accent px-1.5 text-xs font-medium text-accent-foreground">
                  {extraFilterCount}
                </span>
              )}
            </Button>
            <Button
              type="button"
              variant="secondary"
              className="min-h-[44px]"
              onClick={onReset}
            >
              Réinitialiser
            </Button>
          </div>
        </div>

        {/* Panneau avancé : dépliable sur mobile, toujours visible en desktop. */}
        <div
          id="advanced-filters"
          className={cn(
            "grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-5",
            advancedVisible || filtersOpen ? "grid" : "hidden",
          )}
        >
          <Field label="Nom" className="min-w-0">
            {(control) => (
              <Input
                {...control}
                value={form.q}
                onChange={(event) => update("q", event.target.value)}
                placeholder="Nom du barbier"
                className="min-h-[44px] bg-surface-muted"
              />
            )}
          </Field>
          <label className="block min-w-0">
            <span className="mb-1 block text-sm font-medium text-foreground">
              Pays
            </span>
            <select
              value={form.countryCode}
              onChange={(event) => update("countryCode", event.target.value)}
              className={SELECT_CLASSES}
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
            <span className="mb-1 block text-sm font-medium text-foreground">
              Public
            </span>
            <select
              value={form.audience}
              onChange={(event) => update("audience", event.target.value)}
              className={SELECT_CLASSES}
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
            <span className="mb-1 block text-sm font-medium text-foreground">
              Prestation
            </span>
            <select
              value={form.technique}
              onChange={(event) => update("technique", event.target.value)}
              className={SELECT_CLASSES}
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
            <span className="mb-1 block text-sm font-medium text-foreground">
              Lieu
            </span>
            <select
              value={form.place}
              onChange={(event) => update("place", event.target.value)}
              className={SELECT_CLASSES}
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
    </Card>
  );
}
