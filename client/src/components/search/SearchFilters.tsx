import type { FormEvent, ReactNode } from "react";
import { useTranslation } from "react-i18next";
import {
  SUPPORTED_CURRENCIES,
  type Currency,
} from "@findbarber/shared/constants";
import type { VisitorPositionStatus } from "../../lib/visitorPosition";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { Field } from "../ui/Field";
import { Input } from "../ui/Input";
import { Sheet } from "../ui/Sheet";
import { chipClasses } from "../ui/chipStyles";
import { CONTROL_CLASS } from "../ui/control";

// Filtres « intelligents » (issue #52) : uniquement prix, distance et note
// minimale, chacun appliqué en un geste (sans bouton « Rechercher »). Une
// chaîne vide = filtre inactif.
export interface SmartFilters {
  maxPrice: string;
  currency: Currency;
  minRating: string;
  radiusKm: string;
}

/** Filtre hérité d'un lien (ex. prestation populaire de l'accueil), retirable. */
export interface ActiveTag {
  key: string;
  label: string;
}

export const PRICE_OPTIONS = [20, 30, 50, 80] as const;
export const RADIUS_OPTIONS = [2, 5, 10, 25] as const;
export const RATING_OPTIONS = [3, 4, 5] as const;

interface SearchFiltersProps {
  city: string;
  onCityChange: (city: string) => void;
  onSubmit: (event: FormEvent) => void;
  onReset: () => void;
  filters: SmartFilters;
  onFiltersChange: (next: SmartFilters) => void;
  activeTags: ActiveTag[];
  onRemoveTag: (key: string) => void;
  positionStatus: VisitorPositionStatus;
  filtersOpen: boolean;
  onToggleFilters: () => void;
  /** `true` à partir de lg : le panneau de filtres est toujours visible. */
  advancedVisible: boolean;
  /** Nombre de résultats, pour le bouton « Afficher 24 barbers » (mobile). */
  resultCount?: number | null;
}

function ChipGroup({ legend, children }: { legend: string; children: ReactNode }) {
  return (
    <fieldset className="min-w-0">
      <legend className="mb-1.5 text-sm font-semibold text-foreground">{legend}</legend>
      <div className="flex flex-wrap gap-2">{children}</div>
    </fieldset>
  );
}

