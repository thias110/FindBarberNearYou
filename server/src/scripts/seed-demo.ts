// --- Démo / seed local (aucun impact sur l'application) ---
// Remplit la base (PGlite locale ou PostgreSQL) avec un jeu de données
// cohérent et centré sur Genève pour la démo produit :
//   - 1 ADMIN, 2 BARBERS (Plainpalais + Eaux-Vives), 2 CLIENTS
//   - réservations passées (CONFIRMED à terminer, COMPLETED avec avis)
//   - avis visible pour la modération admin (masquage)
//
//   # local (PGlite)
//   cd server && npx tsx src/scripts/seed-demo.ts
//
//   # PostgreSQL (hors Docker)
//   cd server && DB_DRIVER=postgres DATABASE_URL=postgresql://... npx tsx src/scripts/seed-demo.ts
//
//   # Docker (voir README)
//   docker compose run --rm app node server/dist/scripts/seed-demo.js
//
// Refusé si NODE_ENV=production (il réinitialise les mots de passe des
// comptes de démo), sauf ALLOW_DEMO_SEED=true explicite.
//
// Comptes de démo (mot de passe unique : Demo1234!)
//   ADMIN   admin@demo.ch
//   BARBER  karim.plainpalais@demo.ch   (salon, Plainpalais)
//   BARBER  marco.eauxvives@demo.ch     (domicile, Eaux-Vives)
//   CLIENT  client@demo.ch              (historique vide)
//   CLIENT  client2@demo.ch             (réservation terminée + avis)

import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import sharp from "sharp";
import { and, eq, inArray, or } from "drizzle-orm";
import { closeDb, db } from "../db/client.js";
import { migrateDb } from "../db/migrate.js";
import { remove, save } from "../lib/storage.js";
import {
  barberPhotos,
  barberProfiles,
  barberProfilePlaces,
  barberServices,
  barberServiceAudiences,
  barberServiceTechniques,
  barberTimeOff,
  barberWorkingHours,
  bookings,
  reviews,
  users,
} from "@findbarber/shared/schema";
import {
  type Audience,
  type Currency,
  type ServicePlace,
  type Technique,
  type Weekday,
} from "@findbarber/shared/constants";
import { utcToZonedParts, zonedTimeToUtc } from "@findbarber/shared/timezones";

const DEMO_PASSWORD = "Demo1234!";

type WorkingInterval = { weekday: Weekday; startMinute: number; endMinute: number };
type ServiceSeed = {
  name: string;
  description: string;
  durationMinutes: number;
  priceMinor: number;
  audiences: Audience[];
  techniques: Technique[];
};

interface BarberSeed {
  email: string;
  name: string;
  profile: {
    displayName: string;
    description: string;
    address: string | null;
    city: string;
    postalCode: string | null;
    countryCode: string;
    latitude: number;
    longitude: number;
    currency: Currency;
    timezone: string;
    travelRadiusKm: number | null;
  };
  places: ServicePlace[];
  workingHours: WorkingInterval[];
  services: ServiceSeed[];
  /** Nombre de photos de galerie à générer (placeholders WebP). */
  galleryCount: number;
  /** Profil en attente d'approbation admin (issue #40) : invisible du public. */
  pendingApproval?: boolean;
}

/** Lun-ven 09:00-12:00 / 14:00-18:00, sam 09:00-17:00. */
function standardWeek(): WorkingInterval[] {
  const intervals: WorkingInterval[] = [];
  for (const weekday of [1, 2, 3, 4, 5] as Weekday[]) {
    intervals.push({ weekday, startMinute: 540, endMinute: 720 }); // 09:00-12:00
    intervals.push({ weekday, startMinute: 840, endMinute: 1080 }); // 14:00-18:00
  }
  intervals.push({ weekday: 6, startMinute: 540, endMinute: 1020 }); // sam. 09:00-17:00
  return intervals;
}

/** Lun-sam 08:00-20:00 : garantit plusieurs créneaux libres pour la démo. */
function extendedWeek(): WorkingInterval[] {
  const intervals: WorkingInterval[] = [];
  for (const weekday of [1, 2, 3, 4, 5, 6] as Weekday[]) {
    intervals.push({ weekday, startMinute: 480, endMinute: 1200 }); // 08:00-20:00
  }
  return intervals;
}

