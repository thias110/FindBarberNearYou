import { and, eq, gte, lt, sql } from "drizzle-orm";
import { db } from "../../db/client.js";
import { barberProfiles, bookings, reviews } from "@findbarber/shared/schema";
import { calendarDateToUtcMillis } from "@findbarber/shared/dates";
import { utcToZonedParts } from "@findbarber/shared/timezones";
import { computeBarberStats } from "@findbarber/shared/stats";
import type { BarberStatsResponse } from "@findbarber/shared/types";
import type { BarberStatsQuery } from "@findbarber/shared/validation";
import { AppError } from "../../lib/errors.js";

const MS_PER_HOUR = 3_600_000;
const MS_PER_DAY = 86_400_000;

function addDays(date: string, days: number): string {
  return new Date(calendarDateToUtcMillis(date) + days * MS_PER_DAY)
    .toISOString()
    .slice(0, 10);
}

// La période est toujours exprimée dans le fuseau du professionnel.
function resolvePeriod(
  query: BarberStatsQuery,
  timezone: string,
): { fromDate: string; toDate: string } {
  const today = utcToZonedParts(new Date(), timezone).date;
  switch (query.range) {
    case "7d":
      return { fromDate: addDays(today, -6), toDate: today };
    case "30d":
      return { fromDate: addDays(today, -29), toDate: today };
    case "month":
      return { fromDate: `${today.slice(0, 8)}01`, toDate: today };
    case "custom":
      return { fromDate: query.from ?? today, toDate: query.to ?? today };
  }
}

// Orchestration uniquement : profil, fuseau, période, deux requêtes minimales
// (réservations + premières réservations par client) et note moyenne globale.
// Tout le bucketing est délégué à `computeBarberStats` (pur).
export async function getBarberStats(
  userId: string,
  query: BarberStatsQuery,
): Promise<BarberStatsResponse> {
  const [profile] = await db
    .select()
    .from(barberProfiles)
    .where(eq(barberProfiles.userId, userId))
    .limit(1);

  if (!profile) {
    throw new AppError(
      404,
      "BARBER_PROFILE_NOT_FOUND",
      "Aucun profil professionnel. Créez d'abord votre profil.",
    );
  }
  if (!profile.timezone) {
    throw new AppError(
      409,
      "BARBER_TIMEZONE_MISSING",
      "Renseignez votre fuseau horaire pour consulter vos statistiques.",
    );
  }

  const { fromDate, toDate } = resolvePeriod(query, profile.timezone);

  // Fenêtre UTC large (-14h/+14h) couvrant tous les créneaux dont le jour local
  // de début tombe dans [fromDate, toDate], quel que soit le fuseau. Le filtre
  // local exact est réappliqué dans `computeBarberStats`.
  const windowStart = new Date(
    calendarDateToUtcMillis(fromDate) - 14 * MS_PER_HOUR,
  );
  const windowEndExclusive = new Date(
    calendarDateToUtcMillis(toDate) + MS_PER_DAY + 14 * MS_PER_HOUR,
  );

  const rows = await db
    .select({
      startAt: bookings.startAt,
      status: bookings.status,
      priceMinor: bookings.priceMinor,
      serviceName: bookings.serviceName,
      clientUserId: bookings.clientUserId,
      cancelledBy: bookings.cancelledBy,
      createdAt: bookings.createdAt,
    })
    .from(bookings)
    .where(
      and(
        eq(bookings.barberProfileId, profile.id),
        gte(bookings.startAt, windowStart),
        lt(bookings.startAt, windowEndExclusive),
      ),
    );

  const firstRows = await db
    .select({
      clientUserId: bookings.clientUserId,
      first: sql<Date | string>`min(${bookings.createdAt})`,
    })
    .from(bookings)
    .where(eq(bookings.barberProfileId, profile.id))
    .groupBy(bookings.clientUserId);

  const firstBookingByClient = new Map<string, Date>();
  for (const row of firstRows) {
    firstBookingByClient.set(
      row.clientUserId,
      row.first instanceof Date ? row.first : new Date(row.first),
    );
  }

  const [rating] = await db
    .select({
      average: sql<number | null>`avg(${reviews.rating})::float8`,
      total: sql<number>`count(*)::int`,
    })
    .from(reviews)
    .innerJoin(bookings, eq(reviews.bookingId, bookings.id))
    .where(eq(bookings.barberProfileId, profile.id));

  const totalReviews = Number(rating?.total ?? 0);
  const averageRating =
    totalReviews === 0 ? null : Number((Number(rating?.average ?? 0)).toFixed(2));

  return computeBarberStats({
    timezone: profile.timezone,
    currency: profile.currency,
    fromDate,
    toDate,
    bookings: rows.map((row) => ({
      startAt: row.startAt,
      status: row.status,
      priceMinor: row.priceMinor,
      serviceName: row.serviceName,
      clientUserId: row.clientUserId,
      cancelledBy: row.cancelledBy,
      createdAt: row.createdAt,
    })),
    firstBookingByClient,
    rating: { averageRating, totalReviews },
  });
}
