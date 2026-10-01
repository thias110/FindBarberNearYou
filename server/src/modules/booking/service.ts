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
  users,
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
  BookingSlotDto,
  Role,
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
import { AppError } from "../../lib/errors.js";

const MS_PER_HOUR = 3_600_000;

function toBooking(row: BookingRow, clientName: string | null): Booking {
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
    cancelledBy: row.cancelledBy,
    cancelledAt: row.cancelledAt ? row.cancelledAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
  };
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

export async function listBookings(user: {
  id: string;
  role: Role;
}): Promise<Booking[]> {
  if (user.role === "BARBER") {
    const [profile] = await db
      .select({ id: barberProfiles.id })
      .from(barberProfiles)
      .where(eq(barberProfiles.userId, user.id))
      .limit(1);
    if (!profile) {
      throw new AppError(
        404,
        "BARBER_PROFILE_NOT_FOUND",
        "Aucun profil professionnel.",
      );
    }
    const rows = await db
      .select({ booking: bookings, clientName: users.name })
      .from(bookings)
      .leftJoin(users, eq(users.id, bookings.clientUserId))
      .where(eq(bookings.barberProfileId, profile.id))
      .orderBy(asc(bookings.startAt));
    return rows.map((row) => toBooking(row.booking, row.clientName));
  }

  const rows = await db
    .select({ booking: bookings, clientName: users.name })
    .from(bookings)
    .leftJoin(users, eq(users.id, bookings.clientUserId))
    .where(eq(bookings.clientUserId, user.id))
    .orderBy(asc(bookings.startAt));
  return rows.map((row) => toBooking(row.booking, row.clientName));
}

export async function confirmBooking(
  barberUserId: string,
  bookingId: string,
): Promise<Booking> {
  const [profile] = await db
    .select({ id: barberProfiles.id })
    .from(barberProfiles)
    .where(eq(barberProfiles.userId, barberUserId))
    .limit(1);
  if (!profile) {
    throw new AppError(
      404,
      "BARBER_PROFILE_NOT_FOUND",
      "Aucun profil professionnel.",
    );
  }

  const [existing] = await db
    .select()
    .from(bookings)
    .where(
      and(
        eq(bookings.id, bookingId),
        eq(bookings.barberProfileId, profile.id),
      ),
    )
    .limit(1);
  if (!existing) {
    throw new AppError(404, "BOOKING_NOT_FOUND", "Réservation introuvable.");
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
        eq(bookings.barberProfileId, profile.id),
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
  user: { id: string; role: Role },
  bookingId: string,
): Promise<Booking> {
  let existing: BookingRow | undefined;

  if (user.role === "BARBER") {
    const [profile] = await db
      .select({ id: barberProfiles.id })
      .from(barberProfiles)
      .where(eq(barberProfiles.userId, user.id))
      .limit(1);
    if (!profile) {
      throw new AppError(
        404,
        "BARBER_PROFILE_NOT_FOUND",
        "Aucun profil professionnel.",
      );
    }
    [existing] = await db
      .select()
      .from(bookings)
      .where(
        and(
          eq(bookings.id, bookingId),
          eq(bookings.barberProfileId, profile.id),
        ),
      )
      .limit(1);
  } else {
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
  }

  if (!existing) {
    throw new AppError(404, "BOOKING_NOT_FOUND", "Réservation introuvable.");
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
