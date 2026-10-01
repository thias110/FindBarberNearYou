// --- Dates calendaires (lot 7, issue #22) ---
// Dates civiles « AAAA-MM-JJ » sans fuseau : utilisées pour les indisponibilités
// en journées entières. Aucune conversion depuis le fuseau du navigateur ou du
// serveur, aucun recours à `Date` local, donc aucun effet du DST. Le fuseau du
// professionnel n'est appliqué que plus tard, par le futur moteur de créneaux.

import type { Weekday } from "./constants";

const CALENDAR_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31] as const;

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function daysInMonth(year: number, month: number): number {
  if (month === 2 && isLeapYear(year)) return 29;
  return DAYS_IN_MONTH[month - 1];
}

interface CalendarDateParts {
  year: number;
  month: number;
  day: number;
}

function splitCalendarDate(value: string): CalendarDateParts | null {
  const match = CALENDAR_DATE_PATTERN.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  // Années civiles 0001..9999 : 0000 est refusé (aucune année zéro). Le format à
  // quatre chiffres borne déjà l'année à 9999 ; `setUTCFullYear` ci-dessous
  // traite littéralement les années 0001..0099 (contrairement à `Date.UTC`).
  if (year < 1) return null;
  return {
    year,
    month: Number(match[2]),
    day: Number(match[3]),
  };
}

/**
 * Vrai uniquement pour une date civile réelle au format strict `AAAA-MM-JJ` :
 * mois 1..12, jour compris dans le mois (années bissextiles incluses).
 * Refuse les formats relâchés (« 2026-1-1 ») et les dates inexistantes.
 */
export function isValidCalendarDate(value: string): boolean {
  const parts = splitCalendarDate(value);
  if (!parts) return false;
  const { year, month, day } = parts;
  if (month < 1 || month > 12) return false;
  if (day < 1 || day > daysInMonth(year, month)) return false;
  return true;
}

/** Compare deux dates civiles `AAAA-MM-JJ` (ordre lexicographique = chronologique). */
export function compareCalendarDates(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

// Millisecondes UTC depuis l'epoch, sans passer par un fuseau : `setUTCFullYear`
// gère aussi les années 0000-0099 que `Date.UTC` interpréterait comme 19xx.
// Lève pour une date civile invalide.
export function calendarDateToUtcMillis(value: string): number {
  const parts = splitCalendarDate(value);
  if (!parts) throw new Error(`Date calendaire invalide : ${value}`);
  const date = new Date(0);
  date.setUTCFullYear(parts.year, parts.month - 1, parts.day);
  date.setUTCHours(0, 0, 0, 0);
  return date.getTime();
}

/**
 * Jour ISO-8601 (1 = lundi … 7 = dimanche) d'une date civile `AAAA-MM-JJ`.
 * Calcul en UTC : indépendant du fuseau local. Lève si la date est invalide.
 */
export function weekdayFromCalendarDate(value: string): Weekday {
  const parts = splitCalendarDate(value);
  if (!parts) throw new Error(`Date calendaire invalide : ${value}`);
  const date = new Date(0);
  date.setUTCFullYear(parts.year, parts.month - 1, parts.day);
  date.setUTCHours(0, 0, 0, 0);
  // getUTCDay : 0 = dimanche … 6 = samedi → 1 = lundi … 7 = dimanche.
  return (((date.getUTCDay() + 6) % 7) + 1) as Weekday;
}

/**
 * Nombre de jours inclus dans `[startDate, endDate]` (bornes comprises).
 * Calcul en UTC : insensible au fuseau local et aux changements d'heure.
 * Suppose des dates civiles valides et `startDate <= endDate`.
 */
export function inclusiveDayCount(startDate: string, endDate: string): number {
  const diff =
    calendarDateToUtcMillis(endDate) - calendarDateToUtcMillis(startDate);
  return Math.round(diff / 86_400_000) + 1;
}
