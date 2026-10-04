import {
  and,
  asc,
  desc,
  eq,
  gte,
  inArray,
  isNotNull,
  sql,
  type SQL,
} from "drizzle-orm";
import { db } from "../../db/client.js";
import {
  barberProfiles,
  bookings,
  reviews,
  users,
  type BookingRow,
  type ReviewRow,
  type User,
} from "@findbarber/shared/schema";
import {
  ACTIVE_BOOKING_STATUSES,
  CANCELLED_BY_ADMIN,
} from "@findbarber/shared/constants";
import type {
  AdminBooking,
  AdminBookingsResponse,
  AdminMetrics,
  AdminPagination,
  AdminReview,
  AdminReviewsResponse,
  AdminUser,
  AdminUsersResponse,
} from "@findbarber/shared/types";
import type {
  AdminBookingListQuery,
  AdminReviewListQuery,
  AdminUserListQuery,
} from "@findbarber/shared/validation";
import { AppError } from "../../lib/errors.js";

function pagination(
  page: number,
  pageSize: number,
  total: number,
): AdminPagination {
  return {
    page,
    pageSize,
    total,
    totalPages: total === 0 ? 0 : Math.ceil(total / pageSize),
  };
}

function toAdminUser(user: User, barberProfileId: string | null): AdminUser {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    status: user.status,
    name: user.name,
    createdAt: user.createdAt.toISOString(),
    barberProfileId,
  };
}

function toAdminBooking(
  row: BookingRow,
  clientName: string | null,
  clientEmail: string | null,
): AdminBooking {
  return {
    id: row.id,
    clientUserId: row.clientUserId,
    clientName,
    clientEmail,
    barberProfileId: row.barberProfileId,
    serviceId: row.serviceId,
    barberDisplayName: row.barberDisplayName,
    serviceName: row.serviceName,
    servicePlace: row.servicePlace,
    status: row.status,
    startAt: row.startAt.toISOString(),
    endAt: row.endAt.toISOString(),
    priceMinor: row.priceMinor,
    currency: row.currency,
    cancelledBy: row.cancelledBy,
    cancelledAt: row.cancelledAt ? row.cancelledAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
  };
}

function toAdminReview(
  review: ReviewRow,
  clientName: string | null,
  barberDisplayName: string | null,
): AdminReview {
  return {
    id: review.id,
    bookingId: review.bookingId,
    rating: review.rating,
    comment: review.comment,
    hiddenAt: review.hiddenAt ? review.hiddenAt.toISOString() : null,
    createdAt: review.createdAt.toISOString(),
    clientName,
    barberDisplayName,
  };
}

async function countUsers(where?: SQL): Promise<number> {
  const [row] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(users)
    .where(where);
  return Number(row?.total ?? 0);
}

async function countBookings(where?: SQL): Promise<number> {
  const [row] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(bookings)
    .where(where);
  return Number(row?.total ?? 0);
}

async function countReviews(where?: SQL): Promise<number> {
  const [row] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(reviews)
    .where(where);
  return Number(row?.total ?? 0);
}

export async function getAdminMetrics(): Promise<AdminMetrics> {
  const [
    usersTotal,
    usersActive,
    usersSuspended,
    barbersActive,
    bookingsTotal,
    bookingsPending,
    bookingsConfirmed,
    bookingsCompleted,
    bookingsCancelled,
    reviewsTotal,
    reviewsHidden,
  ] = await Promise.all([
    countUsers(),
    countUsers(eq(users.status, "ACTIVE")),
    countUsers(eq(users.status, "SUSPENDED")),
    countUsers(and(eq(users.role, "BARBER"), eq(users.status, "ACTIVE"))),
    countBookings(),
    countBookings(eq(bookings.status, "PENDING")),
    countBookings(eq(bookings.status, "CONFIRMED")),
    countBookings(eq(bookings.status, "COMPLETED")),
    countBookings(eq(bookings.status, "CANCELLED")),
    countReviews(),
    countReviews(isNotNull(reviews.hiddenAt)),
  ]);

  return {
    users: { total: usersTotal, active: usersActive, suspended: usersSuspended },
    barbers: { active: barbersActive },
    bookings: {
      total: bookingsTotal,
      pending: bookingsPending,
      confirmed: bookingsConfirmed,
      completed: bookingsCompleted,
      cancelled: bookingsCancelled,
    },
    reviews: { total: reviewsTotal, hidden: reviewsHidden },
  };
}

