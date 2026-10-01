import { randomUUID } from "node:crypto";
import { and, asc, eq, gte, inArray, lte, sql, type SQL } from "drizzle-orm";
import { db } from "../../db/client.js";
import {
  barberProfiles,
  barberProfilePlaces,
  barberServiceAudiences,
  barberServices,
  barberServiceTechniques,
  barberTimeOff,
  barberWorkingHours,
  users,
  type BarberProfile,
  type BarberService,
  type BarberTimeOff,
  type BarberWorkingHours,
} from "@findbarber/shared/schema";
import type { CountryCode } from "@findbarber/shared/countries";
import { LIMITS } from "@findbarber/shared/constants";
import type {
  Audience,
  ServicePlace,
  Technique,
  Weekday,
} from "@findbarber/shared/constants";
import type {
  BarbersSearchResponse,
  OwnBarberProfile,
  OwnBarberService,
  PublicBarberProfile,
  PublicBarberProfileWithServices,
  PublicBarberSearchItem,
  PublicBarberService,
  TimeOff,
  WorkingHoursInterval,
} from "@findbarber/shared/types";
import type {
  ProfileInput,
  ServiceCreateInput,
  ServiceUpdateInput,
  BarberSearchQuery,
  TimeOffCreateInput,
  WorkingHoursInput,
} from "@findbarber/shared/validation";
import { AppError, isUniqueViolation } from "../../lib/errors.js";
import { escapeLikePattern } from "../../lib/like.js";
import { approximateCoordinates } from "../../lib/location.js";

function toOwnProfile(
  profile: BarberProfile,
  places: ServicePlace[],
): OwnBarberProfile {
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
    timezone: profile.timezone,
    travelRadiusKm: profile.travelRadiusKm,
    places,
    createdAt: profile.createdAt.toISOString(),
    updatedAt: profile.updatedAt.toISOString(),
  };
}

function toPublicProfile(
  profile: BarberProfile,
  places: ServicePlace[],
): PublicBarberProfile {
  // Coordonnées publiques approximatives : jamais le point privé exact.
  const { latitude, longitude } = approximateCoordinates(
    profile.latitude,
    profile.longitude,
  );
  return {
    id: profile.id,
    displayName: profile.displayName,
    description: profile.description,
    city: profile.city,
    postalCode: profile.postalCode,
    countryCode: profile.countryCode as CountryCode,
    latitude,
    longitude,
    currency: profile.currency,
    places,
    createdAt: profile.createdAt.toISOString(),
  };
}

function toOwnService(
  service: BarberService,
  audiences: Audience[],
  techniques: Technique[],
): OwnBarberService {
  return {
    id: service.id,
    name: service.name,
    description: service.description,
    durationMinutes: service.durationMinutes,
    priceMinor: service.priceMinor,
    audiences,
    techniques,
    isActive: service.isActive,
    createdAt: service.createdAt.toISOString(),
    updatedAt: service.updatedAt.toISOString(),
  };
}

function toPublicService(
  service: BarberService,
  audiences: Audience[],
  techniques: Technique[],
): PublicBarberService {
  return {
    id: service.id,
    name: service.name,
    description: service.description,
    durationMinutes: service.durationMinutes,
    priceMinor: service.priceMinor,
    audiences,
    techniques,
  };
}

async function loadAudiences(serviceIds: string[]): Promise<Map<string, Audience[]>> {
  const map = new Map<string, Audience[]>();
  if (serviceIds.length === 0) return map;
  const rows = await db
    .select()
    .from(barberServiceAudiences)
    .where(inArray(barberServiceAudiences.serviceId, serviceIds))
    .orderBy(asc(barberServiceAudiences.audience));
  for (const row of rows) {
    const list = map.get(row.serviceId) ?? [];
    list.push(row.audience);
    map.set(row.serviceId, list);
  }
  return map;
}

async function loadTechniques(serviceIds: string[]): Promise<Map<string, Technique[]>> {
  const map = new Map<string, Technique[]>();
  if (serviceIds.length === 0) return map;
  const rows = await db
    .select()
    .from(barberServiceTechniques)
    .where(inArray(barberServiceTechniques.serviceId, serviceIds))
    .orderBy(asc(barberServiceTechniques.technique));
  for (const row of rows) {
    const list = map.get(row.serviceId) ?? [];
    list.push(row.technique);
    map.set(row.serviceId, list);
  }
  return map;
}

