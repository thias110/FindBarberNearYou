// --- Moteur de créneaux (lot 9) ---
// Calcul PUR, sans accès base : une date civile, les plages d'ouverture, les
// indisponibilités, les réservations actives et le fuseau du professionnel
// produisent la liste des créneaux UTC disponibles. Aucune dépendance externe.
//
// Règles :
// - les horaires sont des minutes murales locales (comme `barber_working_hours`) ;
// - un créneau est valide si toute la prestation tient dans une plage ouverte ;
// - la grille n'est pas fixe : elle suit la durée de la prestation (pas de pas de
//   15 minutes) ; deux créneaux d'une même prestation ne se chevauchent donc jamais ;
// - les indisponibilités couvrent des journées civiles entières (bornes incluses) ;
// - les réservations actives sont comparées en intervalles semi-ouverts ;
// - la conversion murale→UTC gère le DST ; une heure murale inexistante est ignorée.

import type { Weekday } from "./constants";
import { isValidCalendarDate, weekdayFromCalendarDate } from "./dates";
import { zonedTimeToUtc } from "./timezones";

export interface SlotWorkingInterval {
  weekday: Weekday;
  startMinute: number;
  endMinute: number;
}

export interface SlotTimeOffRange {
  startDate: string;
  endDate: string;
}

export interface SlotBusyInterval {
  startAt: Date;
  endAt: Date;
}

export interface ComputeBookingSlotsInput {
  /** Date civile du rendez-vous, dans le fuseau du professionnel. */
  date: string;
  /** Fuseau IANA du professionnel. */
  timezone: string;
  /** Durée de la prestation en minutes. */
  durationMinutes: number;
  workingHours: SlotWorkingInterval[];
  timeOff: SlotTimeOffRange[];
  /** Réservations actives (PENDING/CONFIRMED) du professionnel. */
  busy: SlotBusyInterval[];
  /** Instant courant (UTC). */
  now: Date;
  leadTimeMinutes: number;
  horizonDays: number;
}

export interface BookingSlot {
  /** Début du créneau, ISO 8601 UTC. */
  startAt: string;
  /** Fin du créneau, ISO 8601 UTC. */
  endAt: string;
  /** Minute murale locale du début (0..1439), telle que saisie par le client. */
  startMinute: number;
}

const MS_PER_DAY = 86_400_000;

/**
 * Créneaux disponibles triés, en UTC. Retourne `[]` si la date est invalide,
 * couverte par une indisponibilité, sans plage ouverte, ou entièrement hors
 * délai/horizon.
 */
export function computeBookingSlots(
  input: ComputeBookingSlotsInput,
): BookingSlot[] {
  const {
    date,
    timezone,
    durationMinutes,
    workingHours,
    timeOff,
    busy,
    now,
    leadTimeMinutes,
    horizonDays,
  } = input;

  if (!isValidCalendarDate(date)) return [];
  if (!Number.isInteger(durationMinutes) || durationMinutes <= 0) {
    return [];
  }

  // Indisponibilité en journée entière (bornes incluses).
  if (timeOff.some((range) => date >= range.startDate && date <= range.endDate)) {
    return [];
  }

  const weekday = weekdayFromCalendarDate(date);
  const intervals = workingHours
    .filter((interval) => interval.weekday === weekday)
    .sort((a, b) => a.startMinute - b.startMinute);
  if (intervals.length === 0) return [];

  const earliest = now.getTime() + leadTimeMinutes * 60_000;
  const latest = now.getTime() + horizonDays * MS_PER_DAY;

  const slots: BookingSlot[] = [];
  for (const interval of intervals) {
    for (
      let minute = interval.startMinute;
      minute + durationMinutes <= interval.endMinute;
      minute += durationMinutes
    ) {
      const start = zonedTimeToUtc(date, minute, timezone);
      if (!start) continue; // heure murale inexistante (DST)
      const startMs = start.getTime();
      if (startMs < earliest || startMs > latest) continue;
      const endMs = startMs + durationMinutes * 60_000;
      const overlaps = busy.some(
        (b) => b.startAt.getTime() < endMs && startMs < b.endAt.getTime(),
      );
      if (overlaps) continue;
      slots.push({
        startAt: start.toISOString(),
        endAt: new Date(endMs).toISOString(),
        startMinute: minute,
      });
    }
  }
  return slots;
}
