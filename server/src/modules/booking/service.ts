import { randomUUID } from "node:crypto";
import { and, asc, eq, gt, gte, lt, lte, sql } from "drizzle-orm";
import type { PgUpdateSetSource } from "drizzle-orm/pg-core";
import { db } from "../../db/client.js";
import {
  barberProfiles,
  barberProfilePlaces,
  barberServices,
  barberTimeOff,
  barberWorkingHours,
  bookings,
  reviews,
  users,
  type BarberProfile,
  type BookingRow,
} from "@findbarber/shared/schema";
import { LIMITS } from "@findbarber/shared/constants";
import type {
  AuditAction,
  BookingStatus,
  NotificationType,
  ServicePlace,
  Weekday,
} from "@findbarber/shared/constants";
import type {
  Booking,
  BookingDetails,
  BookingSlotDto,
  BookingSlotsDay,
} from "@findbarber/shared/types";
import type {
  BookingCreateInput,
  BookingSlotsQuery,
  BookingSlotsRangeQuery,
} from "@findbarber/shared/validation";
import {
  NO_SHOW_WINDOW_HOURS,
  canMarkNoShow,
  canTransitionBooking,
  computeBookingSlots,
  earliestHold,
  effectiveBookingStatus,
  isBookingEnded,
  isPendingBookingExpired,
  pendingBookingExpiresAt,
} from "@findbarber/shared/booking";
import {
  calendarDateToUtcMillis,
  weekdayFromCalendarDate,
} from "@findbarber/shared/dates";
import { geocodeAddress } from "../../lib/geocoding.js";
import {
  haversineDistanceKm,
  isValidLatitude,
  isValidLongitude,
} from "../../lib/location.js";
import { AppError, isExclusionViolation } from "../../lib/errors.js";
import {
  assertBookingReadAccess,
  assertBookingTransitionAccess,
  bookingNotFound,
  type AuthUser,
} from "../../lib/authorization.js";
import { recordAudit } from "../../lib/audit.js";
import { decryptField, encryptField } from "../../lib/fieldCrypto.js";
import { notifyBookingEvent } from "../notification/service.js";
import { openCheckout, PAYMENT_HOLD_MS, paymentRequirementFor } from "../payments/service.js";
import {
  hiddenFromBarber,
  paymentStatusOnCancel,
  visibleToBarber,
} from "../payments/rules.js";
import { activePendingCondition, expireStalePendingBookings } from "./expiry.js";
import { invalidateAvailability } from "./availability.js";
import { occupiesSlotCondition } from "./occupancy.js";

const MS_PER_HOUR = 3_600_000;

function toBooking(
  row: BookingRow,
  clientName: string | null,
  hasReview = false,
): Booking {
  return {
    id: row.id,
    barberId: row.barberProfileId,
    serviceId: row.serviceId,
    barberDisplayName: row.barberDisplayName,
    serviceName: row.serviceName,
    serviceDescription: row.serviceDescription,
    durationMinutes: row.durationMinutes,
    priceMinor: row.priceMinor,
    currency: row.currency,
    servicePlace: row.servicePlace,
    status: effectiveBookingStatus(row, new Date()),
    startAt: row.startAt.toISOString(),
    endAt: row.endAt.toISOString(),
    clientName,
    hasReview,
    cancelledBy: row.cancelledBy,
    cancelledAt: row.cancelledAt ? row.cancelledAt.toISOString() : null,
    declinedAt: row.declinedAt ? row.declinedAt.toISOString() : null,
    declineReason: row.declineReason,
    expiresAt:
      row.status === "PENDING"
        ? pendingBookingExpiresAt(
            row.createdAt,
            row.startAt,
            LIMITS.bookingPendingTtlHours,
            earliestHold(row.paymentExpiresAt, row.emailConfirmExpiresAt),
          ).toISOString()
        : null,
    paymentStatus: row.paymentStatus,
    amountDueMinor: row.amountDueMinor,
    checkoutUrl:
      row.paymentStatus === "REQUIRES_PAYMENT" && row.status === "PENDING"
        ? row.stripeCheckoutUrl
        : null,
    createdAt: row.createdAt.toISOString(),
  };
}

function toBookingDetails(
  row: BookingRow,
  clientName: string | null,
  hasReview = false,
  barberAddress: string | null = null,
): BookingDetails {
  return {
    ...toBooking(row, clientName, hasReview),
    barberAddress,
    // Chiffrée au repos (issue #14) : déchiffrée pour les seuls ayants droit.
    clientAddress: decryptField(row.clientAddress),
    clientLatitude: row.clientLatitude,
    clientLongitude: row.clientLongitude,
  };
}