async function loadPlaces(
  profileIds: string[],
): Promise<Map<string, ServicePlace[]>> {
  const map = new Map<string, ServicePlace[]>();
  if (profileIds.length === 0) return map;
  const rows = await db
    .select()
    .from(barberProfilePlaces)
    .where(inArray(barberProfilePlaces.barberProfileId, profileIds))
    .orderBy(asc(barberProfilePlaces.place));
  for (const row of rows) {
    const list = map.get(row.barberProfileId) ?? [];
    list.push(row.place);
    map.set(row.barberProfileId, list);
  }
  return map;
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
  const profile = await getOwnProfileRow(userId);
  const places = (await loadPlaces([profile.id])).get(profile.id) ?? [];
  return toOwnProfile(profile, places);
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

  return db.transaction(async (tx) => {
    const [profile] = await tx
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
        timezone: input.timezone ?? null,
        travelRadiusKm: input.travelRadiusKm,
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
          travelRadiusKm: input.travelRadiusKm,
          updatedAt: now,
          // `timezone` absent → la valeur existante est conservée (référence à la
          // ligne cible, valide dans SET d'un ON CONFLICT DO UPDATE). `null`
          // explicite efface. `currency`, `id` et `createdAt` restent exclus.
          timezone:
            input.timezone === undefined
              ? sql`${barberProfiles.timezone}`
              : input.timezone,
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

    // Remplacement complet des lieux, dans la même transaction que le profil.
    await tx
      .delete(barberProfilePlaces)
      .where(eq(barberProfilePlaces.barberProfileId, profile.id));
    await tx.insert(barberProfilePlaces).values(
      input.places.map((place) => ({
        barberProfileId: profile.id,
        place,
      })),
    );

    return toOwnProfile(profile, input.places);
  });
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
  const ids = services.map((service) => service.id);
  const [audiences, techniques] = await Promise.all([
    loadAudiences(ids),
    loadTechniques(ids),
  ]);
  return services.map((service) =>
    toOwnService(
      service,
      audiences.get(service.id) ?? [],
      techniques.get(service.id) ?? [],
    ),
  );
}

export async function createService(
  userId: string,
  input: ServiceCreateInput,
): Promise<OwnBarberService> {
  const profile = await getOwnProfileRow(userId);

  const service = await db.transaction(async (tx) => {
    const [created] = await tx
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

    if (input.audiences.length > 0) {
      await tx
        .insert(barberServiceAudiences)
        .values(input.audiences.map((audience) => ({ serviceId: created.id, audience })));
    }
    if (input.techniques.length > 0) {
      await tx
        .insert(barberServiceTechniques)
        .values(input.techniques.map((technique) => ({ serviceId: created.id, technique })));
    }

    return created;
  });

  return toOwnService(service, input.audiences, input.techniques);
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

  const audiencesProvided = input.audiences;
  const techniquesProvided = input.techniques;

  const service = await db.transaction(async (tx) => {
    // Filtrage SQL direct sur `serviceId` ET `barberProfileId` : anti-IDOR.
    const [updated] = await tx
      .update(barberServices)
      .set(set)
      .where(
        and(
          eq(barberServices.id, serviceId),
          eq(barberServices.barberProfileId, profile.id),
        ),
      )
      .returning();

    if (!updated) {
      throw new AppError(404, "SERVICE_NOT_FOUND", "Service introuvable.");
    }

    // PATCH : absent → aucun changement ; [] → suppression ; tableau → remplacement.
    if (audiencesProvided !== undefined) {
      await tx
        .delete(barberServiceAudiences)
        .where(eq(barberServiceAudiences.serviceId, serviceId));
      if (audiencesProvided.length > 0) {
        await tx
          .insert(barberServiceAudiences)
          .values(audiencesProvided.map((audience) => ({ serviceId, audience })));
      }
    }
    if (techniquesProvided !== undefined) {
      await tx
        .delete(barberServiceTechniques)
        .where(eq(barberServiceTechniques.serviceId, serviceId));
      if (techniquesProvided.length > 0) {
        await tx
          .insert(barberServiceTechniques)
          .values(techniquesProvided.map((technique) => ({ serviceId, technique })));
      }
    }

    return updated;
  });

  const [audiences, techniques] = await Promise.all([
    loadAudiences([service.id]),
    loadTechniques([service.id]),
  ]);
  return toOwnService(
    service,
    audiences.get(service.id) ?? [],
    techniques.get(service.id) ?? [],
  );
}

