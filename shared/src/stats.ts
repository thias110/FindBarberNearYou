// --- Statistiques d'activité du barber (issue #20) ---
// Calcul PUR, sans accès base : le service fournit des réservations déjà
// pré-filtrées sur une fenêtre UTC large, les premières réservations par client
// et la note moyenne globale. Cette fonction fait le bucketing dans le fuseau du
// professionnel (jours, semaines, mois et heures locaux, DST compris) et ne
// renvoie que des agrégats — aucune donnée personnelle de client.

import type {
  BarberStatsBucket,
  BarberStatsResponse,
  BarberStatsRevenueBucket,
  BarberStatsTopService,
} from "./types";
import {
  STATS_LIMITS,
  WEEKDAY_LABELS,
  type BookingStatus,
  type Currency,
  type Weekday,
} from "./constants";
import {
  calendarDateToUtcMillis,
  inclusiveDayCount,
  weekdayFromCalendarDate,
} from "./dates";
import { utcToZonedParts } from "./timezones";

const MS_PER_DAY = 86_400_000;

const MONTH_LABELS = [
  "janvier",
  "février",
  "mars",
  "avril",
  "mai",
  "juin",
  "juillet",
  "août",
  "septembre",
  "octobre",
  "novembre",
  "décembre",
] as const;

export interface StatsBookingRow {
  startAt: Date;
  status: BookingStatus;
  priceMinor: number;
  serviceName: string;
  clientUserId: string;
  cancelledBy: string | null;
  createdAt: Date;
}

export interface ComputeBarberStatsInput {
  timezone: string;
  currency: Currency;
  fromDate: string;
  toDate: string;
  bookings: StatsBookingRow[];
  /** Première réservation (createdAt min) de chaque client, tous temps. */
  firstBookingByClient: ReadonlyMap<string, Date>;
  rating: { averageRating: number | null; totalReviews: number };
}

function addDays(date: string, days: number): string {
  return new Date(calendarDateToUtcMillis(date) + days * MS_PER_DAY)
    .toISOString()
    .slice(0, 10);
}

