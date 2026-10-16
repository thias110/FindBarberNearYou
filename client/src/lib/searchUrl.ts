import {
  AUDIENCES,
  DEFAULT_CURRENCY,
  SERVICE_PLACES,
  SUPPORTED_CURRENCIES,
  TECHNIQUES,
  type Audience,
  type Currency,
  type ServicePlace,
  type Technique,
} from "@findbarber/shared/constants";
import i18n from "../i18n";
import { label } from "./labels";

// État de la recherche lu depuis l'URL (source de vérité, partageable). La
// position du visiteur n'y figure jamais : seul le rayon choisi y est.

export interface SearchUrlState {
  city: string;
  // Filtres hérités de liens (accueil, anciennes URL), affichés comme pastilles.
  q: string;
  audience: string;
  technique: string;
  place: string;
  // Filtres « intelligents » (issue #52).
  maxPrice: number | null;
  currency: Currency;
  minRating: number | null;
  radiusKm: number | null;
  page: number;
}

export const MAX_RADIUS_KM = 100;

function normalizeCode(value: string | null): string {
  return (value ?? "").trim().toUpperCase();
}

function positiveInt(value: string | null, max: number): number | null {
  if (value === null || value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 1 && parsed <= max ? parsed : null;
}

export function parseSearchUrl(sp: URLSearchParams): SearchUrlState {
  const currency = normalizeCode(sp.get("currency"));
  return {
    city: sp.get("city") ?? "",
    q: sp.get("q") ?? "",
    audience: normalizeCode(sp.get("audience")),
    technique: normalizeCode(sp.get("technique")),
    place: normalizeCode(sp.get("place")),
    maxPrice: positiveInt(sp.get("maxPrice"), 10_000),
    currency: (SUPPORTED_CURRENCIES as readonly string[]).includes(currency)
      ? (currency as Currency)
      : DEFAULT_CURRENCY,
    minRating: positiveInt(sp.get("minRating"), 5),
    radiusKm: positiveInt(sp.get("radiusKm"), MAX_RADIUS_KM),
    page: positiveInt(sp.get("page"), 10_000) ?? 1,
  };
}

/** Pastilles des filtres hérités (retirables), dans un ordre stable. */
export function legacyFilterTags(state: SearchUrlState): { key: string; label: string }[] {
  const tags: { key: string; label: string }[] = [];
  if (state.technique && (TECHNIQUES as readonly string[]).includes(state.technique)) {
    tags.push({
      key: "technique",
      label: i18n.t("client:search.tags.technique", {
        value: label("technique", state.technique as Technique),
      }),
    });
  }
  if (state.audience && (AUDIENCES as readonly string[]).includes(state.audience)) {
    tags.push({
      key: "audience",
      label: i18n.t("client:search.tags.audience", {
        value: label("audience", state.audience as Audience),
      }),
    });
  }
  if (state.place && (SERVICE_PLACES as readonly string[]).includes(state.place)) {
    tags.push({
      key: "place",
      label: i18n.t("client:search.tags.place", {
        value: label("servicePlace", state.place as ServicePlace),
      }),
    });
  }
  if (state.q.trim()) {
    tags.push({
      key: "q",
      label: i18n.t("client:search.tags.name", { value: state.q.trim() }),
    });
  }
  return tags;
}
