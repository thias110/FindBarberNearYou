import { LIMITS, type Currency } from "@findbarber/shared/constants";

/**
 * Convertit une saisie prix ("25.50" ou "25,50") en unités mineures entières
 * sans calcul flottant (`parseFloat(value) * 100` est interdit).
 * Retourne `null` pour les valeurs invalides, négatives ou à plus de 2 décimales.
 */
export function parsePriceToMinor(input: string): number | null {
  const normalized = input.trim().replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) {
    return null;
  }
  const [whole, fraction = ""] = normalized.split(".");
  const major = Number(whole);
  const minor = Number(fraction.padEnd(2, "0"));
  const result = major * 100 + minor;
  if (!Number.isSafeInteger(result)) {
    return null;
  }
  if (
    result < LIMITS.servicePriceMinorMin ||
    result > LIMITS.servicePriceMinorMax
  ) {
    return null;
  }
  return result;
}

/** Inverse de `parsePriceToMinor`, sans flottant, pour pré-remplir un champ. */
export function minorToInputValue(priceMinor: number): string {
  const sign = priceMinor < 0 ? "-" : "";
  const abs = Math.abs(priceMinor);
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
}

/** Affiche un montant avec le code devise (CHF, EUR, USD) pour éviter tout symbole ambigu. */
export function formatCurrency(priceMinor: number, currency: Currency): string {
  return new Intl.NumberFormat("fr-CH", {
    style: "currency",
    currency,
    currencyDisplay: "code",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(priceMinor / 100);
}

/** Affiche un instant ISO 8601 dans le fuseau local du visiteur. */
export function formatDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat("fr-CH", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) {
    return `${minutes} min`;
  }
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} h` : `${hours} h ${String(rest).padStart(2, "0")}`;
}
