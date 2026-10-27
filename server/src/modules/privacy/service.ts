import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { and, eq, gte, inArray, isNotNull, lt, or } from "drizzle-orm";
import { db, type Db } from "../../db/client.js";
import {
  barberPhotos,
  barberProfilePlaces,
  barberProfiles,
  barberServices,
  barberTimeOff,
  barberWorkingHours,
  bookings,
  emailOutbox,
  emailVerificationTokens,
  favorites,
  notifications,
  passwordResetTokens,
  reviews,
  users,
} from "@findbarber/shared/schema";
import {
  ACTIVE_BOOKING_STATUSES,
  LIMITS,
  type NotificationType,
} from "@findbarber/shared/constants";
import { AppError } from "../../lib/errors.js";
import { recordAudit, type AuditActor } from "../../lib/audit.js";
import { decryptField } from "../../lib/fieldCrypto.js";
import { publicUploadPath, remove } from "../../lib/storage.js";
import { notifyBookingEvent } from "../notification/service.js";
import { paymentStatusOnCancel } from "../payments/rules.js";

// --- Données personnelles (issue #14 : nLPD / RGPD) ---
// - Export JSON (droit d'accès et à la portabilité) : jamais de hash, de jeton
//   ni de donnée d'un tiers (coordonnées des clients d'un barber).
// - Suppression du compte (droit à l'oubli) par ANONYMISATION : la ligne
//   `users` devient une pierre tombale (status DELETED), ce qui garde intacts
//   l'historique des réservations et les statistiques des barbers, sans aucune
//   donnée permettant d'identifier la personne.
// - Rétention : adresse et position d'un client effacées après le rendez-vous.

// --- Export ---

export async function exportPersonalData(userId: string) {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!user)
    throw new AppError(404, "USER_NOT_FOUND", "Utilisateur introuvable.");

  const clientBookings = await db
    .select()
    .from(bookings)
    .where(eq(bookings.clientUserId, userId));
  const clientBookingIds = clientBookings.map((b) => b.id);
  const writtenReviews = clientBookingIds.length
    ? await db
        .select()
        .from(reviews)
        .where(inArray(reviews.bookingId, clientBookingIds))
    : [];
  const userNotifications = await db
    .select()
    .from(notifications)
    .where(eq(notifications.userId, userId));
  const userFavorites = await db
    .select()
    .from(favorites)
    .where(eq(favorites.userId, userId));

  const [profile] = await db
    .select()
    .from(barberProfiles)
    .where(eq(barberProfiles.userId, userId))
    .limit(1);

  let barber: Record<string, unknown> | null = null;
  if (profile) {
    const [places, services, hours, timeOff, photos, received] =
      await Promise.all([
        db
          .select()
          .from(barberProfilePlaces)
          .where(eq(barberProfilePlaces.barberProfileId, profile.id)),
        db
          .select()
          .from(barberServices)
          .where(eq(barberServices.barberProfileId, profile.id)),
        db
          .select()
          .from(barberWorkingHours)
          .where(eq(barberWorkingHours.barberProfileId, profile.id)),
        db
          .select()
          .from(barberTimeOff)
          .where(eq(barberTimeOff.barberProfileId, profile.id)),
        db
          .select()
          .from(barberPhotos)
          .where(eq(barberPhotos.barberProfileId, profile.id)),
        db
          .select()
          .from(bookings)
          .where(eq(bookings.barberProfileId, profile.id)),
      ]);
    barber = {
      profile: {
        displayName: profile.displayName,
        description: profile.description,
        address: profile.address,
        postalCode: profile.postalCode,
        city: profile.city,
        countryCode: profile.countryCode,
        latitude: profile.latitude,
        longitude: profile.longitude,
        currency: profile.currency,
        timezone: profile.timezone,
        travelRadiusKm: profile.travelRadiusKm,
        createdAt: profile.createdAt,
      },
      places: places.map((p) => p.place),
      services: services.map((s) => ({
        name: s.name,
        description: s.description,
        durationMinutes: s.durationMinutes,
        priceMinor: s.priceMinor,
        isActive: s.isActive,
      })),
      workingHours: hours.map((h) => ({
        weekday: h.weekday,
        startMinute: h.startMinute,
        endMinute: h.endMinute,
      })),
      timeOff: timeOff.map((t) => ({
        startDate: t.startDate,
        endDate: t.endDate,
        reason: t.reason,
      })),
      photos: photos.map((p) => ({
        url: publicUploadPath(p.imagePath),
        caption: p.caption,
        createdAt: p.createdAt,
      })),
      // Rendez-vous reçus : activité du barber, SANS l'identité ni l'adresse
      // des clients (données de tiers).
      bookingsReceived: received.map((b) => ({
        id: b.id,
        serviceName: b.serviceName,
        servicePlace: b.servicePlace,
        startAt: b.startAt,
        endAt: b.endAt,
        status: b.status,
        priceMinor: b.priceMinor,
        currency: b.currency,
      })),
    };
  }

  return {
    exportedAt: new Date().toISOString(),
    format: "findbarber-personal-data/v1",
    account: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      status: user.status,
      avatarUrl: user.avatarPath ? publicUploadPath(user.avatarPath) : null,
      emailVerifiedAt: user.emailVerifiedAt,
      createdAt: user.createdAt,
    },
    bookings: clientBookings.map((b) => ({
      id: b.id,
      barberDisplayName: b.barberDisplayName,
      serviceName: b.serviceName,
      servicePlace: b.servicePlace,
      startAt: b.startAt,
      endAt: b.endAt,
      status: b.status,
      priceMinor: b.priceMinor,
      currency: b.currency,
      clientAddress: decryptField(b.clientAddress),
      cancelledBy: b.cancelledBy,
      declineReason: b.declineReason,
      createdAt: b.createdAt,
    })),
    reviews: writtenReviews.map((r) => ({
      bookingId: r.bookingId,
      rating: r.rating,
      comment: r.comment,
      createdAt: r.createdAt,
    })),
    notifications: userNotifications.map((n) => ({
      type: n.type,
      bookingId: n.bookingId,
      readAt: n.readAt,
      createdAt: n.createdAt,
    })),
    favorites: userFavorites.map((f) => ({
      barberProfileId: f.barberProfileId,
      createdAt: f.createdAt,
    })),
    barber,
  };
}