// Résout l'adresse client pour `AT_CLIENT` : vérifie la configuration de zone,
// géocode côté serveur, calcule la distance Haversine et refuse hors zone.
// Aucune coordonnée acceptée du navigateur : seules celles du géocodeur font foi.
async function resolveClientLocation(
  profile: BarberProfile,
  address: string,
): Promise<{ latitude: number; longitude: number }> {
  if (profile.travelRadiusKm === null) {
    throw new AppError(
      409,
      "BARBER_SERVICE_AREA_MISSING",
      "Ce professionnel ne définit pas de zone d'intervention.",
    );
  }
  if (
    !isValidLatitude(profile.latitude) ||
    !isValidLongitude(profile.longitude)
  ) {
    throw new AppError(
      409,
      "BARBER_COORDINATES_MISSING",
      "Coordonnées du professionnel indisponibles.",
    );
  }

  const geocoded = await geocodeAddress(address);
  const distanceKm = haversineDistanceKm(
    profile.latitude,
    profile.longitude,
    geocoded.latitude,
    geocoded.longitude,
  );
  if (distanceKm > profile.travelRadiusKm) {
    throw new AppError(
      409,
      "OUT_OF_SERVICE_AREA",
      "Cette adresse est hors de la zone d'intervention du professionnel.",
    );
  }
  return geocoded;
}

// Fenêtre UTC large (offset -14h..+14h + journée) couvrant toute réservation
// chevauchant la date civile visée, quel que soit le fuseau.
function busyWindow(date: string): { start: Date; end: Date } {
  const dayMs = calendarDateToUtcMillis(date);
  return {
    start: new Date(dayMs - 14 * MS_PER_HOUR),
    end: new Date(dayMs + 38 * MS_PER_HOUR),
  };
}

// Profil réservable : compte BARBER actif ET profil approuvé par l'admin
// (issue #40). Sinon 404, comme pour un profil inexistant.
async function assertActiveBarber(
  runner: typeof db,
  profile: { userId: string; approvedAt: Date | null },
): Promise<void> {
  if (!profile.approvedAt) {
    throw new AppError(404, "BARBER_NOT_FOUND", "Profil introuvable.");
  }
  const [owner] = await runner
    .select({ status: users.status, role: users.role })
    .from(users)
    .where(eq(users.id, profile.userId))
    .limit(1);
  if (!owner || owner.status !== "ACTIVE" || owner.role !== "BARBER") {
    throw new AppError(404, "BARBER_NOT_FOUND", "Profil introuvable.");
  }
}

// Réservations qui occupent un créneau : CONFIRMED, et PENDING non échues.
// Une demande échue (24 h ou début atteint) libère le créneau dès la lecture,
// avant même que le balayage ne persiste son statut EXPIRED.
// Réservations qui occupent un créneau : voir `occupiesSlotCondition`.
async function loadBusy(
  runner: typeof db,
  barberProfileId: string,
  date: string,
  now: Date,
): Promise<{ startAt: Date; endAt: Date }[]> {
  const window = busyWindow(date);
  return runner
    .select({ startAt: bookings.startAt, endAt: bookings.endAt })
    .from(bookings)
    .where(
      and(
        eq(bookings.barberProfileId, barberProfileId),
        occupiesSlotCondition(now),
        lt(bookings.startAt, window.end),
        gt(bookings.endAt, window.start),
      ),
    );
}

async function loadWorkingHours(
  runner: typeof db,
  barberProfileId: string,
  date: string,
) {
  const weekday = weekdayFromCalendarDate(date);
  return runner
    .select()
    .from(barberWorkingHours)
    .where(
      and(
        eq(barberWorkingHours.barberProfileId, barberProfileId),
        eq(barberWorkingHours.weekday, weekday),
      ),
    );
}

async function loadTimeOff(
  runner: typeof db,
  barberProfileId: string,
  date: string,
) {
  return runner
    .select()
    .from(barberTimeOff)
    .where(
      and(
        eq(barberTimeOff.barberProfileId, barberProfileId),
        lte(barberTimeOff.startDate, date),
        gte(barberTimeOff.endDate, date),
      ),
    );
}

function toSlotInputs(
  hours: Awaited<ReturnType<typeof loadWorkingHours>>,
  timeOff: Awaited<ReturnType<typeof loadTimeOff>>,
  busy: { startAt: Date; endAt: Date }[],
) {
  return {
    workingHours: hours.map((h) => ({
      weekday: h.weekday as Weekday,
      startMinute: h.startMinute,
      endMinute: h.endMinute,
    })),
    timeOff: timeOff.map((t) => ({
      startDate: t.startDate,
      endDate: t.endDate,
    })),
    busy,
  };
}