export async function listAdminUsers(
  query: AdminUserListQuery,
): Promise<AdminUsersResponse> {
  const where = query.role ? eq(users.role, query.role) : undefined;

  const [totalRow] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(users)
    .where(where);
  const total = Number(totalRow?.total ?? 0);

  const rows = await db
    .select({ user: users, barberProfileId: barberProfiles.id })
    .from(users)
    .leftJoin(barberProfiles, eq(barberProfiles.userId, users.id))
    .where(where)
    .orderBy(asc(users.createdAt), asc(users.id))
    .limit(query.pageSize)
    .offset((query.page - 1) * query.pageSize);

  return {
    users: rows.map((row) => toAdminUser(row.user, row.barberProfileId)),
    pagination: pagination(query.page, query.pageSize, total),
  };
}

// Suspension : interdite sur soi-même et sur le dernier ADMIN actif. Si la
// cible est un BARBER, ses réservations futures PENDING/CONFIRMED sont annulées
// dans la même transaction, avec `cancelled_by = ADMIN`.
export async function suspendUser(
  actorUserId: string,
  targetUserId: string,
): Promise<AdminUser> {
  return db.transaction(async (tx) => {
    const [target] = await tx
      .select()
      .from(users)
      .where(eq(users.id, targetUserId))
      .limit(1)
      .for("update");

    if (!target) {
      throw new AppError(404, "USER_NOT_FOUND", "Utilisateur introuvable.");
    }
    if (target.id === actorUserId) {
      throw new AppError(
        400,
        "SELF_SUSPENSION_FORBIDDEN",
        "Vous ne pouvez pas suspendre votre propre compte.",
      );
    }
    if (target.role === "ADMIN" && target.status === "ACTIVE") {
      const [activeAdmins] = await tx
        .select({ total: sql<number>`count(*)::int` })
        .from(users)
        .where(and(eq(users.role, "ADMIN"), eq(users.status, "ACTIVE")));
      if (Number(activeAdmins?.total ?? 0) <= 1) {
        throw new AppError(
          409,
          "LAST_ACTIVE_ADMIN_FORBIDDEN",
          "Impossible de suspendre le dernier administrateur actif.",
        );
      }
    }
    if (target.status !== "ACTIVE") {
      throw new AppError(
        409,
        "USER_ALREADY_SUSPENDED",
        "Cet utilisateur est déjà suspendu.",
      );
    }

    const now = new Date();
    const [updated] = await tx
      .update(users)
      .set({ status: "SUSPENDED", updatedAt: now })
      .where(eq(users.id, targetUserId))
      .returning();
    if (!updated) {
      throw new AppError(404, "USER_NOT_FOUND", "Utilisateur introuvable.");
    }

    let barberProfileId: string | null = null;
    if (updated.role === "BARBER") {
      const [profile] = await tx
        .select({ id: barberProfiles.id })
        .from(barberProfiles)
        .where(eq(barberProfiles.userId, targetUserId))
        .limit(1);
      if (profile) {
        barberProfileId = profile.id;
        await tx
          .update(bookings)
          .set({
            status: "CANCELLED",
            cancelledBy: CANCELLED_BY_ADMIN,
            cancelledAt: now,
            updatedAt: now,
          })
          .where(
            and(
              eq(bookings.barberProfileId, profile.id),
              inArray(bookings.status, [...ACTIVE_BOOKING_STATUSES]),
              gte(bookings.startAt, now),
            ),
          );
      }
    }

    return toAdminUser(updated, barberProfileId);
  });
}

