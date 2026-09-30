import { randomUUID } from "node:crypto";
import { and, asc, eq, sql } from "drizzle-orm";
import { db } from "../../db/client.js";
import {
  barberProfiles,
  barberServices,
  users,
  type BarberProfile,
  type BarberService,
} from "@findbarber/shared/schema";
import type { CountryCode } from "@findbarber/shared/countries";
import type {
  OwnBarberProfile,
  OwnBarberService,
  PublicBarberProfile,
  PublicBarberProfileWithServices,
  PublicBarberService,
} from "@findbarber/shared/types";
import type {
  ProfileInput,
  ServiceCreateInput,
  ServiceUpdateInput,
} from "@findbarber/shared/validation";
import { AppError } from "../../lib/errors.js";

function toOwnProfile(profile: BarberProfile): OwnBarberProfile {
  return {
    id: profile.id,
    displayName: profile.displayName,
    description: profile.description,
    address: profile.address,
    city: profile.city,
    postalCode: profile.postalCode,
    countryCode: profile.countryCode as CountryCode,
    latitude: profile.latitude,
    longitude: profile.longitude,
    currency: profile.currency,
    createdAt: profile.createdAt.toISOString(),
    updatedAt: profile.updatedAt.toISOString(),
  };
}

function toPublicProfile(profile: BarberProfile): PublicBarberProfile {
  return {
    id: profile.id,
    displayName: profile.displayName,
    description: profile.description,
    address: profile.address,
    city: profile.city,
    postalCode: profile.postalCode,
    countryCode: profile.countryCode as CountryCode,
    latitude: profile.latitude,
    longitude: profile.longitude,
    currency: profile.currency,
    createdAt: profile.createdAt.toISOString(),
  };
}

function toOwnService(service: BarberService): OwnBarberService {
  return {
    id: service.id,
    name: service.name,
    description: service.description,
    durationMinutes: service.durationMinutes,
    priceMinor: service.priceMinor,
    isActive: service.isActive,
    createdAt: service.createdAt.toISOString(),
    updatedAt: service.updatedAt.toISOString(),
  };
}

function toPublicService(service: BarberService): PublicBarberService {
  return {
    id: service.id,
    name: service.name,
    description: service.description,
    durationMinutes: service.durationMinutes,
    priceMinor: service.priceMinor,
  };
}

async function getOwnProfileRow(userId: string): Promise<BarberProfile> {
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
  return profile;
}

export async function getOwnProfile(userId: string): Promise<OwnBarberProfile> {
  return toOwnProfile(await getOwnProfileRow(userId));
}

// Upsert atomique fondé sur la contrainte unique `userId`. Deux créations
// simultanées ne produisent ni deux profils ni une erreur 500 : le perdant
// passe par la branche `DO UPDATE`. La devise, l'identifiant et `createdAt`
// sont exclus de l'update ; `setWhere` rejette toute tentative de changement
// de devise (le RETURNING est alors vide) avec un 409 dédié.
export async function upsertProfile(
  userId: string,
  input: ProfileInput,
): Promise<OwnBarberProfile> {
  const now = new Date();

  const [profile] = await db
    .insert(barberProfiles)
    .values({
      id: randomUUID(),
      userId,
      displayName: input.displayName,
      description: input.description,
      address: input.address,
      city: input.city,
      postalCode: input.postalCode,
      countryCode: input.countryCode,
      latitude: input.latitude,
      longitude: input.longitude,
      currency: input.currency,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: barberProfiles.userId,
      set: {
        displayName: input.displayName,
        description: input.description,
        address: input.address,
        city: input.city,
        postalCode: input.postalCode,
        countryCode: input.countryCode,
        latitude: input.latitude,
        longitude: input.longitude,
        updatedAt: now,
        // `currency`, `id` et `createdAt` sont volontairement exclus.
      },
      setWhere: sql`barber_profiles.currency = excluded.currency`,
    })
    .returning();

  if (!profile) {
    throw new AppError(
      409,
      "CURRENCY_CHANGE_FORBIDDEN",
      "La devise d'un profil existant ne peut pas être modifiée.",
    );
  }

  return toOwnProfile(profile);
}

export async function listOwnServices(
  userId: string,
): Promise<OwnBarberService[]> {
  const profile = await getOwnProfileRow(userId);
  const services = await db
    .select()
    .from(barberServices)
    .where(eq(barberServices.barberProfileId, profile.id))
    .orderBy(asc(barberServices.createdAt));
  return services.map(toOwnService);
}

export async function createService(
  userId: string,
  input: ServiceCreateInput,
): Promise<OwnBarberService> {
  const profile = await getOwnProfileRow(userId);
  const [service] = await db
    .insert(barberServices)
    .values({
      id: randomUUID(),
      barberProfileId: profile.id,
      name: input.name,
      description: input.description,
      durationMinutes: input.durationMinutes,
      priceMinor: input.priceMinor,
      isActive: true,
    })
    .returning();
  return toOwnService(service);
}

export async function updateService(
  userId: string,
  serviceId: string,
  input: ServiceUpdateInput,
): Promise<OwnBarberService> {
  const profile = await getOwnProfileRow(userId);

  const set: {
    name?: string;
    description?: string | null;
    durationMinutes?: number;
    priceMinor?: number;
    isActive?: boolean;
    updatedAt: Date;
  } = { updatedAt: new Date() };

  if (input.name !== undefined) set.name = input.name;
  if (input.description !== undefined) set.description = input.description;
  if (input.durationMinutes !== undefined) {
    set.durationMinutes = input.durationMinutes;
  }
  if (input.priceMinor !== undefined) set.priceMinor = input.priceMinor;
  if (input.isActive !== undefined) set.isActive = input.isActive;

  // Filtrage SQL direct sur `serviceId` ET `barberProfileId` : anti-IDOR.
  const [service] = await db
    .update(barberServices)
    .set(set)
    .where(
      and(
        eq(barberServices.id, serviceId),
        eq(barberServices.barberProfileId, profile.id),
      ),
    )
    .returning();

  if (!service) {
    throw new AppError(404, "SERVICE_NOT_FOUND", "Service introuvable.");
  }

  return toOwnService(service);
}

export async function getPublicProfile(
  barberId: string,
): Promise<PublicBarberProfileWithServices> {
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

  // Les profils des comptes suspendus ou ayant perdu le rôle BARBER ne sont pas exposés.
  if (!owner || owner.status !== "ACTIVE" || owner.role !== "BARBER") {
    throw new AppError(404, "BARBER_PROFILE_NOT_FOUND", "Profil introuvable.");
  }

  const services = await db
    .select()
    .from(barberServices)
    .where(
      and(
        eq(barberServices.barberProfileId, barberId),
        eq(barberServices.isActive, true),
      ),
    )
    .orderBy(asc(barberServices.createdAt));

  return {
    profile: toPublicProfile(profile),
    services: services.map(toPublicService),
  };
}
