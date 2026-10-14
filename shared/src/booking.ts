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

import { LIMITS, type BookingStatus, type Weekday } from "./constants";
import { isValidCalendarDate, weekdayFromCalendarDate } from "./dates";
import { utcToZonedParts, zonedTimeToUtc } from "./timezones";

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
      // La grille avance en minutes murales, mais la fin réelle se calcule en
      // UTC : un jour de changement d'heure, elle peut dépasser la fin murale
      // de la plage (ex. 01:30 + 60 min → 03:30 le jour du passage à l'été).
      if (!endsWithinInterval(endMs, date, interval.endMinute, timezone)) {
        continue;
      }
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

/** La fin réelle (instant UTC) tombe-t-elle au plus tard à la fin murale de la plage ? */
function endsWithinInterval(
  endMs: number,
  date: string,
  endMinute: number,
  timezone: string,
): boolean {
  const end = utcToZonedParts(new Date(endMs), timezone);
  if (end.date === date) return end.minuteOfDay <= endMinute;
  // Fin exactement à minuit le lendemain, pour une plage ouverte jusqu'à 24:00.
  return endMinute === 1440 && end.minuteOfDay === 0 && end.date > date;
}

// --- Terminaison d'une réservation ---
// Une réservation n'est terminable qu'une fois CONFIRMÉE ET après la fin réelle
// de la prestation (`endAt` atteint). Règle partagée : le serveur fait autorité,
// l'interface s'en sert pour ne pas proposer l'action trop tôt.
export function isBookingEnded(endAt: Date | string, now: Date): boolean {
  const endMs = new Date(endAt).getTime();
  return Number.isFinite(endMs) && endMs <= now.getTime();
}

// --- Machine à états des réservations (lot 4 rouvert) ---
// Source UNIQUE des transitions autorisées et des rôles qui peuvent les
// déclencher. Le serveur la consulte sous verrou de ligne avant chaque UPDATE
// (lui-même gardé par le statut attendu) ; l'interface s'en sert seulement pour
// ne pas proposer d'action impossible. `SYSTEM` = expiration automatique.
// Les statuts sans transition sortante sont terminaux : ils ne reviennent
// jamais en arrière (CANCELLED, DECLINED, EXPIRED, COMPLETED, NO_SHOW).

export type BookingActor = "CLIENT" | "BARBER" | "ADMIN" | "SYSTEM";

export const BOOKING_TRANSITIONS: Record<
  BookingStatus,
  Partial<Record<BookingStatus, readonly BookingActor[]>>
> = {
  PENDING: {
    CONFIRMED: ["BARBER"],
    DECLINED: ["BARBER"],
    CANCELLED: ["CLIENT", "BARBER", "ADMIN"],
    EXPIRED: ["SYSTEM"],
  },
  CONFIRMED: {
    COMPLETED: ["BARBER"],
    CANCELLED: ["CLIENT", "BARBER", "ADMIN"],
  },
  CANCELLED: {},
  COMPLETED: {},
  NO_SHOW: {},
  DECLINED: {},
  EXPIRED: {},
};

export function canTransitionBooking(
  from: BookingStatus,
  to: BookingStatus,
  actor: BookingActor,
): boolean {
  return BOOKING_TRANSITIONS[from][to]?.includes(actor) ?? false;
}

export function isTerminalBookingStatus(status: BookingStatus): boolean {
  return Object.keys(BOOKING_TRANSITIONS[status]).length === 0;
}

const MS_PER_HOUR_BOOKING = 3_600_000;

/**
 * Échéance d'une demande PENDING : 24 h après sa création, ou le début du
 * rendez-vous s'il arrive avant (une demande ne peut plus être acceptée une
 * fois le créneau commencé).
 */
export function pendingBookingExpiresAt(
  createdAt: Date | string,
  startAt: Date | string,
  ttlHours: number = LIMITS.bookingPendingTtlHours,
): Date {
  const ttlEnd = new Date(createdAt).getTime() + ttlHours * MS_PER_HOUR_BOOKING;
  return new Date(Math.min(ttlEnd, new Date(startAt).getTime()));
}

/** Une demande PENDING a-t-elle atteint son échéance à l'instant `now` ? */
export function isPendingBookingExpired(
  booking: { status: BookingStatus; createdAt: Date | string; startAt: Date | string },
  now: Date,
): boolean {
  return (
    booking.status === "PENDING" &&
    pendingBookingExpiresAt(booking.createdAt, booking.startAt).getTime() <=
      now.getTime()
  );
}

/** Statut à présenter : une demande échue est montrée EXPIRED avant le balayage. */
export function effectiveBookingStatus(
  booking: { status: BookingStatus; createdAt: Date | string; startAt: Date | string },
  now: Date,
): BookingStatus {
  return isPendingBookingExpired(booking, now) ? "EXPIRED" : booking.status;
}