// Profil réservable + service actif + lieu proposé : mêmes contrôles pour la
// lecture d'un jour et d'une plage.
async function loadBookableContext(
  barberId: string,
  query: { serviceId: string; place: ServicePlace },
) {
  const [profile] = await db
    .select()
    .from(barberProfiles)
    .where(eq(barberProfiles.id, barberId))
    .limit(1);
  if (!profile) {
    throw new AppError(404, "BARBER_NOT_FOUND", "Profil introuvable.");
  }
  await assertActiveBarber(db, profile);
  if (!profile.timezone) {
    throw new AppError(
      409,
      "BARBER_TIMEZONE_MISSING",
      "Ce professionnel n'a pas renseigné son fuseau horaire.",
    );
  }

  const [service] = await db
    .select()
    .from(barberServices)
    .where(
      and(
        eq(barberServices.id, query.serviceId),
        eq(barberServices.barberProfileId, profile.id),
        eq(barberServices.isActive, true),
      ),
    )
    .limit(1);
  if (!service) {
    throw new AppError(404, "SERVICE_NOT_FOUND", "Service introuvable.");
  }

  await assertPlaceOffered(profile.id, query.place);
  return { profile, timezone: profile.timezone, service };
}

// Plage de jours (lot N2) : horaires, absences et réservations chargés UNE
// fois pour toute la plage ; le calcul de chaque jour réutilise le moteur
// partagé. Jours hors horizon : `slots: []` (le moteur les écarte).
export async function getBookingSlotsRange(
  barberId: string,
  query: BookingSlotsRangeQuery,
): Promise<BookingSlotsDay[]> {
  const { profile, timezone, service } = await loadBookableContext(
    barberId,
    query,
  );
  const dates = Array.from({ length: query.days }, (_, i) =>
    addCalendarDays(query.from, i),
  );
  const firstDate = dates[0];
  const lastDate = dates[dates.length - 1];
  const now = new Date();

  const [hours, timeOff, busy] = await Promise.all([
    db
      .select()
      .from(barberWorkingHours)
      .where(eq(barberWorkingHours.barberProfileId, profile.id)),
    db
      .select()
      .from(barberTimeOff)
      .where(
        and(
          eq(barberTimeOff.barberProfileId, profile.id),
          lte(barberTimeOff.startDate, lastDate),
          gte(barberTimeOff.endDate, firstDate),
        ),
      ),
    db
      .select({ startAt: bookings.startAt, endAt: bookings.endAt })
      .from(bookings)
      .where(
        and(
          eq(bookings.barberProfileId, profile.id),
          occupiesSlotCondition(now),
          lt(bookings.startAt, busyWindow(lastDate).end),
          gt(bookings.endAt, busyWindow(firstDate).start),
        ),
      ),
  ]);
  const context = toSlotInputs(hours, timeOff, busy);

  return dates.map((date) => ({
    date,
    slots: computeBookingSlots({
      date,
      timezone,
      durationMinutes: service.durationMinutes,
      ...context,
      now,
      leadTimeMinutes: LIMITS.bookingLeadTimeMinutes,
      horizonDays: LIMITS.bookingHorizonDays,
    }).map((slot) => ({
      startAt: slot.startAt,
      endAt: slot.endAt,
      startMinute: slot.startMinute,
    })),
  }));
}

function addCalendarDays(date: string, days: number): string {
  return new Date(calendarDateToUtcMillis(date) + days * 86_400_000)
    .toISOString()
    .slice(0, 10);
}

export async function getBookingSlots(
  barberId: string,
  query: BookingSlotsQuery,
): Promise<BookingSlotDto[]> {
  const { profile, timezone, service } = await loadBookableContext(
    barberId,
    query,
  );

  const now = new Date();
  const [hours, timeOff, busy] = await Promise.all([
    loadWorkingHours(db, profile.id, query.date),
    loadTimeOff(db, profile.id, query.date),
    loadBusy(db, profile.id, query.date, now),
  ]);
  const context = toSlotInputs(hours, timeOff, busy);

  return computeBookingSlots({
    date: query.date,
    timezone,
    durationMinutes: service.durationMinutes,
    ...context,
    now,
    leadTimeMinutes: LIMITS.bookingLeadTimeMinutes,
    horizonDays: LIMITS.bookingHorizonDays,
  }).map((slot) => ({
    startAt: slot.startAt,
    endAt: slot.endAt,
    startMinute: slot.startMinute,
  }));
}

async function assertPlaceOffered(
  barberProfileId: string,
  place: ServicePlace,
): Promise<void> {
  const [row] = await db
    .select({ place: barberProfilePlaces.place })
    .from(barberProfilePlaces)
    .where(
      and(
        eq(barberProfilePlaces.barberProfileId, barberProfileId),
        eq(barberProfilePlaces.place, place),
      ),
    )
    .limit(1);
  if (!row) {
    throw new AppError(
      409,
      "PLACE_NOT_OFFERED",
      "Ce lieu de prestation n'est pas proposé par ce professionnel.",
    );
  }
}