// --- Horaires hebdomadaires ---

function toWorkingHoursInterval(row: BarberWorkingHours): WorkingHoursInterval {
  return {
    id: row.id,
    weekday: row.weekday as Weekday,
    startMinute: row.startMinute,
    endMinute: row.endMinute,
  };
}

export async function getWorkingHours(
  userId: string,
): Promise<WorkingHoursInterval[]> {
  const profile = await getOwnProfileRow(userId);

  const rows = await db
    .select()
    .from(barberWorkingHours)
    .where(eq(barberWorkingHours.barberProfileId, profile.id))
    .orderBy(asc(barberWorkingHours.weekday), asc(barberWorkingHours.startMinute));

  return rows.map(toWorkingHoursInterval);
}

// Remplacement complet du planning, atomique et sérialisé :
// le profil propriétaire est résolu ET verrouillé (SELECT … FOR UPDATE) dans
// la transaction avant le DELETE + INSERT. Deux PUT simultanés du même
// barbier s'exécutent l'un après l'autre, même lorsque le planning est vide
// (aucune ligne d'horaires à verrouiller : l'ancre est la ligne du profil).
export async function replaceWorkingHours(
  userId: string,
  input: WorkingHoursInput,
): Promise<WorkingHoursInterval[]> {
  return db.transaction(async (tx) => {
    const [profile] = await tx
      .select({ id: barberProfiles.id })
      .from(barberProfiles)
      .where(eq(barberProfiles.userId, userId))
      .limit(1)
      .for("update");

    if (!profile) {
      throw new AppError(
        404,
        "BARBER_PROFILE_NOT_FOUND",
        "Aucun profil professionnel. Créez d'abord votre profil.",
      );
    }

    await tx
      .delete(barberWorkingHours)
      .where(eq(barberWorkingHours.barberProfileId, profile.id));

    if (input.intervals.length > 0) {
      const now = new Date();
      await tx.insert(barberWorkingHours).values(
        input.intervals.map((interval) => ({
          id: randomUUID(),
          barberProfileId: profile.id,
          weekday: interval.weekday,
          startMinute: interval.startMinute,
          endMinute: interval.endMinute,
          updatedAt: now,
        })),
      );
    }

    const rows = await tx
      .select()
      .from(barberWorkingHours)
      .where(eq(barberWorkingHours.barberProfileId, profile.id))
      .orderBy(
        asc(barberWorkingHours.weekday),
        asc(barberWorkingHours.startMinute),
      );

    return rows.map(toWorkingHoursInterval);
  });
}

// --- Indisponibilités / fermetures exceptionnelles (lot 7, issue #22) ---

function toTimeOff(row: BarberTimeOff): TimeOff {
  return {
    id: row.id,
    startDate: row.startDate,
    endDate: row.endDate,
    reason: row.reason,
  };
}

export async function listTimeOff(userId: string): Promise<TimeOff[]> {
  const profile = await getOwnProfileRow(userId);

  const rows = await db
    .select()
    .from(barberTimeOff)
    .where(eq(barberTimeOff.barberProfileId, profile.id))
    .orderBy(
      asc(barberTimeOff.startDate),
      asc(barberTimeOff.endDate),
      asc(barberTimeOff.id),
    );

  return rows.map(toTimeOff);
}

