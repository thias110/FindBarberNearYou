import { randomUUID } from "node:crypto";
import { desc, eq, sql } from "drizzle-orm";
import { db } from "../../db/client.js";
import {
  barberProfiles,
  bookings,
  reviews,
  users,
  type ReviewRow,
} from "@findbarber/shared/schema";
import type {
  BarberReviewsResponse,
  PublicReview,
} from "@findbarber/shared/types";
import type {
  ReviewCreateInput,
  ReviewListQuery,
} from "@findbarber/shared/validation";
import { AppError, isUniqueViolation } from "../../lib/errors.js";

// Whitelist publique stricte : jamais d'email, hash, userId interne, adresse,
// identifiant de réservation ni coordonnées. `clientName` = users.name (nullable).
function toPublicReview(
  row: ReviewRow,
  clientName: string | null,
): PublicReview {
  return {
    id: row.id,
    rating: row.rating,
    comment: row.comment,
    createdAt: row.createdAt.toISOString(),
    clientName,
  };
}

// Seul le CLIENT propriétaire d'une réservation COMPLETED peut déposer un avis.
// Le barber noté est déduit du booking (`booking.barberProfileId`) : aucun
// identifiant de barber/client n'est accepté du frontend. L'unicité par booking
// est garantie en base (index unique) et rattrapée ici en cas de concurrence.
export async function createReview(
  clientUserId: string,
  bookingId: string,
  input: ReviewCreateInput,
): Promise<PublicReview> {
  const [booking] = await db
    .select()
    .from(bookings)
    .where(eq(bookings.id, bookingId))
    .limit(1);

  // Anti-IDOR : introuvable OU appartenant à un autre client → 404 (aucune
  // fuite d'existence). Le barber noté est implicitement `booking.barberProfileId`.
  if (!booking || booking.clientUserId !== clientUserId) {
    throw new AppError(404, "BOOKING_NOT_FOUND", "Réservation introuvable.");
  }

  if (booking.status !== "COMPLETED") {
    throw new AppError(
      409,
      "BOOKING_NOT_COMPLETED",
      "Seule une réservation terminée peut être évaluée.",
    );
  }

  const now = new Date();
  try {
    const [created] = await db
      .insert(reviews)
      .values({
        id: randomUUID(),
        bookingId,
        rating: input.rating,
        comment: input.comment,
        updatedAt: now,
      })
      .returning();

    const [client] = await db
      .select({ name: users.name })
      .from(users)
      .where(eq(users.id, clientUserId))
      .limit(1);
    return toPublicReview(created, client?.name ?? null);
  } catch (err) {
    // La contrainte unique sur booking_id reste la protection finale contre le
    // doublon (y compris deux requêtes simultanées du même client).
    if (isUniqueViolation(err)) {
      throw new AppError(
        409,
        "REVIEW_ALREADY_EXISTS",
        "Un avis existe déjà pour cette réservation.",
      );
    }
    throw err;
  }
}

// Lecture publique des avis d'un professionnel (lot 11), sans authentification.
// La note moyenne est arrondie à 2 décimales et vaut null s'il n'y a aucun avis.
// Seuls les profils ACTIVE + BARBER sont exposés (même garde que le profil public).
export async function listBarberReviews(
  barberId: string,
  query: ReviewListQuery,
): Promise<BarberReviewsResponse> {
  const [profile] = await db
    .select()
    .from(barberProfiles)
    .where(eq(barberProfiles.id, barberId))
    .limit(1);

  if (!profile) {
    throw new AppError(404, "BARBER_PROFILE_NOT_FOUND", "Profil introuvable.");
  }

  const [owner] = await db
    .select({ status: users.status, role: users.role })
    .from(users)
    .where(eq(users.id, profile.userId))
    .limit(1);

  if (!owner || owner.status !== "ACTIVE" || owner.role !== "BARBER") {
    throw new AppError(404, "BARBER_PROFILE_NOT_FOUND", "Profil introuvable.");
  }

  const [summary] = await db
    .select({
      average: sql<number | null>`avg(${reviews.rating})::float8`,
      total: sql<number>`count(*)::int`,
    })
    .from(reviews)
    .innerJoin(bookings, eq(reviews.bookingId, bookings.id))
    .where(eq(bookings.barberProfileId, barberId));

  const total = Number(summary?.total ?? 0);
  const averageRating =
    total === 0 ? null : Number((Number(summary?.average ?? 0)).toFixed(2));

  const rows = await db
    .select({ review: reviews, clientName: users.name })
    .from(reviews)
    .innerJoin(bookings, eq(reviews.bookingId, bookings.id))
    .innerJoin(users, eq(bookings.clientUserId, users.id))
    .where(eq(bookings.barberProfileId, barberId))
    .orderBy(desc(reviews.createdAt), desc(reviews.id))
    .limit(query.pageSize)
    .offset((query.page - 1) * query.pageSize);

  return {
    summary: { averageRating, totalReviews: total },
    reviews: rows.map((row) => toPublicReview(row.review, row.clientName)),
    pagination: {
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / query.pageSize),
    },
  };
}
