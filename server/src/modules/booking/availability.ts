import { and, eq, gt, gte, inArray, lt, lte } from "drizzle-orm";
import { db } from "../../db/client.js";
import {
  barberServices,
  barberTimeOff,
  barberWorkingHours,
  bookings,
} from "@findbarber/shared/schema";
import type { Weekday } from "@findbarber/shared/constants";
import {
  AVAILABILITY_DAYS,
  summarizeAvailability,
  type AvailabilitySummary,
} from "@findbarber/shared/booking";
import { occupiesSlotCondition } from "./occupancy.js";

export type { AvailabilitySummary };

// Disponibilité affichée dans la recherche (lot N1, plan de refonte) : lecture
// des données d'une page de résultats en lot, cache court, puis calcul pur
// partagé (`summarizeAvailability`, mêmes règles que la réservation). Lecture
// seule : la réservation recalcule toujours le créneau.

export interface AvailabilityProfile {
  id: string;
  timezone: string | null;
}

const DAYS = AVAILABILITY_DAYS;
const MS_PER_DAY = 86_400_000;
const NONE: AvailabilitySummary = { nextAvailableAt: null, availableToday: false };

// Cache par barber (60 s, valeur de départ validée par le propriétaire) :
// borne le coût d'une page de recherche. Invalidé par les écritures qui
// changent les créneaux (horaires, absences, réservations, prestations).
export const AVAILABILITY_CACHE_TTL_MS = 60_000;
const cache = new Map<string, { value: AvailabilitySummary; expiresAt: number }>();

export function invalidateAvailability(barberProfileId: string): void {
  cache.delete(barberProfileId);
}

/** Vide tout le cache (tests). */
export function clearAvailabilityCache(): void {
  cache.clear();
}

/**
 * Résumés de disponibilité pour une page de résultats. Quatre requêtes au plus
 * pour toute la page (aucune par barber), puis calcul en mémoire.
 */
export async function getAvailabilitySummaries(
  profiles: AvailabilityProfile[],
  now: Date = new Date(),
): Promise<Map<string, AvailabilitySummary>> {
  const result = new Map<string, AvailabilitySummary>();
  const toCompute: AvailabilityProfile[] = [];
  const nowMs = now.getTime();

  for (const profile of profiles) {
    const cached = cache.get(profile.id);
    if (cached && cached.expiresAt > nowMs) {
      result.set(profile.id, cached.value);
    } else if (!profile.timezone) {
      // Sans fuseau, aucun créneau n'est réservable (409 côté réservation).
      result.set(profile.id, NONE);
    } else {
      toCompute.push(profile);
    }
  }
  if (toCompute.length === 0) return result;

  const ids = toCompute.map((profile) => profile.id);
  // Fenêtre large (veille UTC → J+8) : couvre les 7 jours civils de tout fuseau.
  const windowStart = new Date(nowMs - MS_PER_DAY);
  const windowEnd = new Date(nowMs + (DAYS + 1) * MS_PER_DAY);
  const firstDate = windowStart.toISOString().slice(0, 10);
  const lastDate = windowEnd.toISOString().slice(0, 10);

  const [services, hours, timeOff, busy] = await Promise.all([
    db
      .selectDistinct({
        barberProfileId: barberServices.barberProfileId,
        durationMinutes: barberServices.durationMinutes,
      })
      .from(barberServices)
      .where(
        and(
          inArray(barberServices.barberProfileId, ids),
          eq(barberServices.isActive, true),
        ),
      ),
    db
      .select({
        barberProfileId: barberWorkingHours.barberProfileId,
        weekday: barberWorkingHours.weekday,
        startMinute: barberWorkingHours.startMinute,
        endMinute: barberWorkingHours.endMinute,
      })
      .from(barberWorkingHours)
      .where(inArray(barberWorkingHours.barberProfileId, ids)),
    db
      .select({
        barberProfileId: barberTimeOff.barberProfileId,
        startDate: barberTimeOff.startDate,
        endDate: barberTimeOff.endDate,
      })
      .from(barberTimeOff)
      .where(
        and(
          inArray(barberTimeOff.barberProfileId, ids),
          lte(barberTimeOff.startDate, lastDate),
          gte(barberTimeOff.endDate, firstDate),
        ),
      ),
    db
      .select({
        barberProfileId: bookings.barberProfileId,
        startAt: bookings.startAt,
        endAt: bookings.endAt,
      })
      .from(bookings)
      .where(
        and(
          inArray(bookings.barberProfileId, ids),
          occupiesSlotCondition(now),
          lt(bookings.startAt, windowEnd),
          gt(bookings.endAt, windowStart),
        ),
      ),
  ]);

  for (const profile of toCompute) {
    const value = summarizeAvailability({
      timezone: profile.timezone as string,
      durations: services
        .filter((s) => s.barberProfileId === profile.id)
        .map((s) => s.durationMinutes),
      workingHours: hours
        .filter((h) => h.barberProfileId === profile.id)
        .map((h) => ({
          weekday: h.weekday as Weekday,
          startMinute: h.startMinute,
          endMinute: h.endMinute,
        })),
      timeOff: timeOff
        .filter((t) => t.barberProfileId === profile.id)
        .map((t) => ({ startDate: t.startDate, endDate: t.endDate })),
      busy: busy
        .filter((b) => b.barberProfileId === profile.id)
        .map((b) => ({ startAt: b.startAt, endAt: b.endAt })),
      now,
    });
    cache.set(profile.id, { value, expiresAt: nowMs + AVAILABILITY_CACHE_TTL_MS });
    result.set(profile.id, value);
  }
  return result;
}