export async function createBooking(
  clientUserId: string,
  input: BookingCreateInput,
): Promise<{ booking: Booking; checkoutUrl: string | null }> {
  let booking: Booking;
  try {
    booking = await createBookingInTransaction(clientUserId, input);
  } catch (err) {
    // Filet en base : la contrainte d'exclusion `bookings_no_overlap` a refusé
    // un chevauchement que le verrou applicatif aurait dû empêcher.
    if (isExclusionViolation(err)) {
      throw new AppError(
        409,
        "SLOT_UNAVAILABLE",
        "Ce créneau n'est plus disponible.",
      );
    }
    throw err;
  }

  // Paiement en ligne exigé (issue #10) : session Checkout ouverte APRÈS
  // commit (jamais d'appel réseau sous le verrou du profil).
  if (booking.paymentStatus !== "REQUIRES_PAYMENT") {
    return { booking, checkoutUrl: null };
  }
  const checkoutUrl = await openCheckout(booking.id);
  return { booking: { ...booking, checkoutUrl }, checkoutUrl };
}

async function createBookingInTransaction(
  clientUserId: string,
  input: BookingCreateInput,
): Promise<Booking> {
  return db.transaction(async (tx) =>
    insertBookingUnderLock(tx as unknown as typeof db, clientUserId, input),
  );
}

export interface InsertBookingOptions {
  /**
   * Réservation express (lot N6) : la demande attend la confirmation de
   * l'email jusqu'à cette échéance, sans notifier le barber. Refusée si le
   * barber exige un paiement en ligne.
   */
  emailConfirmExpiresAt?: Date;
}

/**
 * Crée la demande sous le verrou du profil, dans la transaction `runner`
 * fournie par l'appelant (création seule, ou création du compte puis de la
 * demande pour la réservation express).
 */
