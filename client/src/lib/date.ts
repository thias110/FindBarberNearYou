import { intlLocale } from "../i18n";

// --- Affichage des dates civiles (lot 7, issue #22) ---
// Une date `AAAA-MM-JJ` est une donnée civile, pas un instant. On la formate
// donc par découpage de chaîne, sans passer par `new Date(...)`, pour éviter
// tout décalage lié au fuseau du navigateur.

/**
 * « 2026-12-24 » → « 24.12.2026 » en français, « 24/12/2026 » en anglais…
 * (issue #32). Formaté en UTC à partir des composantes : aucun décalage.
 */
export function formatCalendarDate(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return value;
  const utc = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return new Intl.DateTimeFormat(intlLocale(), {
    timeZone: "UTC",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(utc);
}

/** Journée unique → « 24.12.2026 » ; période → « 24.12.2026 – 26.12.2026 ». */
export function formatCalendarDateRange(startDate: string, endDate: string): string {
  if (startDate === endDate) return formatCalendarDate(startDate);
  return `${formatCalendarDate(startDate)} – ${formatCalendarDate(endDate)}`;
}