const BARBERS: BarberSeed[] = [
  {
    email: "karim.plainpalais@demo.ch",
    name: "Karim Alaoui",
    profile: {
      displayName: "Karim — Barber Plainpalais",
      description:
        "Barbier indépendant à Plainpalais. Spécialiste du dégradé et de la barbe, à l'écoute du style que tu recherches.",
      address: "12 boulevard du Pont-d'Arve",
      city: "Genève",
      postalCode: "1205",
      countryCode: "CH",
      latitude: 46.1987,
      longitude: 6.1373,
      currency: "CHF",
      timezone: "Europe/Zurich",
      travelRadiusKm: null,
    },
    places: ["SALON", "AT_PROVIDER"],
    workingHours: standardWeek(),
    galleryCount: 2,
    services: [
      {
        name: "Dégradé",
        description: "Dégradé fondu aux contours, finitions au rasoir.",
        durationMinutes: 45,
        priceMinor: 4800,
        audiences: ["HOMME"],
        techniques: ["DEGRADE"],
      },
      {
        name: "Coupe + barbe",
        description: "Formule complète coupe et barbe, serviette chaude incluse.",
        durationMinutes: 60,
        priceMinor: 6000,
        audiences: ["HOMME"],
        techniques: ["COUPE", "BARBE"],
      },
    ],
  },
  {
    email: "marco.eauxvives@demo.ch",
    name: "Marco Ricci",
    profile: {
      displayName: "Marco — Atelier Eaux-Vives",
      description:
        "Barbier mobile aux Eaux-Vives. Je me déplace à domicile dans Genève (rayon 5 km), matériel fourni.",
      address: "5 rue de la Terrassière",
      city: "Genève",
      postalCode: "1207",
      countryCode: "CH",
      latitude: 46.2027,
      longitude: 6.1602,
      currency: "CHF",
      timezone: "Europe/Zurich",
      travelRadiusKm: 5,
    },
    places: ["SALON", "AT_CLIENT"],
    workingHours: extendedWeek(),
    galleryCount: 0,
    services: [
      {
        name: "Coupe à domicile",
        description: "Coupe homme à domicile, matériel fourni.",
        durationMinutes: 45,
        priceMinor: 4500,
        audiences: ["HOMME"],
        techniques: ["COUPE"],
      },
      {
        name: "Coupe + barbe à domicile",
        description: "Coupe et barbe à domicile.",
        durationMinutes: 60,
        priceMinor: 5500,
        audiences: ["HOMME"],
        techniques: ["COUPE", "BARBE"],
      },
    ],
  },
  {
    // Nouveau barber pas encore approuvé (issue #40) : sert à démontrer et
    // tester le parcours d'approbation par l'admin.
    email: "nouveau.barber@demo.ch",
    name: "Lucas Nouveau",
    pendingApproval: true,
    profile: {
      displayName: "Lucas — Nouveau Salon",
      description: "Nouveau barber à Carouge, profil en cours de validation.",
      address: "10 rue Saint-Joseph",
      city: "Carouge",
      postalCode: "1227",
      countryCode: "CH",
      latitude: 46.1846,
      longitude: 6.1393,
      currency: "CHF",
      timezone: "Europe/Zurich",
      travelRadiusKm: null,
    },
    places: ["SALON"],
    workingHours: standardWeek(),
    galleryCount: 0,
    services: [
      {
        name: "Coupe homme",
        description: "Coupe classique.",
        durationMinutes: 30,
        priceMinor: 3500,
        audiences: ["HOMME"],
        techniques: ["COUPE"],
      },
    ],
  },
];

const ADMIN = { email: "admin@demo.ch", name: "Admin Démo" };

const CLIENTS: Array<{ email: string; name: string }> = [
  { email: "client@demo.ch", name: "Client Démo" },
  { email: "client2@demo.ch", name: "Emma Historique" },
];

async function upsertUser(
  email: string,
  role: "CLIENT" | "BARBER" | "ADMIN",
  name: string,
): Promise<{ id: string; email: string }> {
  const normalized = email.toLowerCase();
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);
  const [existing] = await db
    .select()
    .from(users)
    .where(eq(users.email, normalized))
    .limit(1);

  if (existing) {
    const [updated] = await db
      .update(users)
      .set({
        passwordHash,
        role,
        status: "ACTIVE",
        name,
        emailVerifiedAt: new Date(),
      })
      .where(eq(users.id, existing.id))
      .returning();
    return { id: updated.id, email: updated.email };
  }

  const [created] = await db
    .insert(users)
    .values({
      id: randomUUID(),
      email: normalized,
      passwordHash,
      role,
      status: "ACTIVE",
      name,
      emailVerifiedAt: new Date(),
    })
    .returning();
  return { id: created.id, email: created.email };
}

