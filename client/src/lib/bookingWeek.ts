// --- Semaines du tunnel de réservation (lot N2) ---
// Fonctions pures sur des dates civiles `AAAA-MM-JJ` : le calcul passe par
// l'UTC et jamais par le fuseau du navigateur, pour qu'un jour ne glisse pas
// lors d'un changement d'heure. La fiche publique ne fournit pas le fuseau du
// salon : « aujourd'hui » est le jour local du navigateur (`toLocalISODate`),
// comme dans l'ancien formulaire ; le serveur reste la source de vérité.

export const WEEK_LENGTH = 7;

const CIVIL_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const MS_PER_DAY = 86_400_000;

function toUtcMs(date: string): number {
  const match = CIVIL_DATE.exec(date);
  if (!match) throw new Error(`Date civile invalide : ${date}`);
  return Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

/** Ajoute des jours calendaires à une date civile (négatif accepté). */
export function addCivilDays(date: string, days: number): string {
  return new Date(toUtcMs(date) + days * MS_PER_DAY).toISOString().slice(0, 10);
}

/** Nombre de jours de `from` à `to` (négatif si `to` précède `from`). */
export function diffCivilDays(from: string, to: string): number {
  return Math.round((toUtcMs(to) - toUtcMs(from)) / MS_PER_DAY);
}

/** Dernier jour réservable, inclus (règle existante : horizon de 60 jours). */
export function maxBookableDate(today: string, horizonDays: number): string {
  return addCivilDays(today, horizonDays);
}

/** Premier jour de la semaine glissante `offset` (0 = commence aujourd'hui). */
export function weekStart(today: string, offset: number): string {
  return addCivilDays(today, offset * WEEK_LENGTH);
}

/** Les `count` jours qui suivent (et incluent) `from`. */
export function weekDates(from: string, count: number = WEEK_LENGTH): string[] {
  return Array.from({ length: count }, (_, index) => addCivilDays(from, index));
}

/** Jours à demander au serveur pour cette semaine, tronqués à l'horizon (0 à 7). */
export function weekRequestDays(
  today: string,
  offset: number,
  horizonDays: number,
): number {
  const remaining =
    diffCivilDays(weekStart(today, offset), maxBookableDate(today, horizonDays)) + 1;
  return Math.max(0, Math.min(WEEK_LENGTH, remaining));
}

/** La flèche « semaine précédente » est inactive sur la semaine en cours. */
export function canGoToPreviousWeek(offset: number): boolean {
  return offset > 0;
}

/** La flèche « semaine suivante » est inactive au-delà de l'horizon. */
export function canGoToNextWeek(
  today: string,
  offset: number,
  horizonDays: number,
): boolean {
  return weekRequestDays(today, offset + 1, horizonDays) > 0;
}

/** Le jour est réservable : ni passé, ni au-delà de l'horizon. */
export function isBookableDate(
  date: string,
  today: string,
  horizonDays: number,
): boolean {
  return (
    diffCivilDays(today, date) >= 0 &&
    diffCivilDays(date, maxBookableDate(today, horizonDays)) >= 0
  );
}