export async function insertBookingUnderLock(
  runner: typeof db,
  clientUserId: string,
  input: BookingCreateInput,
  options: InsertBookingOptions = {},
): Promise<Booking> {
  // 1. Verrou du profil : sérialise les créations simultanées du même barber.
  const [profile] = await runner
    .select()
    .from(barberProfiles)
    .where(eq(barberProfiles.id, input.barberId))
    .limit(1)
    .for("update");
  if (!profile) {
    throw new AppError(404, "BARBER_NOT_FOUND", "Profil introuvable.");
  }
  await assertActiveBarber(runner, profile);
  if (!profile.timezone) {
    throw new AppError(
      409,
      "BARBER_TIMEZONE_MISSING",
      "Ce professionnel n'a pas renseigné son fuseau horaire.",
    );
  }

  // 2. Service actif appartenant bien à ce professionnel.
  const [service] = await runner
    .select()
    .from(barberServices)
    .where(
      and(
        eq(barberServices.id, input.serviceId),
        eq(barberServices.barberProfileId, profile.id),
        eq(barberServices.isActive, true),
      ),
    )
    .limit(1);
  if (!service) {
    throw new AppError(404, "SERVICE_NOT_FOUND", "Service introuvable.");
  }

  // 3. Lieu proposé.
  const [placeRow] = await runner
    .select({ place: barberProfilePlaces.place })
    .from(barberProfilePlaces)
    .where(
      and(
        eq(barberProfilePlaces.barberProfileId, profile.id),
        eq(barberProfilePlaces.place, input.place),
      ),
    )
    .limit(1);
  if (!placeRow) {
    throw new AppError(
      409,
      "PLACE_NOT_OFFERED",
      "Ce lieu de prestation n'est pas proposé par ce professionnel.",
    );
  }

  // 3b. Adresse client privée : requise et géocodée seulement pour AT_CLIENT ;
  // nulle (non stockée) pour SALON / AT_PROVIDER. Le géocodage et le contrôle
  // de zone sont faits ici, sous le verrou du profil.
  const clientLocation =
    input.place === "AT_CLIENT"
      ? await resolveClientLocation(profile, input.clientAddress as string)
      : null;

  // 4. Les demandes échues de ce barber passent en EXPIRED (sous verrou) :
  // elles ne bloquent plus le créneau ni la contrainte d'exclusion.
  const now = new Date();
  await expireStalePendingBookings(runner, now, profile.id);

  // 4b. Plafond des demandes en attente du client, chez ce barber (compté
  // sous le verrou du profil) et au total : un seul compte ne peut pas
  // bloquer un agenda en réservant tous les créneaux.
  const [pending] = await runner
    .select({
      total: sql<number>`count(*)::int`,
      here: sql<number>`(count(*) filter (where ${bookings.barberProfileId} = ${profile.id}))::int`,
    })
    .from(bookings)
    .where(and(eq(bookings.clientUserId, clientUserId), activePendingCondition(now)));
  if (
    (pending?.here ?? 0) >= LIMITS.clientPendingMaxPerBarber ||
    (pending?.total ?? 0) >= LIMITS.clientPendingMaxTotal
  ) {
    throw new AppError(
      409,
      "TOO_MANY_PENDING_BOOKINGS",
      "Vous avez déjà trop de demandes en attente : attendez la réponse du professionnel ou annulez-en une.",
    );
  }

  // 5. Contexte de disponibilité, relu SOUS verrou.
  const [hours, timeOff, busy] = await Promise.all([
    loadWorkingHours(runner, profile.id, input.date),
    loadTimeOff(runner, profile.id, input.date),
    loadBusy(runner, profile.id, input.date, now),
  ]);
  const context = toSlotInputs(hours, timeOff, busy);

  // 6. Créneau recalculé côté serveur : le client ne peut pas le forger.
  const slot = computeBookingSlots({
    date: input.date,
    timezone: profile.timezone,
    durationMinutes: service.durationMinutes,
    ...context,
    now,
    leadTimeMinutes: LIMITS.bookingLeadTimeMinutes,
    horizonDays: LIMITS.bookingHorizonDays,
  }).find((candidate) => candidate.startMinute === input.startMinute);
  if (!slot) {
    throw new AppError(
      409,
      "SLOT_UNAVAILABLE",
      "Ce créneau n'est plus disponible.",
    );
  }

  // 7. Paiement en ligne exigé par le barber (issue #10).
  const payment = paymentRequirementFor(profile, service.priceMinor);
  const emailHoldUntil = options.emailConfirmExpiresAt ?? null;
  if (emailHoldUntil && payment) {
    throw new AppError(
      409,
      "EXPRESS_BOOKING_PAYMENT_REQUIRED",
      "Ce professionnel demande un paiement en ligne : créez un compte ou connectez-vous pour réserver.",
    );
  }
  if (emailHoldUntil) {
    // Plafond des demandes express non confirmées chez ce barber (sous le
    // verrou du profil) : des adresses jetables ne peuvent pas bloquer tout
    // son agenda.
    const [held] = await runner
      .select({ count: sql<number>`count(*)::int` })
      .from(bookings)
      .where(
        and(
          eq(bookings.barberProfileId, profile.id),
          eq(bookings.status, "PENDING"),
          gt(bookings.emailConfirmExpiresAt, now),
        ),
      );
    if ((held?.count ?? 0) >= LIMITS.expressPendingMaxPerBarber) {
      throw new AppError(
        409,
        "EXPRESS_BOOKING_TOO_MANY",
        "Trop de demandes sont en attente chez ce professionnel : réessayez dans quelques minutes, ou connectez-vous.",
      );
    }
  }

  // 8. Insertion avec snapshots figés.
  const [row] = await runner
    .insert(bookings)
    .values({
      id: randomUUID(),
      clientUserId,
      barberProfileId: profile.id,
      serviceId: service.id,
      startAt: new Date(slot.startAt),
      endAt: new Date(slot.endAt),
      servicePlace: input.place,
      status: "PENDING",
      barberDisplayName: profile.displayName,
      serviceName: service.name,
      serviceDescription: service.description,
      durationMinutes: service.durationMinutes,
      priceMinor: service.priceMinor,
      currency: profile.currency,
      clientAddress:
        input.place === "AT_CLIENT"
          ? encryptField(input.clientAddress ?? null)
          : null,
      clientLatitude: clientLocation?.latitude ?? null,
      clientLongitude: clientLocation?.longitude ?? null,
      ...(payment
        ? {
            paymentStatus: "REQUIRES_PAYMENT" as const,
            amountDueMinor: payment.amountDueMinor,
            platformFeeMinor: payment.platformFeeMinor,
            paymentExpiresAt: new Date(now.getTime() + PAYMENT_HOLD_MS),
          }
        : {}),
      emailConfirmExpiresAt: emailHoldUntil,
      // Horloge applicative (pas `now()` SQL) : l'échéance des 24 h se
      // calcule avec la même horloge que les contrôles d'expiration.
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  // Notification BARBER : nouvelle demande de réservation (même
  // transaction). Si un paiement est exigé, le barber n'est prévenu qu'une
  // fois le paiement reçu (webhook Stripe) ; pour une réservation express,
  // qu'au clic sur le lien de l'email (lot N6).
  if (!payment && !emailHoldUntil) {
    await notifyBookingEvent(runner, {
      recipientUserId: profile.userId,
      actorUserId: clientUserId,
      bookingId: row.id,
      type: "BOOKING_REQUESTED",
    });
  }

  const [client] = await runner
    .select({ name: users.name })
    .from(users)
    .where(eq(users.id, clientUserId))
    .limit(1);
  // Nouveau créneau occupé : disponibilité de la recherche à recalculer.
  invalidateAvailability(row.barberProfileId);
  return toBooking(row, client?.name ?? null);
}

// --- Résolution du profil barber de l'utilisateur connecté ---
// Point unique pour ancrer les contrôles d'ownership : aucun identifiant de
// profil n'est jamais accepté du frontend. Retourne `null` si l'utilisateur
// n'a pas encore de profil (l'appelant choisit alors le code d'erreur adapté).
async function findOwnBarberProfileId(userId: string): Promise<string | null> {
  const [profile] = await db
    .select({ id: barberProfiles.id })
    .from(barberProfiles)
    .where(eq(barberProfiles.userId, userId))
    .limit(1);
  return profile?.id ?? null;
}

async function requireOwnBarberProfileId(userId: string): Promise<string> {
  const profileId = await findOwnBarberProfileId(userId);
  if (!profileId) {
    throw new AppError(
      404,
      "BARBER_PROFILE_NOT_FOUND",
      "Aucun profil professionnel.",
    );
  }
  return profileId;
}

export async function listBookings(user: AuthUser): Promise<Booking[]> {
  if (user.role === "BARBER") {
    const profileId = await requireOwnBarberProfileId(user.id);
    const rows = await db
      .select({ booking: bookings, clientName: users.name, reviewId: reviews.id })
      .from(bookings)
      .leftJoin(users, eq(users.id, bookings.clientUserId))
      .leftJoin(reviews, eq(reviews.bookingId, bookings.id))
      .where(and(eq(bookings.barberProfileId, profileId), visibleToBarber))
      .orderBy(asc(bookings.startAt));
    return rows.map((row) =>
      toBooking(row.booking, row.clientName, row.reviewId !== null),
    );
  }

  if (user.role !== "CLIENT") {
    throw new AppError(403, "FORBIDDEN", "Insufficient permissions.");
  }

  const rows = await db
    .select({ booking: bookings, clientName: users.name, reviewId: reviews.id })
    .from(bookings)
    .leftJoin(users, eq(users.id, bookings.clientUserId))
    .leftJoin(reviews, eq(reviews.bookingId, bookings.id))
    .where(eq(bookings.clientUserId, user.id))
    .orderBy(asc(bookings.startAt));
  return rows.map((row) =>
    toBooking(row.booking, row.clientName, row.reviewId !== null),
  );
}

// Détail privé d'une réservation : adresse et coordonnées exactes du client,
// réservées au CLIENT propriétaire, au BARBER concerné et à ADMIN. Tout autre
// appel reçoit 404 (aucune fuite d'existence ni d'adresse).
export async function getBookingDetails(
  user: AuthUser,
  bookingId: string,
): Promise<BookingDetails> {
  const [row] = await db
    .select()
    .from(bookings)
    .where(eq(bookings.id, bookingId))
    .limit(1);
  if (!row) {
    throw bookingNotFound();
  }

  // Un BARBER sans profil n'obtient PAS `BARBER_PROFILE_NOT_FOUND` ici : la
  // policy renvoie le même 404 `BOOKING_NOT_FOUND` que pour un non-propriétaire
  // (aucune fuite sur l'existence du profil ni de la réservation).
  const barberProfileId =
    user.role === "BARBER" ? await findOwnBarberProfileId(user.id) : null;
  assertBookingReadAccess(user, row, barberProfileId);
  // Demande non payée ou abandonnée (issue #10), ou réservation express dont
  // l'email n'est pas confirmé (lot N6) : invisible du barber.
  if (user.role === "BARBER" && hiddenFromBarber(row)) {
    throw bookingNotFound();
  }

  const [client] = await db
    .select({ name: users.name })
    .from(users)
    .where(eq(users.id, row.clientUserId))
    .limit(1);
  const [review] = await db
    .select({ id: reviews.id })
    .from(reviews)
    .where(eq(reviews.bookingId, bookingId))
    .limit(1);
  return toBookingDetails(
    row,
    client?.name ?? null,
    review !== undefined,
    await barberAddressForClient(user, row),
  );
}

// Itinéraire (lot N3, décision du propriétaire) : l'adresse exacte du barber
// n'est révélée qu'au client propriétaire, une fois le rendez-vous CONFIRMED,
// et seulement si le client se déplace (salon ou chez le professionnel).
async function barberAddressForClient(
  user: AuthUser,
  row: BookingRow,
): Promise<string | null> {
  if (
    user.role !== "CLIENT" ||
    row.clientUserId !== user.id ||
    row.status !== "CONFIRMED" ||
    (row.servicePlace !== "SALON" && row.servicePlace !== "AT_PROVIDER")
  ) {
    return null;
  }
  const [profile] = await db
    .select({ address: barberProfiles.address })
    .from(barberProfiles)
    .where(eq(barberProfiles.id, row.barberProfileId))
    .limit(1);
  const address = profile?.address?.trim();
  return address ? address : null;
}

// --- Transitions de statut (lot 4 rouvert) ---
// Point d'entrée UNIQUE de toutes les transitions déclenchées par un
// utilisateur. Dans UNE transaction : verrou de la ligne (`FOR UPDATE`),
// contrôle d'appartenance, machine à états partagée (`canTransitionBooking`),
// règles temporelles, puis UPDATE gardé par le statut lu (`AND status = from`).
// Une transition concurrente ne peut donc jamais être écrasée : c'était le bug
// « annulée → confirmée » (contrôle hors transaction + UPDATE non gardé).

type UserTransitionTarget =
  | "CONFIRMED"
  | "DECLINED"
  | "COMPLETED"
  | "NO_SHOW"
  | "CANCELLED";

const INVALID_TRANSITION_MESSAGES: Record<UserTransitionTarget, string> = {
  CONFIRMED: "Seule une réservation en attente peut être confirmée.",
  DECLINED: "Seule une réservation en attente peut être refusée.",
  COMPLETED:
    "Seule une réservation confirmée peut être marquée comme terminée.",
  NO_SHOW:
    "Seule une réservation confirmée peut être marquée comme absence du client.",
  CANCELLED: "Cette réservation ne peut plus être annulée.",
};

function invalidTransition(to: UserTransitionTarget): AppError {
  return new AppError(
    409,
    "INVALID_STATUS_TRANSITION",
    INVALID_TRANSITION_MESSAGES[to],
  );
}

const AUDIT_ACTION_BY_TARGET: Record<UserTransitionTarget, AuditAction> = {
  CONFIRMED: "BOOKING_CONFIRMED",
  DECLINED: "BOOKING_DECLINED",
  COMPLETED: "BOOKING_COMPLETED",
  NO_SHOW: "BOOKING_NO_SHOW",
  CANCELLED: "BOOKING_CANCELLED",
};

interface TransitionRequest {
  user: AuthUser;
  bookingId: string;
  to: UserTransitionTarget;
  declineReason?: string | null;
}

function notificationsFor(
  to: UserTransitionTarget,
  actor: AuthUser["role"],
  clientUserId: string,
  barberUserId: string | null,
): { recipientUserId: string; type: NotificationType }[] {
  const toClient = (type: NotificationType) => [
    { recipientUserId: clientUserId, type },
  ];
  switch (to) {
    case "CONFIRMED":
      return toClient("BOOKING_CONFIRMED");
    case "DECLINED":
      return toClient("BOOKING_DECLINED");
    case "COMPLETED":
      return toClient("BOOKING_COMPLETED");
    case "NO_SHOW":
      return toClient("BOOKING_NO_SHOW");
    case "CANCELLED":
      if (actor === "CLIENT") {
        return barberUserId
          ? [{ recipientUserId: barberUserId, type: "BOOKING_CANCELLED_BY_CLIENT" }]
          : [];
      }
      if (actor === "BARBER") return toClient("BOOKING_CANCELLED_BY_BARBER");
      return [
        ...toClient("BOOKING_CANCELLED_BY_ADMIN"),
        ...(barberUserId
          ? [{ recipientUserId: barberUserId, type: "BOOKING_CANCELLED_BY_ADMIN" as const }]
          : []),
      ];
  }
}

function transitionValues(
  request: TransitionRequest,
  now: Date,
): PgUpdateSetSource<typeof bookings> & { status: BookingStatus } {
  switch (request.to) {
    case "CANCELLED":
      return {
        status: "CANCELLED",
        cancelledBy: request.user.role,
        cancelledAt: now,
        paymentStatus: paymentStatusOnCancel,
        paymentExpiresAt: null,
        updatedAt: now,
      };
    case "DECLINED":
      return {
        status: "DECLINED",
        declinedAt: now,
        declineReason: request.declineReason ?? null,
        paymentStatus: paymentStatusOnCancel,
        paymentExpiresAt: null,
        updatedAt: now,
      };
    default:
      return { status: request.to, updatedAt: now };
  }
}

async function transitionBooking(request: TransitionRequest): Promise<Booking> {
  const { user, bookingId, to } = request;
  if (user.role !== "CLIENT" && user.role !== "BARBER" && user.role !== "ADMIN") {
    throw new AppError(403, "FORBIDDEN", "Insufficient permissions.");
  }
  const ownProfileId =
    user.role === "BARBER" ? await requireOwnBarberProfileId(user.id) : null;

  const updated = await db.transaction(async (tx) => {
    const runner = tx as unknown as typeof db;

    // 1. Verrou de la ligne : sérialise les transitions concurrentes.
    const [existing] = await runner
      .select()
      .from(bookings)
      .where(eq(bookings.id, bookingId))
      .limit(1)
      .for("update");

    // 2. Appartenance : 404 unique pour inexistante ou non possédée
    // (politique centralisée dans lib/authorization).
    assertBookingTransitionAccess(user, existing, ownProfileId);
    // Demande pas encore payée (issue #10) : invisible du barber.
    const awaitingPayment = existing.paymentStatus === "REQUIRES_PAYMENT";
    // Réservation express non confirmée (lot N6) : invisible du barber aussi.
    if (user.role === "BARBER" && hiddenFromBarber(existing)) {
      throw bookingNotFound();
    }

    // 3. Demande échue : plus aucune action utilisateur possible.
    const now = new Date();
    if (isPendingBookingExpired(existing, now)) {
      throw new AppError(
        409,
        "BOOKING_EXPIRED",
        "Cette demande a expiré faute de réponse.",
      );
    }

    // 4. Machine à états partagée.
    if (!canTransitionBooking(existing.status, to, user.role)) {
      throw invalidTransition(to);
    }

    // 5. Règles temporelles.
    if (to === "CANCELLED" && user.role === "CLIENT") {
      const deadline =
        existing.startAt.getTime() -
        LIMITS.bookingClientCancelMinMinutes * 60_000;
      if (now.getTime() > deadline) {
        throw new AppError(
          409,
          "CANCELLATION_TOO_LATE",
          "Annulation trop tardive : le délai est dépassé.",
        );
      }
    }
    // Jamais avant la fin réelle de la prestation : sinon un avis pourrait être
    // déposé pour un rendez-vous qui n'a pas encore eu lieu.
    if (to === "COMPLETED" && !isBookingEnded(existing.endAt, now)) {
      throw new AppError(
        409,
        "BOOKING_NOT_ENDED",
        "Une réservation ne peut être marquée comme terminée qu'après la fin de la prestation.",
      );
    }

    // Absence (lot N8) : seulement après le début et dans les 48 h qui suivent.
    // Aucun effet sur le paiement (décision de retenue non prise).
    if (to === "NO_SHOW" && !canMarkNoShow(existing.startAt, now)) {
      throw new AppError(
        409,
        "NO_SHOW_WINDOW",
        `Une absence ne peut être marquée qu'après le début du rendez-vous et au plus tard ${NO_SHOW_WINDOW_HOURS} heures après.`,
      );
    }

    // 6. UPDATE gardé par le statut lu (défense en profondeur).
    const [row] = await runner
      .update(bookings)
      .set(transitionValues(request, now))
      .where(and(eq(bookings.id, bookingId), eq(bookings.status, existing.status)))
      .returning();
    if (!row) {
      throw invalidTransition(to);
    }

    // 7. Journal d'audit (même transaction, issue #13).
    await recordAudit(runner, {
      actor: user,
      action: AUDIT_ACTION_BY_TARGET[to],
      targetType: "BOOKING",
      targetId: row.id,
      metadata: { from: existing.status, to },
    });

    // 8. Notifications (même transaction).
    const [profile] = await runner
      .select({ userId: barberProfiles.userId })
      .from(barberProfiles)
      .where(eq(barberProfiles.id, row.barberProfileId))
      .limit(1);
    // Une demande jamais payée n'a jamais été montrée au barber : aucune
    // notification de son annulation.
    for (const notification of awaitingPayment ? [] : notificationsFor(
      to,
      user.role,
      row.clientUserId,
      profile?.userId ?? null,
    )) {
      await notifyBookingEvent(runner, {
        ...notification,
        actorUserId: user.id,
        bookingId: row.id,
      });
    }

    return row;
  });

  const [client] = await db
    .select({ name: users.name })
    .from(users)
    .where(eq(users.id, updated.clientUserId))
    .limit(1);
  const [review] = await db
    .select({ id: reviews.id })
    .from(reviews)
    .where(eq(reviews.bookingId, updated.id))
    .limit(1);
  // Le créneau est libéré ou occupé autrement : disponibilité à recalculer.
  invalidateAvailability(updated.barberProfileId);
  return toBooking(updated, client?.name ?? null, review !== undefined);
}

// Confirmation : BARBER propriétaire, PENDING → CONFIRMED.
export function confirmBooking(user: AuthUser, bookingId: string) {
  return transitionBooking({ user, bookingId, to: "CONFIRMED" });
}

// Refus : BARBER propriétaire, PENDING → DECLINED, motif facultatif.
export function declineBooking(
  user: AuthUser,
  bookingId: string,
  reason: string | null,
) {
  return transitionBooking({
    user,
    bookingId,
    to: "DECLINED",
    declineReason: reason,
  });
}

// Marquage terminé (lot 11) : BARBER propriétaire, CONFIRMED → COMPLETED,
// seulement après la fin réelle de la prestation.
export function completeBooking(user: AuthUser, bookingId: string) {
  return transitionBooking({ user, bookingId, to: "COMPLETED" });
}

// Absence du client (lot N8) : BARBER propriétaire, CONFIRMED → NO_SHOW, dans
// la fenêtre de 48 h après le début. Le paiement n'est pas modifié.
export function markBookingNoShow(user: AuthUser, bookingId: string) {
  return transitionBooking({ user, bookingId, to: "NO_SHOW" });
}

// Annulation : CLIENT (délai 2 h), BARBER propriétaire ou ADMIN (sans délai).
export function cancelBooking(user: AuthUser, bookingId: string) {
  return transitionBooking({ user, bookingId, to: "CANCELLED" });
}