async function upsertBarber(seed: BarberSeed): Promise<{ userId: string; profileId: string }> {
  const user = await upsertUser(seed.email, "BARBER", seed.name);
  const now = new Date();

  const [existing] = await db
    .select()
    .from(barberProfiles)
    .where(eq(barberProfiles.userId, user.id))
    .limit(1);

  let profileId: string;
  if (existing) {
    profileId = existing.id;
    await db
      .update(barberProfiles)
      .set({
        displayName: seed.profile.displayName,
        description: seed.profile.description,
        address: seed.profile.address,
        city: seed.profile.city,
        postalCode: seed.profile.postalCode,
        countryCode: seed.profile.countryCode,
        latitude: seed.profile.latitude,
        longitude: seed.profile.longitude,
        currency: seed.profile.currency,
        timezone: seed.profile.timezone,
        travelRadiusKm: seed.profile.travelRadiusKm,
        approvedAt: seed.pendingApproval ? null : (existing.approvedAt ?? now),
        updatedAt: now,
      })
      .where(eq(barberProfiles.id, profileId));
  } else {
    profileId = randomUUID();
    await db.insert(barberProfiles).values({
      id: profileId,
      approvedAt: seed.pendingApproval ? null : new Date(),
      userId: user.id,
      displayName: seed.profile.displayName,
      description: seed.profile.description,
      address: seed.profile.address,
      city: seed.profile.city,
      postalCode: seed.profile.postalCode,
      countryCode: seed.profile.countryCode,
      latitude: seed.profile.latitude,
      longitude: seed.profile.longitude,
      currency: seed.profile.currency,
      timezone: seed.profile.timezone,
      travelRadiusKm: seed.profile.travelRadiusKm,
    });
  }

  // Lieux de prestation : remplacement complet (idempotent).
  await db.delete(barberProfilePlaces).where(eq(barberProfilePlaces.barberProfileId, profileId));
  if (seed.places.length > 0) {
    await db.insert(barberProfilePlaces).values(
      seed.places.map((place) => ({ barberProfileId: profileId, place })),
    );
  }

  // Horaires hebdomadaires : remplacement complet (idempotent).
  await db.delete(barberWorkingHours).where(eq(barberWorkingHours.barberProfileId, profileId));
  if (seed.workingHours.length > 0) {
    await db.insert(barberWorkingHours).values(
      seed.workingHours.map((interval) => ({
        id: randomUUID(),
        barberProfileId: profileId,
        weekday: interval.weekday,
        startMinute: interval.startMinute,
        endMinute: interval.endMinute,
        updatedAt: now,
      })),
    );
  }

  for (const service of seed.services) {
    await ensureService(profileId, service);
  }

  if (seed.galleryCount > 0) {
    await seedGalleryPhotos(profileId, seed.galleryCount);
  }

  return { userId: user.id, profileId };
}

async function ensureService(profileId: string, seed: ServiceSeed): Promise<void> {
  const [existing] = await db
    .select()
    .from(barberServices)
    .where(and(eq(barberServices.barberProfileId, profileId), eq(barberServices.name, seed.name)))
    .limit(1);
  if (existing) return;

  const [created] = await db
    .insert(barberServices)
    .values({
      id: randomUUID(),
      barberProfileId: profileId,
      name: seed.name,
      description: seed.description,
      durationMinutes: seed.durationMinutes,
      priceMinor: seed.priceMinor,
      isActive: true,
    })
    .returning();

  if (seed.audiences.length > 0) {
    await db.insert(barberServiceAudiences).values(
      seed.audiences.map((audience) => ({ serviceId: created.id, audience })),
    );
  }
  if (seed.techniques.length > 0) {
    await db.insert(barberServiceTechniques).values(
      seed.techniques.map((technique) => ({ serviceId: created.id, technique })),
    );
  }
}

