import {
  aliasedTable,
  and,
  asc,
  desc,
  eq,
  gte,
  inArray,
  isNotNull,
  isNull,
  ne,
  sql,
  type SQL,
} from "drizzle-orm";
import { db } from "../../db/client.js";
import {
  auditLogs,
  barberProfiles,
  bookings,
  reviews,
  users,
  type AuditLogRow,
  type BookingRow,
  type ReviewRow,
  type User,
} from "@findbarber/shared/schema";
import {
  ACTIVE_BOOKING_STATUSES,
  CANCELLED_BY_ADMIN,
} from "@findbarber/shared/constants";
import type {
  AdminAuditLog,
  AdminAuditLogsResponse,
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
  AdminAuditLogListQuery,
  AdminBookingListQuery,
  AdminReviewListQuery,
  AdminUserListQuery,
} from "@findbarber/shared/validation";
import { recordAudit, type AuditActor } from "../../lib/audit.js";
import { paymentStatusOnCancel } from "../payments/rules.js";
import { AppError } from "../../lib/errors.js";
import { effectiveBookingStatus } from "@findbarber/shared/booking";
import { notifyBookingEvent } from "../notification/service.js";

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

interface AdminBarberRef {
  id: string;
  certifiedAt: Date | null;
  // Approbation par l'ADMIN (issue #40) : null = en attente.
  approvedAt: Date | null;
}