// --- Suppression (anonymisation) ---

const DELETED_EMAIL_DOMAIN = "deleted.invalid";

/** Annule les rendez-vous futurs actifs et prévient l'autre partie. */
async function cancelUpcoming(
  runner: Db,
  actor: AuditActor,
  scope: "CLIENT" | "BARBER",
  ownerId: string,
  now: Date,
): Promise<void> {
  const owner =
    scope === "CLIENT" ? bookings.clientUserId : bookings.barberProfileId;
  const upcoming = await runner
    .update(bookings)
    .set({
      status: "CANCELLED",
      cancelledBy: scope,
      cancelledAt: now,
      paymentStatus: paymentStatusOnCancel,
      paymentExpiresAt: null,
      updatedAt: now,
    })
    .where(
      and(
        eq(owner, ownerId),
        inArray(bookings.status, [...ACTIVE_BOOKING_STATUSES]),
        gte(bookings.startAt, now),
      ),
    )
    .returning({
      id: bookings.id,
      clientUserId: bookings.clientUserId,
      barberProfileId: bookings.barberProfileId,
    });

  for (const booking of upcoming) {
    let recipientUserId = booking.clientUserId;
    let type: NotificationType = "BOOKING_CANCELLED_BY_BARBER";
    if (scope === "CLIENT") {
      const [profile] = await runner
        .select({ userId: barberProfiles.userId })
        .from(barberProfiles)
        .where(eq(barberProfiles.id, booking.barberProfileId))
        .limit(1);
      if (!profile) continue;
      recipientUserId = profile.userId;
      type = "BOOKING_CANCELLED_BY_CLIENT";
    }
    await notifyBookingEvent(runner, {
      recipientUserId,
      actorUserId: actor.id,
      bookingId: booking.id,
      type,
    });
  }

  await recordAudit(
    runner,
    upcoming.map((booking) => ({
      actor,
      action: "BOOKING_CANCELLED" as const,
      targetType: "BOOKING" as const,
      targetId: booking.id,
      metadata: { to: "CANCELLED", reason: "ACCOUNT_DELETED" },
    })),
  );
}

/**
 * Supprime le compte de l'utilisateur connecté après confirmation du mot de
 * passe. Tout se fait dans UNE transaction ; les fichiers (avatar, photos)
 * sont effacés après commit.
 */