/** Génère des photos de galerie WebP (placeholders) — idempotent par profil. */
async function seedGalleryPhotos(profileId: string, count: number): Promise<void> {
  const existing = await db
    .select()
    .from(barberPhotos)
    .where(eq(barberPhotos.barberProfileId, profileId));
  for (const photo of existing) {
    await remove(photo.imagePath);
  }
  await db.delete(barberPhotos).where(eq(barberPhotos.barberProfileId, profileId));

  const palette = [
    { r: 84, g: 60, b: 42 }, // cuivre foncé
    { r: 140, g: 96, b: 66 }, // cuivre clair
  ];
  const captions = ["Dégradé fondu", "Coupe + barbe"];

  for (let i = 0; i < count; i += 1) {
    const buffer = await sharp({
      create: {
        width: 1200,
        height: 900,
        channels: 3,
        background: palette[i % palette.length],
      },
    })
      .webp({ quality: 82 })
      .toBuffer();
    const imagePath = await save(buffer, "gallery");
    await db.insert(barberPhotos).values({
      id: randomUUID(),
      barberProfileId: profileId,
      imagePath,
      caption: captions[i % captions.length],
    });
  }
}

/** Date civile (`YYYY-MM-DD`) `daysFromNow` jours dans le futur/passé, dans un fuseau. */
function civilDateInTimezone(daysFromNow: number, timezone: string): string {
  const date = new Date(Date.now() + daysFromNow * 86_400_000);
  return utcToZonedParts(date, timezone).date;
}

/** Instant UTC d'une heure murale (`minuteOfDay`) un jour civil donné, dans un fuseau. */
function zonedDateTimeAt(daysFromNow: number, minuteOfDay: number, timezone: string): Date {
  const date = civilDateInTimezone(daysFromNow, timezone);
  const utc = zonedTimeToUtc(date, minuteOfDay, timezone);
  if (!utc) {
    throw new Error(`Heure murale invalide : ${date} ${minuteOfDay} ${timezone}`);
  }
  return utc;
}

async function getService(profileId: string, name: string) {
  const [service] = await db
    .select()
    .from(barberServices)
    .where(
      and(
        eq(barberServices.barberProfileId, profileId),
        eq(barberServices.name, name),
      ),
    )
    .limit(1);
  return service;
}

interface BookingSeed {
  barberProfileId: string;
  clientUserId: string;
  serviceId: string;
  barberDisplayName: string;
  serviceName: string;
  serviceDescription: string | null;
  durationMinutes: number;
  priceMinor: number;
  currency: Currency;
  startAt: Date;
  endAt: Date;
  servicePlace: ServicePlace;
  status: "CONFIRMED" | "COMPLETED";
}

async function insertBooking(seed: BookingSeed) {
  return db
    .insert(bookings)
    .values({
      id: randomUUID(),
      clientUserId: seed.clientUserId,
      barberProfileId: seed.barberProfileId,
      serviceId: seed.serviceId,
      startAt: seed.startAt,
      endAt: seed.endAt,
      servicePlace: seed.servicePlace,
      status: seed.status,
      barberDisplayName: seed.barberDisplayName,
      serviceName: seed.serviceName,
      serviceDescription: seed.serviceDescription,
      durationMinutes: seed.durationMinutes,
      priceMinor: seed.priceMinor,
      currency: seed.currency,
    })
    .returning();
}