// ISO 8601 : la semaine 1 contient le premier jeudi de l'année.
function isoWeekKey(date: string): string {
  const ms = calendarDateToUtcMillis(date);
  const weekday = weekdayFromCalendarDate(date); // 1 (lundi) … 7 (dimanche)
  const thursday = new Date(ms + (4 - weekday) * MS_PER_DAY);
  const yearStart = new Date(Date.UTC(thursday.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(
    ((thursday.getTime() - yearStart.getTime()) / MS_PER_DAY + 1) / 7,
  );
  return `${thursday.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

function weekLabel(key: string): string {
  const [year, week] = key.split("-W");
  return `Semaine ${week} · ${year}`;
}

function monthLabel(key: string): string {
  const month = Number(key.slice(5, 7));
  return `${MONTH_LABELS[month - 1]} ${key.slice(0, 4)}`;
}

function round4(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}

export function computeBarberStats(
  input: ComputeBarberStatsInput,
): BarberStatsResponse {
  const {
    timezone,
    currency,
    fromDate,
    toDate,
    bookings,
    firstBookingByClient,
    rating,
  } = input;

  // Buckets complets (même vides) pour un rendu client stable, dans l'ordre.
  const weekKeys: string[] = [];
  const monthKeys: string[] = [];
  const seenWeeks = new Set<string>();
  const seenMonths = new Set<string>();
  // Itération bornée par le nombre de jours inclus : `addDays` ne dépasse
  // jamais `toDate`, donc aucun débordement d'année (9999-12-31 inclus).
  const totalDays = inclusiveDayCount(fromDate, toDate);
  for (let i = 0; i < totalDays; i += 1) {
    const date = addDays(fromDate, i);
    const week = isoWeekKey(date);
    if (!seenWeeks.has(week)) {
      seenWeeks.add(week);
      weekKeys.push(week);
    }
    const month = date.slice(0, 7);
    if (!seenMonths.has(month)) {
      seenMonths.add(month);
      monthKeys.push(month);
    }
  }

  const byWeek = new Map<string, number>();
  const byMonth = new Map<string, number>();
  const revenueByMonthMap = new Map<string, number>();
  const byWeekday = new Map<string, number>();
  const byHour = new Map<string, number>();
  const byService = new Map<string, { count: number; revenueMinor: number }>();

  const totals = {
    bookings: 0,
    completed: 0,
    cancelled: 0,
    refused: 0,
    revenueMinor: 0,
  };
  const periodClients = new Set<string>();

  const bump = (map: Map<string, number>, key: string, amount = 1): void => {
    map.set(key, (map.get(key) ?? 0) + amount);
  };

  for (const booking of bookings) {
    const local = utcToZonedParts(booking.startAt, timezone);
    const date = local.date;
    // La fenêtre SQL est volontairement large ; le filtre local fait foi.
    if (date < fromDate || date > toDate) continue;

    totals.bookings += 1;
    periodClients.add(booking.clientUserId);

    bump(byWeek, isoWeekKey(date));
    bump(byMonth, date.slice(0, 7));

    // Top services : toutes les réservations comptent, y compris annulées.
    const service = byService.get(booking.serviceName) ?? {
      count: 0,
      revenueMinor: 0,
    };
    service.count += 1;
    if (booking.status === "COMPLETED") {
      service.revenueMinor += booking.priceMinor;
    }
    byService.set(booking.serviceName, service);

    if (booking.status === "COMPLETED") {
      totals.completed += 1;
      totals.revenueMinor += booking.priceMinor;
      bump(revenueByMonthMap, date.slice(0, 7), booking.priceMinor);
    }

    if (booking.status === "CANCELLED") {
      totals.cancelled += 1;
      if (booking.cancelledBy === "BARBER") totals.refused += 1;
    }

    // Jours/heures chargés : toutes les réservations sauf annulées.
    if (booking.status !== "CANCELLED") {
      bump(byWeekday, String(weekdayFromCalendarDate(date)));
      bump(byHour, String(Math.floor(local.minuteOfDay / 60)));
    }
  }

  let newClients = 0;
  let returningClients = 0;
  for (const clientId of periodClients) {
    const first = firstBookingByClient.get(clientId);
    if (!first) {
      newClients += 1;
      continue;
    }
    const firstDate = utcToZonedParts(first, timezone).date;
    if (firstDate >= fromDate && firstDate <= toDate) {
      newClients += 1;
    } else {
      returningClients += 1;
    }
  }

  const cancellationRate =
    totals.bookings === 0 ? 0 : round4(totals.cancelled / totals.bookings);
  const refusalRate =
    totals.bookings === 0 ? 0 : round4(totals.refused / totals.bookings);

  const toBuckets = (
    keys: string[],
    counts: Map<string, number>,
    label: (key: string) => string,
  ): BarberStatsBucket[] =>
    keys.map((key) => ({ key, label: label(key), count: counts.get(key) ?? 0 }));

  const appointmentsByWeek = toBuckets(weekKeys, byWeek, weekLabel);
  const appointmentsByMonth = toBuckets(monthKeys, byMonth, monthLabel);

  const revenueByMonthBuckets: BarberStatsRevenueBucket[] = monthKeys.map(
    (key) => ({
      key,
      label: monthLabel(key),
      revenueMinor: revenueByMonthMap.get(key) ?? 0,
    }),
  );

  const topServices: BarberStatsTopService[] = [...byService.entries()]
    .map(([serviceName, value]) => ({
      serviceName,
      count: value.count,
      revenueMinor: value.revenueMinor,
    }))
    .sort((a, b) => b.count - a.count || a.serviceName.localeCompare(b.serviceName))
    .slice(0, STATS_LIMITS.topServicesLimit);

  const busiestWeekdays: BarberStatsBucket[] = ([1, 2, 3, 4, 5, 6, 7] as Weekday[]).map(
    (day) => ({
      key: String(day),
      label: WEEKDAY_LABELS[day],
      count: byWeekday.get(String(day)) ?? 0,
    }),
  );

  const busiestHours: BarberStatsBucket[] = Array.from(
    { length: 24 },
    (_, hour) => ({
      key: String(hour),
      label: `${String(hour).padStart(2, "0")}:00`,
      count: byHour.get(String(hour)) ?? 0,
    }),
  );

  return {
    currency,
    period: { from: fromDate, to: toDate, timezone },
    totals,
    rates: { cancellationRate, refusalRate },
    appointmentsByWeek,
    appointmentsByMonth,
    revenueByMonth: revenueByMonthBuckets,
    topServices,
    busiestWeekdays,
    busiestHours,
    rating,
    clients: { newClients, returningClients },
  };
}