export function SearchFilters({
  city,
  onCityChange,
  onSubmit,
  onReset,
  filters,
  onFiltersChange,
  activeTags,
  onRemoveTag,
  positionStatus,
  filtersOpen,
  onToggleFilters,
  advancedVisible,
  resultCount = null,
}: SearchFiltersProps) {
  const { t } = useTranslation("client");
  function update<K extends keyof SmartFilters>(key: K, value: SmartFilters[K]) {
    onFiltersChange({ ...filters, [key]: value });
  }

  // Un second clic sur la pastille active retire le filtre.
  function toggle(key: "maxPrice" | "minRating" | "radiusKm", value: number) {
    update(key, filters[key] === String(value) ? "" : String(value));
  }

  const activeCount = [filters.maxPrice, filters.minRating, filters.radiusKm].filter(
    (value) => value !== "",
  ).length;
  const distanceBlocked =
    positionStatus === "denied" || positionStatus === "unavailable";

  const advancedFilters = (
    <>
          <ChipGroup legend={t("search.filters.maxPrice")}>
            <label className="w-24">
              <span className="sr-only">{t("search.filters.maxPriceCurrency")}</span>
              <select
                value={filters.currency}
                onChange={(event) =>
                  update("currency", event.target.value as Currency)
                }
                className={CONTROL_CLASS}
              >
                {SUPPORTED_CURRENCIES.map((code) => (
                  <option key={code} value={code}>
                    {code}
                  </option>
                ))}
              </select>
            </label>
            {PRICE_OPTIONS.map((price) => (
              <button
                key={price}
                type="button"
                aria-pressed={filters.maxPrice === String(price)}
                onClick={() => toggle("maxPrice", price)}
                className={chipClasses(filters.maxPrice === String(price))}
              >
                ≤ {price} {filters.currency}
              </button>
            ))}
          </ChipGroup>

          <ChipGroup legend={t("search.filters.distance")}>
            {RADIUS_OPTIONS.map((radius) => (
              <button
                key={radius}
                type="button"
                disabled={distanceBlocked}
                aria-pressed={filters.radiusKm === String(radius)}
                aria-describedby="distance-help"
                onClick={() => toggle("radiusKm", radius)}
                className={chipClasses(filters.radiusKm === String(radius))}
              >
                {radius} km
              </button>
            ))}
            <p id="distance-help" className="w-full text-xs text-foreground-muted">
              {positionStatus === "denied"
                ? t("search.filters.distanceHelp.denied")
                : positionStatus === "unavailable"
                  ? t("search.filters.distanceHelp.unavailable")
                  : positionStatus === "pending"
                    ? t("search.filters.distanceHelp.pending")
                    : positionStatus === "granted"
                      ? t("search.filters.distanceHelp.granted")
                      : t("search.filters.distanceHelp.idle")}
            </p>
          </ChipGroup>

          <ChipGroup legend={t("search.filters.minRating")}>
            {RATING_OPTIONS.map((rating) => (
              <button
                key={rating}
                type="button"
                aria-pressed={filters.minRating === String(rating)}
                aria-label={
                  rating === 5
                    ? t("search.filters.ratingMaxAria")
                    : t("search.filters.ratingAria", { rating })
                }
                onClick={() => toggle("minRating", rating)}
                className={chipClasses(filters.minRating === String(rating))}
              >
                {rating === 5 ? "5 ★" : t("search.filters.ratingChip", { rating })}
              </button>
            ))}
          </ChipGroup>
    </>
  );

  return (
    <Card className="p-4 sm:p-5">
      <form onSubmit={onSubmit} className="space-y-3" role="search">
        {/* Ligne toujours visible : ville + recherche + accès aux filtres. */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <Field label={t("search.filters.cityLabel")} className="min-w-0 flex-1">
            {(control) => (
              <Input
                {...control}
                value={city}
                onChange={(event) => onCityChange(event.target.value)}
                placeholder={t("search.filters.cityLabel")}
                autoComplete="address-level2"
              />
            )}
          </Field>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" className="min-h-[44px]">
              {t("search.filters.submit")}
            </Button>
            <Button
              type="button"
              variant="secondary"
              className="min-h-[44px] lg:hidden"
              aria-expanded={filtersOpen}
              aria-controls="search-filters"
              data-active-filters={activeCount}
              onClick={onToggleFilters}
            >
              {t("search.filters.toggle")}
              {activeCount > 0 && (
                <span className="inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-accent px-1.5 text-xs font-medium text-accent-foreground">
                  {activeCount}
                </span>
              )}
            </Button>
            <Button
              type="button"
              variant="secondary"
              className="min-h-[44px]"
              onClick={onReset}
            >
              {t("search.filters.reset")}
            </Button>
          </div>
        </div>

        {activeTags.length > 0 && (
          <ul className="flex flex-wrap gap-2" aria-label={t("search.filters.activeTags")}>
            {activeTags.map((tag) => (
              <li key={tag.key}>
                <button
                  type="button"
                  onClick={() => onRemoveTag(tag.key)}
                  className={chipClasses(true, { className: "gap-2" })}
                  aria-label={t("search.filters.removeTag", { label: tag.label })}
                >
                  {tag.label}
                  <span aria-hidden="true">×</span>
                </button>
              </li>
            ))}
          </ul>
        )}

        {/* Desktop : filtres toujours visibles dans le panneau. */}
        {advancedVisible && (
          <div id="search-filters" className="grid grid-cols-1 gap-4">
            {advancedFilters}
          </div>
        )}
      </form>
      {/* Mobile (plan §2.6.3) : feuille de filtres, appliqués en direct, et
          bouton qui annonce le nombre de résultats. */}
      {!advancedVisible && (
        <Sheet
          open={filtersOpen}
          title={t("search.filters.sheet.title")}
          onClose={onToggleFilters}
          footer={
            <>
              <Button variant="link" onClick={onReset}>
                {t("search.filters.reset")}
              </Button>
              <Button onClick={onToggleFilters}>
                {resultCount === null
                  ? t("search.filters.sheet.close")
                  : t("search.filters.sheet.showResults", { count: resultCount })}
              </Button>
            </>
          }
        >
          <div id="search-filters" className="grid grid-cols-1 gap-5 pt-1">
            {advancedFilters}
          </div>
        </Sheet>
      )}
    </Card>
  );
}