// Création atomique et sérialisée : le profil propriétaire est résolu ET
// verrouillé (SELECT … FOR UPDATE) dans la transaction AVANT le plafond puis le
// contrôle de chevauchement, afin que deux créations simultanées du même
// professionnel ne puissent pas dépasser le plafond ni insérer deux périodes
// chevauchantes. L'unicité exacte en base reste un filet de sécurité.
export async function createTimeOff(
  userId: string,
  input: TimeOffCreateInput,
): Promise<TimeOff> {
  const { startDate, endDate, reason } = input;

  return db.transaction(async (tx) => {
    const [profile] = await tx
      .select({ id: barberProfiles.id })
      .from(barberProfiles)
      .where(eq(barberProfiles.userId, userId))
      .limit(1)
      .for("update");

    if (!profile) {
      throw new AppError(
        404,
        "BARBER_PROFILE_NOT_FOUND",
        "Aucun profil professionnel. Créez d'abord votre profil.",
      );
    }

    const [countRow] = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(barberTimeOff)
      .where(eq(barberTimeOff.barberProfileId, profile.id));

    if (Number(countRow?.count ?? 0) >= LIMITS.timeOffMaxPerBarber) {
      throw new AppError(
        409,
        "TIME_OFF_LIMIT_REACHED",
        `Vous ne pouvez pas enregistrer plus de ${LIMITS.timeOffMaxPerBarber} indisponibilités.`,
      );
    }

    // Chevauchement inclusif : `existing.start <= new.end` ET
    // `new.start <= existing.end`. Des périodes adjacentes sans jour commun
    // (par ex. fin le 10, début le 11) ne se chevauchent pas.
    const [overlap] = await tx
      .select({ id: barberTimeOff.id })
      .from(barberTimeOff)
      .where(
        and(
          eq(barberTimeOff.barberProfileId, profile.id),
          lte(barberTimeOff.startDate, endDate),
          gte(barberTimeOff.endDate, startDate),
        ),
      )
      .limit(1);

    if (overlap) {
      throw new AppError(
        409,
        "TIME_OFF_OVERLAP",
        "Cette période chevauche une indisponibilité déjà enregistrée.",
      );
    }

    const now = new Date();
    try {
      const [created] = await tx
        .insert(barberTimeOff)
        .values({
          id: randomUUID(),
          barberProfileId: profile.id,
          startDate,
          endDate,
          reason,
          updatedAt: now,
        })
        .returning();
      return toTimeOff(created);
    } catch (err) {
      // Une violation d'unicité ici ne doit jamais devenir EMAIL_TAKEN :
      // elle traduit le doublon exact d'une période déjà enregistrée.
      if (isUniqueViolation(err)) {
        throw new AppError(
          409,
          "TIME_OFF_OVERLAP",
          "Cette période chevauche une indisponibilité déjà enregistrée.",
        );
      }
      throw err;
    }
  });
}

export async function deleteTimeOff(
  userId: string,
  timeOffId: string,
): Promise<void> {
  const profile = await getOwnProfileRow(userId);

  // Filtrage par id ET profil propriétaire : anti-IDOR. Un identifiant
  // inexistant ou appartenant à un autre professionnel renvoie 404.
  const deleted = await db
    .delete(barberTimeOff)
    .where(
      and(
        eq(barberTimeOff.id, timeOffId),
        eq(barberTimeOff.barberProfileId, profile.id),
      ),
    )
    .returning({ id: barberTimeOff.id });

  if (deleted.length === 0) {
    throw new AppError(
      404,
      "TIME_OFF_NOT_FOUND",
      "Indisponibilité introuvable.",
    );
  }
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

  const ids = services.map((service) => service.id);
  const [audiences, techniques] = await Promise.all([
    loadAudiences(ids),
    loadTechniques(ids),
  ]);
  const places = (await loadPlaces([barberId])).get(barberId) ?? [];

  return {
    profile: toPublicProfile(profile, places),
    services: services.map((service) =>
      toPublicService(
        service,
        audiences.get(service.id) ?? [],
        techniques.get(service.id) ?? [],
      ),
    ),
  };
}