function toAdminUser(user: User, barber: AdminBarberRef | null): AdminUser {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    status: user.status,
    name: user.name,
    createdAt: user.createdAt.toISOString(),
    barberProfileId: barber?.id ?? null,
    certifiedAt: barber?.certifiedAt ? barber.certifiedAt.toISOString() : null,
    barberPendingApproval: barber !== null && barber.approvedAt === null,
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
    status: effectiveBookingStatus(row, new Date()),
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

// Profils en attente d'approbation (issue #40), comptes supprimés exclus.
async function countPendingBarbers(): Promise<number> {
  const [row] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(barberProfiles)
    .innerJoin(users, eq(users.id, barberProfiles.userId))
    .where(and(isNull(barberProfiles.approvedAt), ne(users.status, "DELETED")));
  return Number(row?.total ?? 0);
}

export async function getAdminMetrics(): Promise<AdminMetrics> {
  const [
    usersTotal,
    usersActive,
    usersSuspended,
    barbersActive,
    barbersPending,
    bookingsTotal,
    bookingsPending,
    bookingsConfirmed,
    bookingsCompleted,
    bookingsCancelled,
    reviewsTotal,
    reviewsHidden,
  ] = await Promise.all([
    // Les comptes supprimés (pierres tombales anonymisées) ne comptent pas.
    countUsers(ne(users.status, "DELETED")),
    countUsers(eq(users.status, "ACTIVE")),
    countUsers(eq(users.status, "SUSPENDED")),
    countUsers(and(eq(users.role, "BARBER"), eq(users.status, "ACTIVE"))),
    countPendingBarbers(),
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
    barbers: { active: barbersActive, pendingApproval: barbersPending },
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
  const conditions: SQL[] = [];
  if (query.role) conditions.push(eq(users.role, query.role));
  if (query.pendingApproval) {
    conditions.push(
      isNotNull(barberProfiles.id),
      isNull(barberProfiles.approvedAt),
      ne(users.status, "DELETED"),
    );
  }
  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [totalRow] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(users)
    .leftJoin(barberProfiles, eq(barberProfiles.userId, users.id))
    .where(where);
  const total = Number(totalRow?.total ?? 0);

  const rows = await db
    .select({
      user: users,
      barberProfileId: barberProfiles.id,
      certifiedAt: barberProfiles.certifiedAt,
      approvedAt: barberProfiles.approvedAt,
    })
    .from(users)
    .leftJoin(barberProfiles, eq(barberProfiles.userId, users.id))
    .where(where)
    .orderBy(asc(users.createdAt), asc(users.id))
    .limit(query.pageSize)
    .offset((query.page - 1) * query.pageSize);

  return {
    users: rows.map((row) =>
      toAdminUser(
        row.user,
        row.barberProfileId
          ? {
              id: row.barberProfileId,
              certifiedAt: row.certifiedAt,
              approvedAt: row.approvedAt,
            }
          : null,
      ),
    ),
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
    if (target.status === "DELETED") {
      throw new AppError(409, "USER_DELETED", "Ce compte a été supprimé.");
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

    let barber: AdminBarberRef | null = null;
    let cancelledBookingIds: string[] = [];
    if (updated.role === "BARBER") {
      const [profile] = await tx
        .select({
          id: barberProfiles.id,
          certifiedAt: barberProfiles.certifiedAt,
          approvedAt: barberProfiles.approvedAt,
        })
        .from(barberProfiles)
        .where(eq(barberProfiles.userId, targetUserId))
        .limit(1);
      if (profile) {
        barber = profile;

        // Lire les réservations futures actives AVANT l'annulation, pour
        // notifier chaque CLIENT concerné dans la même transaction.
        const affected = await tx
          .select({
            id: bookings.id,
            clientUserId: bookings.clientUserId,
            emailConfirmExpiresAt: bookings.emailConfirmExpiresAt,
          })
          .from(bookings)
          .where(
            and(
              eq(bookings.barberProfileId, profile.id),
              inArray(bookings.status, [...ACTIVE_BOOKING_STATUSES]),
              gte(bookings.startAt, now),
            ),
          );

        await tx
          .update(bookings)
          .set({
            status: "CANCELLED",
            cancelledBy: CANCELLED_BY_ADMIN,
            cancelledAt: now,
            // Remboursement automatique des paiements reçus (issue #10).
            paymentStatus: paymentStatusOnCancel,
            paymentExpiresAt: null,
            updatedAt: now,
          })
          .where(
            and(
              eq(bookings.barberProfileId, profile.id),
              inArray(bookings.status, [...ACTIVE_BOOKING_STATUSES]),
              gte(bookings.startAt, now),
            ),
          );

        for (const booking of affected) {
          // Réservation express non confirmée (lot N6) : adresse non vérifiée,
          // aucun email.
          if (booking.emailConfirmExpiresAt !== null) continue;
          await notifyBookingEvent(tx as unknown as typeof db, {
            recipientUserId: booking.clientUserId,
            actorUserId,
            bookingId: booking.id,
            type: "BOOKING_CANCELLED_BY_ADMIN",
          });
        }
        cancelledBookingIds = affected.map((booking) => booking.id);
      }
    }

    // Journal d'audit (issue #13) : la suspension et chaque annulation induite.
    const actor: AuditActor = { id: actorUserId, role: "ADMIN" };
    await recordAudit(tx as unknown as typeof db, [
      {
        actor,
        action: "USER_SUSPENDED",
        targetType: "USER",
        targetId: updated.id,
        metadata: {
          role: updated.role,
          cancelledBookings: cancelledBookingIds.length,
        },
      },
      ...cancelledBookingIds.map((bookingId) => ({
        actor,
        action: "BOOKING_CANCELLED" as const,
        targetType: "BOOKING" as const,
        targetId: bookingId,
        metadata: { to: "CANCELLED", reason: "BARBER_SUSPENDED" },
      })),
    ]);

    return toAdminUser(updated, barber);
  });
}

export async function reactivateUser(
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
    if (target.status !== "SUSPENDED") {
      throw new AppError(
        409,
        "USER_NOT_SUSPENDED",
        "Cet utilisateur n'est pas suspendu.",
      );
    }

    const [updated] = await tx
      .update(users)
      .set({ status: "ACTIVE", updatedAt: new Date() })
      .where(eq(users.id, targetUserId))
      .returning();

    let barber: AdminBarberRef | null = null;
    if (updated.role === "BARBER") {
      const [profile] = await tx
        .select({
          id: barberProfiles.id,
          certifiedAt: barberProfiles.certifiedAt,
          approvedAt: barberProfiles.approvedAt,
        })
        .from(barberProfiles)
        .where(eq(barberProfiles.userId, targetUserId))
        .limit(1);
      barber = profile ?? null;
    }

    await recordAudit(tx as unknown as typeof db, {
      actor: { id: actorUserId, role: "ADMIN" },
      action: "USER_REACTIVATED",
      targetType: "USER",
      targetId: updated.id,
      metadata: { role: updated.role },
    });

    return toAdminUser(updated, barber);
  });
}

// Badge « Certifié » (issue #41) : attribution et retrait réservés à l'ADMIN
// (garde de route). Idempotent : réattribuer conserve la date d'origine,
// retirer un badge absent ne change rien ; seul un vrai changement est audité.
export async function setBarberCertification(
  actorUserId: string,
  barberProfileId: string,
  certified: boolean,
): Promise<AdminUser> {
  return db.transaction(async (tx) => {
    const [row] = await tx
      .select({ profile: barberProfiles, user: users })
      .from(barberProfiles)
      .innerJoin(users, eq(users.id, barberProfiles.userId))
      .where(eq(barberProfiles.id, barberProfileId))
      .limit(1)
      .for("update", { of: barberProfiles });

    if (!row) {
      throw new AppError(404, "BARBER_PROFILE_NOT_FOUND", "Profil barber introuvable.");
    }

    const alreadyCertified = row.profile.certifiedAt !== null;
    if (alreadyCertified === certified) {
      return toAdminUser(row.user, row.profile);
    }

    const [updated] = await tx
      .update(barberProfiles)
      .set({ certifiedAt: certified ? new Date() : null })
      .where(eq(barberProfiles.id, barberProfileId))
      .returning({
        id: barberProfiles.id,
        certifiedAt: barberProfiles.certifiedAt,
        approvedAt: barberProfiles.approvedAt,
      });

    await recordAudit(tx as unknown as typeof db, {
      actor: { id: actorUserId, role: "ADMIN" },
      action: certified ? "BARBER_CERTIFIED" : "BARBER_UNCERTIFIED",
      targetType: "BARBER_PROFILE",
      targetId: barberProfileId,
    });

    return toAdminUser(row.user, updated);
  });
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

// Masquage non destructif : on pose `hidden_at`, jamais de DELETE. Aucune
// restauration n'est exposée (API ou interface) à ce jour.
export async function hideReview(
  actorUserId: string,
  reviewId: string,
): Promise<AdminReview> {
  await db.transaction(async (tx) => {
    const [review] = await tx
      .select()
      .from(reviews)
      .where(eq(reviews.id, reviewId))
      .limit(1)
      .for("update");

    if (!review) {
      throw new AppError(404, "REVIEW_NOT_FOUND", "Avis introuvable.");
    }
    if (review.hiddenAt) {
      throw new AppError(
        409,
        "REVIEW_ALREADY_HIDDEN",
        "Cet avis est déjà masqué.",
      );
    }

    const now = new Date();
    await tx
      .update(reviews)
      .set({ hiddenAt: now, updatedAt: now })
      .where(eq(reviews.id, reviewId));

    await recordAudit(tx as unknown as typeof db, {
      actor: { id: actorUserId, role: "ADMIN" },
      action: "REVIEW_HIDDEN",
      targetType: "REVIEW",
      targetId: review.id,
      metadata: { bookingId: review.bookingId, rating: review.rating },
    });
  });

  return loadAdminReview(reviewId);
}

// --- Journal d'audit (issue #13) ---
// Lecture seule, plus récent d'abord. L'email de l'acteur est résolu à la
// lecture (jointure), comme celui d'un compte ciblé : jamais copiés dans le
// journal.
function toAdminAuditLog(
  row: AuditLogRow,
  actorEmail: string | null,
  targetEmail: string | null,
): AdminAuditLog {
  return {
    id: row.id,
    action: row.action,
    actorUserId: row.actorUserId,
    actorRole: row.actorRole,
    actorEmail,
    targetType: row.targetType,
    targetId: row.targetId,
    targetEmail: row.targetType === "USER" ? targetEmail : null,
    metadata: row.metadata ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function listAuditLogs(
  query: AdminAuditLogListQuery,
): Promise<AdminAuditLogsResponse> {
  const where = query.action ? eq(auditLogs.action, query.action) : undefined;
  const [totalRow] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(auditLogs)
    .where(where);
  const total = Number(totalRow?.total ?? 0);

  const targetUsers = aliasedTable(users, "target_users");
  const rows = await db
    .select({
      entry: auditLogs,
      actorEmail: users.email,
      targetEmail: targetUsers.email,
    })
    .from(auditLogs)
    .leftJoin(users, eq(auditLogs.actorUserId, users.id))
    .leftJoin(
      targetUsers,
      and(eq(auditLogs.targetType, "USER"), eq(auditLogs.targetId, targetUsers.id)),
    )
    .where(where)
    .orderBy(desc(auditLogs.createdAt), desc(auditLogs.id))
    .limit(query.pageSize)
    .offset((query.page - 1) * query.pageSize);

  return {
    entries: rows.map((row) =>
      toAdminAuditLog(row.entry, row.actorEmail, row.targetEmail),
    ),
    pagination: pagination(query.page, query.pageSize, total),
  };
}

// Approbation d'un profil barber (issue #40) : réservée à l'ADMIN (garde de
// route), refusée si déjà approuvé (409), tracée dans le journal d'audit.
export async function approveBarberProfile(
  actorUserId: string,
  barberProfileId: string,
): Promise<AdminUser> {
  return db.transaction(async (tx) => {
    const [profile] = await tx
      .select()
      .from(barberProfiles)
      .where(eq(barberProfiles.id, barberProfileId))
      .limit(1)
      .for("update");
    if (!profile) {
      throw new AppError(404, "BARBER_PROFILE_NOT_FOUND", "Profil introuvable.");
    }
    if (profile.approvedAt) {
      throw new AppError(
        409,
        "BARBER_ALREADY_APPROVED",
        "Ce profil est déjà approuvé.",
      );
    }
    const [owner] = await tx
      .select()
      .from(users)
      .where(eq(users.id, profile.userId))
      .limit(1);
    if (!owner || owner.status === "DELETED") {
      throw new AppError(404, "BARBER_PROFILE_NOT_FOUND", "Profil introuvable.");
    }

    const now = new Date();
    await tx
      .update(barberProfiles)
      .set({ approvedAt: now })
      .where(eq(barberProfiles.id, barberProfileId));

    await recordAudit(tx as unknown as typeof db, {
      actor: { id: actorUserId, role: "ADMIN" },
      action: "BARBER_APPROVED",
      targetType: "BARBER_PROFILE",
      targetId: barberProfileId,
    });

    return toAdminUser(owner, {
      id: barberProfileId,
      certifiedAt: profile.certifiedAt,
      approvedAt: now,
    });
  });
}
