import { randomUUID } from "node:crypto";
import { and, asc, eq, gt, gte, inArray, lt, lte } from "drizzle-orm";
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
import {
  ACTIVE_BOOKING_STATUSES,
  LIMITS,
} from "@findbarber/shared/constants";
import type {
  ServicePlace,
  Weekday,
} from "@findbarber/shared/constants";
import type {
  Booking,
  BookingDetails,
  BookingSlotDto,
} from "@findbarber/shared/types";
import type {
  BookingCreateInput,
  BookingSlotsQuery,
} from "@findbarber/shared/validation";
import { computeBookingSlots } from "@findbarber/shared/booking";
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
import { AppError } from "../../lib/errors.js";
import {
  assertBookingReadAccess,
  bookingNotFound,
  type AuthUser,
} from "../../lib/authorization.js";

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
    status: row.status,
    startAt: row.startAt.toISOString(),
    endAt: row.endAt.toISOString(),
    clientName,
    hasReview,
    cancelledBy: row.cancelledBy,
    cancelledAt: row.cancelledAt ? row.cancelledAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
  };
}

function toBookingDetails(
  row: BookingRow,
  clientName: string | null,
  hasReview = false,
): BookingDetails {
  return {
    ...toBooking(row, clientName, hasReview),
    clientAddress: row.clientAddress,
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

async function assertActiveBarber(
  runner: typeof db,
  profileUserId: string,
): Promise<void> {
  const [owner] = await runner
    .select({ status: users.status, role: users.role })
    .from(users)
    .where(eq(users.id, profileUserId))
    .limit(1);
  if (!owner || owner.status !== "ACTIVE" || owner.role !== "BARBER") {
    throw new AppError(404, "BARBER_NOT_FOUND", "Profil introuvable.");
  }
}

async function loadBusy(
  runner: typeof db,
  barberProfileId: string,
  date: string,
): Promise<{ startAt: Date; endAt: Date }[]> {
  const window = busyWindow(date);
  return runner
    .select({ startAt: bookings.startAt, endAt: bookings.endAt })
    .from(bookings)
    .where(
      and(
        eq(bookings.barberProfileId, barberProfileId),
        inArray(bookings.status, [...ACTIVE_BOOKING_STATUSES]),
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

export async function getBookingSlots(
  barberId: string,
  query: BookingSlotsQuery,
): Promise<BookingSlotDto[]> {
  const [profile] = await db
    .select()
    .from(barberProfiles)
    .where(eq(barberProfiles.id, barberId))
    .limit(1);
  if (!profile) {
    throw new AppError(404, "BARBER_NOT_FOUND", "Profil introuvable.");
  }
  await assertActiveBarber(db, profile.userId);
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

  const [hours, timeOff, busy] = await Promise.all([
    loadWorkingHours(db, profile.id, query.date),
    loadTimeOff(db, profile.id, query.date),
    loadBusy(db, profile.id, query.date),
  ]);
  const context = toSlotInputs(hours, timeOff, busy);

  return computeBookingSlots({
    date: query.date,
    timezone: profile.timezone,
    durationMinutes: service.durationMinutes,
    ...context,
    now: new Date(),
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
): Promise<Booking> {
  return db.transaction(async (tx) => {
    const runner = tx as unknown as typeof db;

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
    await assertActiveBarber(runner, profile.userId);
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

    // 4. Contexte de disponibilité, relu SOUS verrou.
    const [hours, timeOff, busy] = await Promise.all([
      loadWorkingHours(runner, profile.id, input.date),
      loadTimeOff(runner, profile.id, input.date),
      loadBusy(runner, profile.id, input.date),
    ]);
    const context = toSlotInputs(hours, timeOff, busy);

    // 5. Créneau recalculé côté serveur : le client ne peut pas le forger.
    const now = new Date();
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

    // 6. Insertion avec snapshots figés.
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
          input.place === "AT_CLIENT" ? (input.clientAddress ?? null) : null,
        clientLatitude: clientLocation?.latitude ?? null,
        clientLongitude: clientLocation?.longitude ?? null,
        updatedAt: now,
      })
      .returning();

    const [client] = await runner
      .select({ name: users.name })
      .from(users)
      .where(eq(users.id, clientUserId))
      .limit(1);
    return toBooking(row, client?.name ?? null);
  });
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
      .where(eq(bookings.barberProfileId, profileId))
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
  return toBookingDetails(row, client?.name ?? null, review !== undefined);
}

export async function confirmBooking(
  barberUserId: string,
  bookingId: string,
): Promise<Booking> {
  const profileId = await requireOwnBarberProfileId(barberUserId);

  const [existing] = await db
    .select()
    .from(bookings)
    .where(
      and(
        eq(bookings.id, bookingId),
        eq(bookings.barberProfileId, profileId),
      ),
    )
    .limit(1);
  if (!existing) {
    throw bookingNotFound();
  }
  if (existing.status !== "PENDING") {
    throw new AppError(
      409,
      "INVALID_STATUS_TRANSITION",
      "Seule une réservation en attente peut être confirmée.",
    );
  }

  const [updated] = await db
    .update(bookings)
    .set({ status: "CONFIRMED", updatedAt: new Date() })
    .where(
      and(
        eq(bookings.id, bookingId),
        eq(bookings.barberProfileId, profileId),
      ),
    )
    .returning();
  const [client] = await db
    .select({ name: users.name })
    .from(users)
    .where(eq(users.id, updated.clientUserId))
    .limit(1);
  return toBooking(updated, client?.name ?? null);
}

// Marquage terminé (lot 11) : seul le BARBER propriétaire peut passer
// CONFIRMED → COMPLETED. Aucun autre statut ne peut devenir COMPLETED ;
// CLIENT et ADMIN sont bloqués en amont par `requireRole("BARBER")`.
export async function completeBooking(
  barberUserId: string,
  bookingId: string,
): Promise<Booking> {
  const profileId = await requireOwnBarberProfileId(barberUserId);

  const [existing] = await db
    .select()
    .from(bookings)
    .where(
      and(
        eq(bookings.id, bookingId),
        eq(bookings.barberProfileId, profileId),
      ),
    )
    .limit(1);
  if (!existing) {
    throw bookingNotFound();
  }
  if (existing.status !== "CONFIRMED") {
    throw new AppError(
      409,
      "INVALID_STATUS_TRANSITION",
      "Seule une réservation confirmée peut être marquée comme terminée.",
    );
  }

  const [updated] = await db
    .update(bookings)
    .set({ status: "COMPLETED", updatedAt: new Date() })
    .where(
      and(
        eq(bookings.id, bookingId),
        eq(bookings.barberProfileId, profileId),
      ),
    )
    .returning();
  const [client] = await db
    .select({ name: users.name })
    .from(users)
    .where(eq(users.id, updated.clientUserId))
    .limit(1);
  return toBooking(updated, client?.name ?? null);
}

export async function cancelBooking(
  user: AuthUser,
  bookingId: string,
): Promise<Booking> {
  let existing: BookingRow | undefined;

  if (user.role === "BARBER") {
    const profileId = await requireOwnBarberProfileId(user.id);
    [existing] = await db
      .select()
      .from(bookings)
      .where(
        and(
          eq(bookings.id, bookingId),
          eq(bookings.barberProfileId, profileId),
        ),
      )
      .limit(1);
  } else if (user.role === "CLIENT") {
    [existing] = await db
      .select()
      .from(bookings)
      .where(
        and(
          eq(bookings.id, bookingId),
          eq(bookings.clientUserId, user.id),
        ),
      )
      .limit(1);
  } else {
    throw new AppError(403, "FORBIDDEN", "Insufficient permissions.");
  }

  if (!existing) {
    throw bookingNotFound();
  }
  if (existing.status !== "PENDING" && existing.status !== "CONFIRMED") {
    throw new AppError(
      409,
      "INVALID_STATUS_TRANSITION",
      "Cette réservation ne peut plus être annulée.",
    );
  }

  const now = new Date();
  if (user.role === "CLIENT") {
    const deadline =
      existing.startAt.getTime() - LIMITS.bookingClientCancelMinMinutes * 60_000;
    if (now.getTime() > deadline) {
      throw new AppError(
        409,
        "CANCELLATION_TOO_LATE",
        "Annulation trop tardive : le délai est dépassé.",
      );
    }
  }

  const [updated] = await db
    .update(bookings)
    .set({
      status: "CANCELLED",
      cancelledBy: user.role,
      cancelledAt: now,
      updatedAt: now,
    })
    .where(eq(bookings.id, bookingId))
    .returning();
  const [client] = await db
    .select({ name: users.name })
    .from(users)
    .where(eq(users.id, updated.clientUserId))
    .limit(1);
  return toBooking(updated, client?.name ?? null);
}
