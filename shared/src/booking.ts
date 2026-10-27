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

import {
  LIMITS,
  type BookingStatus,
  type PaymentMode,
  type Weekday,
} from "./constants";
import {
  calendarDateToUtcMillis,
  isValidCalendarDate,
  weekdayFromCalendarDate,
} from "./dates";
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
    // Absence du client (lot N8) : seulement après le début du rendez-vous
    // (voir `canMarkNoShow`).
    NO_SHOW: ["BARBER"],
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

/** Fenêtre (heures) pendant laquelle le barber peut marquer une absence. */
export const NO_SHOW_WINDOW_HOURS = 48;

/**
 * Le barber peut-il marquer le client absent à l'instant `now` ? Seulement
 * après le début du rendez-vous et dans les `NO_SHOW_WINDOW_HOURS` qui suivent
 * (lot N8). Ne dit rien du statut : à combiner avec `canTransitionBooking`.
 */
export function canMarkNoShow(startAt: Date | string, now: Date): boolean {
  const startMs = new Date(startAt).getTime();
  if (!Number.isFinite(startMs)) return false;
  const nowMs = now.getTime();
  return nowMs >= startMs && nowMs <= startMs + NO_SHOW_WINDOW_HOURS * MS_PER_HOUR_BOOKING;
}

/**
 * Échéance d'une demande PENDING : 24 h après sa création, ou le début du
 * rendez-vous s'il arrive avant (une demande ne peut plus être acceptée une
 * fois le créneau commencé). Une demande en attente de paiement (issue #10) ou
 * de confirmation d'email (lot N6) expire au plus tard à cette échéance
 * (`holdExpiresAt`, voir `earliestHold`).
 */
export function pendingBookingExpiresAt(
  createdAt: Date | string,
  startAt: Date | string,
  ttlHours: number = LIMITS.bookingPendingTtlHours,
  holdExpiresAt: Date | string | null = null,
): Date {
  const ttlEnd = new Date(createdAt).getTime() + ttlHours * MS_PER_HOUR_BOOKING;
  const candidates = [ttlEnd, new Date(startAt).getTime()];
  if (holdExpiresAt) candidates.push(new Date(holdExpiresAt).getTime());
  return new Date(Math.min(...candidates));
}

/** Échéance de blocage la plus proche : paiement (issue #10) ou email (lot N6). */
export function earliestHold(
  paymentExpiresAt: Date | string | null | undefined,
  emailConfirmExpiresAt: Date | string | null | undefined,
): Date | null {
  const times = [paymentExpiresAt, emailConfirmExpiresAt]
    .filter((value): value is Date | string => Boolean(value))
    .map((value) => new Date(value).getTime());
  return times.length > 0 ? new Date(Math.min(...times)) : null;
}

interface PendingLike {
  status: BookingStatus;
  createdAt: Date | string;
  startAt: Date | string;
  paymentExpiresAt?: Date | string | null;
  emailConfirmExpiresAt?: Date | string | null;
}

/** Une demande PENDING a-t-elle atteint son échéance à l'instant `now` ? */
export function isPendingBookingExpired(booking: PendingLike, now: Date): boolean {
  return (
    booking.status === "PENDING" &&
    pendingBookingExpiresAt(
      booking.createdAt,
      booking.startAt,
      LIMITS.bookingPendingTtlHours,
      earliestHold(booking.paymentExpiresAt, booking.emailConfirmExpiresAt),
    ).getTime() <= now.getTime()
  );
}

/** Statut à présenter : une demande échue est montrée EXPIRED avant le balayage. */
export function effectiveBookingStatus(
  booking: PendingLike,
  now: Date,
): BookingStatus {
  return isPendingBookingExpired(booking, now) ? "EXPIRED" : booking.status;
}

// --- Paiement en ligne (issue #10) ---

/** Montant à payer en ligne selon la politique du barber (0 = sur place). */
export function amountDueOnline(
  mode: PaymentMode,
  depositPercent: number,
  priceMinor: number,
): number {
  // Prestation sous le minimum Stripe : payée sur place.
  if (mode === "NONE" || priceMinor < LIMITS.paymentMinAmountMinor) return 0;
  const due =
    mode === "FULL" ? priceMinor : Math.round((priceMinor * depositPercent) / 100);
  // Montant minimal accepté par Stripe : un acompte trop faible est arrondi
  // au minimum, sans jamais dépasser le prix.
  return Math.min(priceMinor, Math.max(due, LIMITS.paymentMinAmountMinor));
}

// --- Disponibilité affichée dans la recherche (lot N1) ---

/** Nombre de jours civils du salon examinés (aujourd'hui compris). */
export const AVAILABILITY_DAYS = 7;

export interface AvailabilitySummary {
  /** Premier créneau libre (ISO UTC) dans les 7 jours du salon, sinon null. */
  nextAvailableAt: string | null;
  /** Un créneau libre existe aujourd'hui, dans le fuseau du salon. */
  availableToday: boolean;
}

export interface SummarizeAvailabilityInput {
  timezone: string;
  /** Durées des prestations actives (distinctes ou non). */
  durations: number[];
  workingHours: SlotWorkingInterval[];
  timeOff: SlotTimeOffRange[];
  busy: SlotBusyInterval[];
  now: Date;
}

/**
 * Premier créneau libre du barber, jour par jour à partir d'aujourd'hui (fuseau
 * du salon), toutes prestations actives confondues. Mêmes règles que la
 * réservation : `computeBookingSlots`, délai minimal et horizon de `LIMITS`.
 */
export function summarizeAvailability(
  input: SummarizeAvailabilityInput,
): AvailabilitySummary {
  const { timezone, durations, workingHours, timeOff, busy, now } = input;
  const none = { nextAvailableAt: null, availableToday: false };
  if (durations.length === 0 || workingHours.length === 0) return none;
  const today = utcToZonedParts(now, timezone).date;
  const distinct = [...new Set(durations)];

  for (let offset = 0; offset < AVAILABILITY_DAYS; offset += 1) {
    const date = new Date(calendarDateToUtcMillis(today) + offset * MS_PER_DAY)
      .toISOString()
      .slice(0, 10);
    let earliest: string | null = null;
    for (const durationMinutes of distinct) {
      const [first] = computeBookingSlots({
        date,
        timezone,
        durationMinutes,
        workingHours,
        timeOff,
        busy,
        now,
        leadTimeMinutes: LIMITS.bookingLeadTimeMinutes,
        horizonDays: LIMITS.bookingHorizonDays,
      });
      if (first && (earliest === null || first.startAt < earliest)) {
        earliest = first.startAt;
      }
    }
    if (earliest !== null) {
      return { nextAvailableAt: earliest, availableToday: offset === 0 };
    }
  }
  return none;
}