export async function deleteOwnAccount(
  userId: string,
  password: string,
): Promise<void> {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!user || user.status === "DELETED") {
    throw new AppError(404, "USER_NOT_FOUND", "Utilisateur introuvable.");
  }
  if (!(await bcrypt.compare(password, user.passwordHash))) {
    throw new AppError(403, "INVALID_PASSWORD", "Mot de passe incorrect.");
  }
  if (user.role === "ADMIN") {
    throw new AppError(
      403,
      "ADMIN_ACCOUNT_DELETION_FORBIDDEN",
      "Un compte administrateur ne peut pas être supprimé depuis l'application.",
    );
  }

  // Hash inutilisable : personne ne connaît le mot de passe aléatoire.
  const unusableHash = await bcrypt.hash(randomBytes(32).toString("hex"), 4);
  const filesToRemove: string[] = user.avatarPath ? [user.avatarPath] : [];
  const actor: AuditActor = { id: user.id, role: user.role };

  await db.transaction(async (tx) => {
    const runner = tx as unknown as Db;
    const now = new Date();

    // 1. Rendez-vous à venir : annulés, l'autre partie est prévenue.
    await cancelUpcoming(runner, actor, "CLIENT", user.id, now);

    const [profile] = await runner
      .select({ id: barberProfiles.id })
      .from(barberProfiles)
      .where(eq(barberProfiles.userId, user.id))
      .limit(1);
    if (profile) {
      await cancelUpcoming(runner, actor, "BARBER", profile.id, now);

      // 2. Vitrine du barber : retirée et anonymisée (la ligne reste pour
      //    l'historique des réservations et les statistiques).
      const photos = await runner
        .delete(barberPhotos)
        .where(eq(barberPhotos.barberProfileId, profile.id))
        .returning({ imagePath: barberPhotos.imagePath });
      filesToRemove.push(...photos.map((p) => p.imagePath));
      await runner
        .delete(barberWorkingHours)
        .where(eq(barberWorkingHours.barberProfileId, profile.id));
      await runner
        .delete(barberTimeOff)
        .where(eq(barberTimeOff.barberProfileId, profile.id));
      await runner
        .delete(barberProfilePlaces)
        .where(eq(barberProfilePlaces.barberProfileId, profile.id));
      await runner
        .update(barberServices)
        .set({ isActive: false, description: null, updatedAt: now })
        .where(eq(barberServices.barberProfileId, profile.id));
      await runner
        .update(barberProfiles)
        .set({
          displayName: "Professionnel supprimé",
          description: "",
          address: null,
          postalCode: null,
          city: "",
          latitude: 0,
          longitude: 0,
          travelRadiusKm: null,
          updatedAt: now,
        })
        .where(eq(barberProfiles.id, profile.id));
    }

    // 3. Historique client : adresse et position effacées, commentaires
    //    d'avis retirés (les notes restent, anonymes, pour les moyennes).
    const ownBookings = await runner
      .update(bookings)
      .set({
        clientAddress: null,
        clientCity: null,
        clientPostalCode: null,
        clientCountryCode: null,
        clientLatitude: null,
        clientLongitude: null,
        updatedAt: now,
      })
      .where(eq(bookings.clientUserId, user.id))
      .returning({ id: bookings.id });
    if (ownBookings.length > 0) {
      await runner
        .update(reviews)
        .set({ comment: null, updatedAt: now })
        .where(
          inArray(
            reviews.bookingId,
            ownBookings.map((b) => b.id),
          ),
        );
    }

    // 4. Données de compte rattachées.
    await runner.delete(notifications).where(eq(notifications.userId, user.id));
    await runner.delete(favorites).where(eq(favorites.userId, user.id));
    await runner
      .delete(emailVerificationTokens)
      .where(eq(emailVerificationTokens.userId, user.id));
    await runner
      .delete(passwordResetTokens)
      .where(eq(passwordResetTokens.userId, user.id));
    await runner
      .delete(emailOutbox)
      .where(eq(emailOutbox.recipientUserId, user.id));

    // 5. Pierre tombale : plus aucun identifiant ni moyen de connexion.
    await runner
      .update(users)
      .set({
        email: `deleted-${user.id}@${DELETED_EMAIL_DOMAIN}`,
        name: null,
        passwordHash: unusableHash,
        avatarPath: null,
        emailVerifiedAt: null,
        status: "DELETED",
        deletedAt: now,
        passwordChangedAt: now,
        updatedAt: now,
      })
      .where(eq(users.id, user.id));

    await recordAudit(runner, {
      actor,
      action: "USER_DELETED",
      targetType: "USER",
      targetId: user.id,
      metadata: { role: user.role },
    });
  });

  await Promise.all(filesToRemove.map((path) => remove(path).catch(() => {})));
}

// --- Rétention ---

/**
 * Efface l'adresse et la position des clients (AT_CLIENT) des rendez-vous
 * terminés depuis plus de `LIMITS.clientAddressRetentionDays` jours. Retourne
 * le nombre de réservations purgées.
 */
export async function purgeExpiredClientAddresses(
  now: Date = new Date(),
): Promise<number> {
  const cutoff = new Date(
    now.getTime() - LIMITS.clientAddressRetentionDays * 86_400_000,
  );
  const purged = await db
    .update(bookings)
    .set({
      clientAddress: null,
      clientCity: null,
      clientPostalCode: null,
      clientCountryCode: null,
      clientLatitude: null,
      clientLongitude: null,
      updatedAt: now,
    })
    .where(
      and(
        lt(bookings.endAt, cutoff),
        or(
          isNotNull(bookings.clientAddress),
          isNotNull(bookings.clientLatitude),
        ),
      ),
    )
    .returning({ id: bookings.id });
  return purged.length;
}

export function startPrivacyRetentionJob(intervalMs = 60 * 60_000): () => void {
  const run = () => {
    purgeExpiredClientAddresses().catch((err: unknown) => {
      console.error("[privacy] échec de la purge de rétention", err);
    });
  };
  run();
  const timer = setInterval(run, intervalMs);
  timer.unref();
  return () => clearInterval(timer);
}
