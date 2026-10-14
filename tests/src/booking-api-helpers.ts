// Helpers des tests d'intégration du moteur de réservation (lot 4 rouvert).
// Comptes et profils insérés directement en base (bcrypt à coût réduit) pour
// garder des suites rapides ; les mutations testées passent, elles, par l'API.
import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import request from "supertest";
import { expect } from "vitest";
import type { Express } from "express";
import { db } from "../../server/src/db/client";
import {
  barberProfilePlaces,
  barberProfiles,
  barberServices,
  barberTimeOff,
  barberWorkingHours,
  bookings,
  notifications,
  reviews,
  users,
} from "@findbarber/shared/schema";
import type { BookingStatus, Weekday } from "@findbarber/shared/constants";

export const PASSWORD = "password123";
const PASSWORD_HASH = bcrypt.hashSync(PASSWORD, 4);

export async function resetBookingTables(): Promise<void> {
  await db.delete(notifications);
  await db.delete(reviews);
  await db.delete(bookings);
  await db.delete(barberTimeOff);
  await db.delete(barberWorkingHours);
  await db.delete(barberProfilePlaces);
  await db.delete(barberServices);
  await db.delete(barberProfiles);
  await db.delete(users);
}

export async function createUser(
  email: string,
  role: "CLIENT" | "BARBER" | "ADMIN",
): Promise<string> {
  const [row] = await db
    .insert(users)
    .values({
      id: randomUUID(),
      email,
      passwordHash: PASSWORD_HASH,
      role,
      status: "ACTIVE",
      emailVerifiedAt: new Date(),
    })
    .returning({ id: users.id });
  return row.id;
}

export interface Session {
  agent: ReturnType<typeof request.agent>;
  csrf: string;
}

export async function login(app: Express, email: string): Promise<Session> {
  const agent = request.agent(app);
  const res = await agent
    .post("/api/auth/login")
    .send({ email, password: PASSWORD });
  expect(res.status).toBe(200);
  return { agent, csrf: res.body.csrfToken as string };
}

export interface SeededBarber {
  userId: string;
  profileId: string;
  serviceId: string;
}

export async function seedBarber(
  email: string,
  options: {
    timezone?: string;
    durationMinutes?: number;
    hours?: { weekday: Weekday; startMinute: number; endMinute: number }[];
  } = {},
): Promise<SeededBarber> {
  const userId = await createUser(email, "BARBER");
  const profileId = randomUUID();
  await db.insert(barberProfiles).values({
    id: profileId,
    userId,
    displayName: "Barbier Test",
    description: "Coupes soignées",
    address: "Rue du Test 1",
    city: "Genève",
    countryCode: "CH",
    latitude: 46.2044,
    longitude: 6.1432,
    currency: "CHF",
    timezone: options.timezone ?? "UTC",
  });
  await db
    .insert(barberProfilePlaces)
    .values({ barberProfileId: profileId, place: "SALON" });
  const serviceId = randomUUID();
  await db.insert(barberServices).values({
    id: serviceId,
    barberProfileId: profileId,
    name: "Coupe classique",
    description: null,
    durationMinutes: options.durationMinutes ?? 30,
    priceMinor: 2500,
  });
  const hours =
    options.hours ??
    ([1, 2, 3, 4, 5, 6, 7] as Weekday[]).map((weekday) => ({
      weekday,
      startMinute: 540,
      endMinute: 1080,
    }));
  if (hours.length > 0) {
    await db.insert(barberWorkingHours).values(
      hours.map((h) => ({
        id: randomUUID(),
        barberProfileId: profileId,
        ...h,
      })),
    );
  }
  return { userId, profileId, serviceId };
}

/** Insère directement une réservation (statut et dates libres). */
export async function insertBooking(input: {
  barber: SeededBarber;
  clientUserId: string;
  startAt: Date;
  status?: BookingStatus;
  createdAt?: Date;
}): Promise<string> {
  const [row] = await db
    .insert(bookings)
    .values({
      id: randomUUID(),
      clientUserId: input.clientUserId,
      barberProfileId: input.barber.profileId,
      serviceId: input.barber.serviceId,
      startAt: input.startAt,
      endAt: new Date(input.startAt.getTime() + 30 * 60_000),
      servicePlace: "SALON",
      status: input.status ?? "PENDING",
      barberDisplayName: "Barbier Test",
      serviceName: "Coupe classique",
      serviceDescription: null,
      durationMinutes: 30,
      priceMinor: 2500,
      currency: "CHF",
      ...(input.createdAt ? { createdAt: input.createdAt } : {}),
    })
    .returning({ id: bookings.id });
  return row.id;
}

/** Date civile UTC à J+n. */
export function futureDate(daysFromNow: number): string {
  const date = new Date();
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() + daysFromNow);
  return date.toISOString().slice(0, 10);
}

export function hoursFromNow(hours: number): Date {
  return new Date(Date.now() + hours * 3_600_000);
}
