// --- Affichage des dates civiles (lot 7, issue #22) ---
// Une date `AAAA-MM-JJ` est une donnée civile, pas un instant. On la formate
// donc par découpage de chaîne, sans passer par `new Date(...)`, pour éviter
// tout décalage lié au fuseau du navigateur.

/** « 2026-12-24 » → « 24.12.2026 ». */
export function formatCalendarDate(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return value;
  return `${match[3]}.${match[2]}.${match[1]}`;
}

/** Journée unique → « 24.12.2026 » ; période → « 24.12.2026 – 26.12.2026 ». */
export function formatCalendarDateRange(startDate: string, endDate: string): string {
  if (startDate === endDate) return formatCalendarDate(startDate);
  return `${formatCalendarDate(startDate)} – ${formatCalendarDate(endDate)}`;
}