async function main(): Promise<void> {
  if (
    process.env.NODE_ENV === "production" &&
    process.env.ALLOW_DEMO_SEED !== "true"
  ) {
    throw new Error(
      "Seed de démo refusé en production (NODE_ENV=production). Définir ALLOW_DEMO_SEED=true pour forcer.",
    );
  }

  await migrateDb();
  console.log("Migrations appliquées.\n");

  // Compte ADMIN.
  const admin = await upsertUser(ADMIN.email, "ADMIN", ADMIN.name);
  console.log(`✓ Admin : ${ADMIN.name} (${admin.email})`);

  // Barbers.
  const profilesByEmail = new Map<
    string,
    { userId: string; profileId: string; timezone: string; displayName: string; currency: Currency }
  >();
  for (const barber of BARBERS) {
    const { userId, profileId } = await upsertBarber(barber);
    profilesByEmail.set(barber.email, {
      userId,
      profileId,
      timezone: barber.profile.timezone,
      displayName: barber.profile.displayName,
      currency: barber.profile.currency,
    });
    console.log(`✓ Barber : ${barber.profile.displayName} (${barber.email})`);
  }

  // Clients.
  const clientsByEmail = new Map<string, { id: string }>();
  for (const client of CLIENTS) {
    const user = await upsertUser(client.email, "CLIENT", client.name);
    clientsByEmail.set(client.email, { id: user.id });
    console.log(`✓ Client : ${client.name} (${client.email})`);
  }

  const karim = profilesByEmail.get("karim.plainpalais@demo.ch");
  const emma = clientsByEmail.get("client2@demo.ch");
  if (!karim || !emma) {
    throw new Error("Barber ou client de démonstration introuvable.");
  }

  // Réinitialise les rendez-vous de démo (idempotent) ; les avis suivent via
  // la cascade sur `bookings.id`.
  const demoBarberProfileIds = Array.from(profilesByEmail.values()).map((b) => b.profileId);
  const demoClientUserIds = Array.from(clientsByEmail.values()).map((c) => c.id);
  await db
    .delete(bookings)
    .where(
      or(
        inArray(bookings.barberProfileId, demoBarberProfileIds),
        inArray(bookings.clientUserId, demoClientUserIds),
      )!,
    );

  // Indisponibilité de démonstration pour Karim (journée dans 9 jours).
  await db.delete(barberTimeOff).where(eq(barberTimeOff.barberProfileId, karim.profileId));
  const offDate = civilDateInTimezone(9, karim.timezone);
  await db.insert(barberTimeOff).values({
    id: randomUUID(),
    barberProfileId: karim.profileId,
    startDate: offDate,
    endDate: offDate,
    reason: "Fermeture exceptionnelle (démo)",
  });
  console.log(`✓ Indisponibilité : Karim fermé le ${offDate}`);

  // Réservation CONFIRMED dont le créneau est déjà passé (hier 14:00) :
  // sert à la démo « après rendez-vous » (barber la marque terminée, puis le
  // client dépose un avis).
  const confirmedService = await getService(karim.profileId, "Coupe + barbe");
  if (!confirmedService) throw new Error("Service « Coupe + barbe » introuvable.");
  const confirmedStart = zonedDateTimeAt(-1, 840, karim.timezone); // hier 14:00
  const confirmedEnd = new Date(confirmedStart.getTime() + confirmedService.durationMinutes * 60_000);
  await insertBooking({
    barberProfileId: karim.profileId,
    clientUserId: emma.id,
    serviceId: confirmedService.id,
    barberDisplayName: karim.displayName,
    serviceName: confirmedService.name,
    serviceDescription: confirmedService.description,
    durationMinutes: confirmedService.durationMinutes,
    priceMinor: confirmedService.priceMinor,
    currency: karim.currency,
    startAt: confirmedStart,
    endAt: confirmedEnd,
    servicePlace: "SALON",
    status: "CONFIRMED",
  });
  console.log(`✓ Réservation CONFIRMED (à terminer) : Karim / Coupe + barbe (${confirmedStart.toISOString()})`);

  // Réservation COMPLETED + avis visible (modération admin : masquer).
  const completedService = await getService(karim.profileId, "Dégradé");
  if (!completedService) throw new Error("Service « Dégradé » introuvable.");
  const completedStart = zonedDateTimeAt(-10, 840, karim.timezone); // il y a 10 jours, 14:00
  const completedEnd = new Date(completedStart.getTime() + completedService.durationMinutes * 60_000);
  const [completedBooking] = await insertBooking({
    barberProfileId: karim.profileId,
    clientUserId: emma.id,
    serviceId: completedService.id,
    barberDisplayName: karim.displayName,
    serviceName: completedService.name,
    serviceDescription: completedService.description,
    durationMinutes: completedService.durationMinutes,
    priceMinor: completedService.priceMinor,
    currency: karim.currency,
    startAt: completedStart,
    endAt: completedEnd,
    servicePlace: "SALON",
    status: "COMPLETED",
  });
  await db.insert(reviews).values({
    id: randomUUID(),
    bookingId: completedBooking.id,
    rating: 5,
    comment: "Dégradé impeccable, à l'heure et à l'écoute.",
  });
  console.log(`✓ Réservation COMPLETED + avis : Karim / Dégradé (${completedStart.toISOString()})`);

  console.log("\nTerminé.");
  console.log(`Mot de passe de démo pour tous les comptes : ${DEMO_PASSWORD}`);
  console.log("ADMIN  : admin@demo.ch");
  console.log("BARBER : karim.plainpalais@demo.ch (salon, Plainpalais)");
  console.log("BARBER : marco.eauxvives@demo.ch (domicile, Eaux-Vives, rayon 5 km)");
  console.log("CLIENT : client@demo.ch (historique vide)");
  console.log("CLIENT : client2@demo.ch (réservation terminée + avis)");

  await closeDb();
}

main().catch(async (err) => {
  console.error(err);
  await closeDb();
  process.exit(1);
});