function buildSearchWhere(input: BarberSearchQuery): SQL {
  const conditions: SQL[] = [
    eq(users.status, "ACTIVE"),
    eq(users.role, "BARBER"),
  ];

  if (input.q) {
    conditions.push(
      sql`${barberProfiles.displayName} ILIKE ${"%" + escapeLikePattern(input.q) + "%"} ESCAPE '\\'`,
    );
  }
  if (input.city) {
    conditions.push(
      sql`${barberProfiles.city} ILIKE ${"%" + escapeLikePattern(input.city) + "%"} ESCAPE '\\'`,
    );
  }
  if (input.countryCode) {
    conditions.push(eq(barberProfiles.countryCode, input.countryCode));
  }

  // Filtre par lieu de prestation : les profils sans lieu déclaré ne
  // correspondent à aucun filtre (mais restent renvoyés sans filtre).
  if (input.place) {
    conditions.push(
      sql`EXISTS (SELECT 1 FROM ${barberProfilePlaces} bpp WHERE bpp.barber_profile_id = ${barberProfiles.id} AND bpp.place = ${input.place})`,
    );
  }

  // Public et technique doivent correspondre au MÊME service actif (un seul
  // EXISTS corrélé) pour éviter toute fausse correspondance entre deux services.
  if (input.audience || input.technique) {
    conditions.push(sql`EXISTS (
      SELECT 1 FROM ${barberServices} bs
      WHERE bs.barber_profile_id = ${barberProfiles.id}
        AND bs.is_active = true
        ${
          input.audience
            ? sql`AND EXISTS (SELECT 1 FROM ${barberServiceAudiences} bsa WHERE bsa.service_id = bs.id AND bsa.audience = ${input.audience})`
            : sql``
        }
        ${
          input.technique
            ? sql`AND EXISTS (SELECT 1 FROM ${barberServiceTechniques} bst WHERE bst.service_id = bs.id AND bst.technique = ${input.technique})`
            : sql``
        }
    )`);
  }

  // `conditions` est toujours non vide (2 conditions de base) : assertion sûre.
  return and(...conditions)!;
}

export async function searchBarbers(
  input: BarberSearchQuery,
): Promise<BarbersSearchResponse> {
  const where = buildSearchWhere(input);

  const [totalRow] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(barberProfiles)
    .innerJoin(users, eq(barberProfiles.userId, users.id))
    .where(where);
  const total = Number(totalRow?.total ?? 0);

  const rows = await db
    .select({
      id: barberProfiles.id,
      displayName: barberProfiles.displayName,
      city: barberProfiles.city,
      countryCode: barberProfiles.countryCode,
      latitude: barberProfiles.latitude,
      longitude: barberProfiles.longitude,
      activeServiceCount: sql<number>`(
        SELECT count(*)::int FROM ${barberServices} bs_count
        WHERE bs_count.barber_profile_id = ${barberProfiles.id}
          AND bs_count.is_active = true
      )`,
      audiences: sql<string[]>`COALESCE((
        SELECT array_agg(DISTINCT bsa.audience ORDER BY bsa.audience)::text[]
        FROM ${barberServiceAudiences} bsa
        JOIN ${barberServices} bs ON bs.id = bsa.service_id
        WHERE bs.barber_profile_id = ${barberProfiles.id} AND bs.is_active = true
      ), ARRAY[]::text[])`,
      techniques: sql<string[]>`COALESCE((
        SELECT array_agg(DISTINCT bst.technique ORDER BY bst.technique)::text[]
        FROM ${barberServiceTechniques} bst
        JOIN ${barberServices} bs ON bs.id = bst.service_id
        WHERE bs.barber_profile_id = ${barberProfiles.id} AND bs.is_active = true
      ), ARRAY[]::text[])`,
      places: sql<string[]>`COALESCE((
        SELECT array_agg(bpp.place ORDER BY bpp.place)::text[]
        FROM ${barberProfilePlaces} bpp
        WHERE bpp.barber_profile_id = ${barberProfiles.id}
      ), ARRAY[]::text[])`,
    })
    .from(barberProfiles)
    .innerJoin(users, eq(barberProfiles.userId, users.id))
    .where(where)
    .orderBy(sql`lower(${barberProfiles.displayName}) asc`, asc(barberProfiles.id))
    .limit(input.pageSize)
    .offset((input.page - 1) * input.pageSize);

  const barbers: PublicBarberSearchItem[] = rows.map((row) => {
    const { latitude, longitude } = approximateCoordinates(
      row.latitude,
      row.longitude,
    );
    return {
      id: row.id,
      displayName: row.displayName,
      city: row.city,
      countryCode: row.countryCode as CountryCode,
      latitude,
      longitude,
      activeServiceCount: row.activeServiceCount,
      audiences: row.audiences as Audience[],
      techniques: row.techniques as Technique[],
      places: row.places as ServicePlace[],
    };
  });

  const totalPages = total === 0 ? 0 : Math.ceil(total / input.pageSize);

  return {
    barbers,
    pagination: {
      page: input.page,
      pageSize: input.pageSize,
      total,
      totalPages,
    },
  };
}