export async function reactivateUser(targetUserId: string): Promise<AdminUser> {
  const [target] = await db
    .select()
    .from(users)
    .where(eq(users.id, targetUserId))
    .limit(1);

  if (!target) {
    throw new AppError(404, "USER_NOT_FOUND", "Utilisateur introuvable.");
  }
  if (target.status !== "SUSPENDED") {
    throw new AppError(
      409,
      "USER_NOT_SUSPENDED",
      "Cet utilisateur n'est pas suspendu.",
    );
  }

  const [updated] = await db
    .update(users)
    .set({ status: "ACTIVE", updatedAt: new Date() })
    .where(eq(users.id, targetUserId))
    .returning();

  let barberProfileId: string | null = null;
  if (updated.role === "BARBER") {
    const [profile] = await db
      .select({ id: barberProfiles.id })
      .from(barberProfiles)
      .where(eq(barberProfiles.userId, targetUserId))
      .limit(1);
    barberProfileId = profile?.id ?? null;
  }

  return toAdminUser(updated, barberProfileId);
}

export async function listAdminBookings(
  query: AdminBookingListQuery,
): Promise<AdminBookingsResponse> {
  const where = query.status ? eq(bookings.status, query.status) : undefined;

  const [totalRow] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(bookings)
    .where(where);
  const total = Number(totalRow?.total ?? 0);

  const rows = await db
    .select({
      booking: bookings,
      clientName: users.name,
      clientEmail: users.email,
    })
    .from(bookings)
    .leftJoin(users, eq(bookings.clientUserId, users.id))
    .where(where)
    .orderBy(desc(bookings.createdAt), desc(bookings.id))
    .limit(query.pageSize)
    .offset((query.page - 1) * query.pageSize);

  return {
    bookings: rows.map((row) =>
      toAdminBooking(row.booking, row.clientName, row.clientEmail),
    ),
    pagination: pagination(query.page, query.pageSize, total),
  };
}

export async function listAdminReviews(
  query: AdminReviewListQuery,
): Promise<AdminReviewsResponse> {
  const [totalRow] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(reviews);
  const total = Number(totalRow?.total ?? 0);

  const rows = await db
    .select({
      review: reviews,
      clientName: users.name,
      barberDisplayName: bookings.barberDisplayName,
    })
    .from(reviews)
    .innerJoin(bookings, eq(reviews.bookingId, bookings.id))
    .leftJoin(users, eq(bookings.clientUserId, users.id))
    .orderBy(desc(reviews.createdAt), desc(reviews.id))
    .limit(query.pageSize)
    .offset((query.page - 1) * query.pageSize);

  return {
    reviews: rows.map((row) =>
      toAdminReview(row.review, row.clientName, row.barberDisplayName),
    ),
    pagination: pagination(query.page, query.pageSize, total),
  };
}

async function loadAdminReview(reviewId: string): Promise<AdminReview> {
  const [row] = await db
    .select({
      review: reviews,
      clientName: users.name,
      barberDisplayName: bookings.barberDisplayName,
    })
    .from(reviews)
    .innerJoin(bookings, eq(reviews.bookingId, bookings.id))
    .leftJoin(users, eq(bookings.clientUserId, users.id))
    .where(eq(reviews.id, reviewId))
    .limit(1);

  if (!row) {
    throw new AppError(404, "REVIEW_NOT_FOUND", "Avis introuvable.");
  }
  return toAdminReview(row.review, row.clientName, row.barberDisplayName);
}

// Masquage réversible : on pose `hidden_at`, jamais de DELETE.
export async function hideReview(reviewId: string): Promise<AdminReview> {
  const [review] = await db
    .select()
    .from(reviews)
    .where(eq(reviews.id, reviewId))
    .limit(1);

  if (!review) {
    throw new AppError(404, "REVIEW_NOT_FOUND", "Avis introuvable.");
  }
  if (review.hiddenAt) {
    throw new AppError(409, "REVIEW_ALREADY_HIDDEN", "Cet avis est déjà masqué.");
  }

  const now = new Date();
  await db
    .update(reviews)
    .set({ hiddenAt: now, updatedAt: now })
    .where(eq(reviews.id, reviewId));

  return loadAdminReview(reviewId);
}
