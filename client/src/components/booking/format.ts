import { intlLocale } from "../../i18n";

// Affichage des jours civils du tunnel de réservation. Une date `AAAA-MM-JJ`
// est formatée en UTC à partir de ses composantes : aucun décalage de fuseau.

function utcMs(date: string): number {
  const [year, month, day] = date.split("-").map(Number);
  return Date.UTC(year, month - 1, day);
}

function format(date: string, options: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat(intlLocale(), {
    timeZone: "UTC",
    ...options,
  }).format(utcMs(date));
}

/** « lun. » */
export function formatWeekdayShort(date: string): string {
  return format(date, { weekday: "short" });
}

/** « 20 » */
export function formatDayNumber(date: string): string {
  return format(date, { day: "numeric" });
}

/** « lundi 20 octobre » */
export function formatDayLong(date: string): string {
  return format(date, { weekday: "long", day: "numeric", month: "long" });
}

/** « lundi 20 octobre 2026 » */
export function formatDayFull(date: string): string {
  return format(date, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/** « 20 oct. – 26 oct. 2026 » */
export function formatWeekRange(first: string, last: string): string {
  const start = format(first, { day: "numeric", month: "short" });
  const end = format(last, { day: "numeric", month: "short", year: "numeric" });
  return `${start} – ${end}`;
}
