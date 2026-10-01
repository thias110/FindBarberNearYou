import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  doublePrecision,
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import {
  AUDIENCES,
  BOOKING_STATUSES,
  LIMITS,
  ROLES,
  SERVICE_PLACES,
  SUPPORTED_CURRENCIES,
  TECHNIQUES,
  USER_STATUSES,
} from "./constants";

export const userRoleEnum = pgEnum("user_role", [...ROLES]);
export const userStatusEnum = pgEnum("user_status", [...USER_STATUSES]);
export const currencyEnum = pgEnum("currency", [...SUPPORTED_CURRENCIES]);
export const audienceEnum = pgEnum("audience", [...AUDIENCES]);
export const techniqueEnum = pgEnum("technique", [...TECHNIQUES]);
export const servicePlaceEnum = pgEnum("service_place", [...SERVICE_PLACES]);
export const bookingStatusEnum = pgEnum("booking_status", [
  ...BOOKING_STATUSES,
]);

export const users = pgTable(
  "users",
  {
    id: text("id").primaryKey(),
    email: text("email").notNull(),
    passwordHash: text("password_hash").notNull(),
    role: userRoleEnum("role").notNull().default("CLIENT"),
    status: userStatusEnum("status").notNull().default("ACTIVE"),
    name: text("name"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [uniqueIndex("users_email_unique").on(table.email)],
);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

export const barberProfiles = pgTable(
  "barber_profiles",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    displayName: text("display_name").notNull(),
    description: text("description").notNull(),
    // Adresse privée : facultative depuis le lot 8 (issue #19). Un profil
    // `AT_CLIENT` seul n'a pas besoin d'adresse ; `SALON`/`AT_PROVIDER` en
    // exigent une (règle applicative). Jamais exposée publiquement. Les valeurs
    // historiques sont conservées lors de la relaxation du NOT NULL.
    address: text("address"),
    city: text("city").notNull(),
    postalCode: text("postal_code"),
    countryCode: text("country_code").notNull(),
    latitude: doublePrecision("latitude").notNull(),
    longitude: doublePrecision("longitude").notNull(),
    currency: currencyEnum("currency").notNull().default("CHF"),
    // Rayon d'intervention mobile (km), requis si et seulement si `AT_CLIENT`
    // est sélectionné. NULL sinon. Aucune ville/liste de villes dans ce lot.
    travelRadiusKm: integer("travel_radius_km"),
    // Fuseau IANA du salon (lot 6A). Nullable, sans défaut, jamais backfillé :
    // les profils existants restent NULL (aucun fuseau inventé). La validation
    // applicative refuse offsets, abréviations et Etc/… ; le CHECK ci-dessous
    // borne la longueur en dernier ressort.
    timezone: text("timezone"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("barber_profiles_user_id_unique").on(table.userId),
    check(
      "barber_profiles_latitude_range",
      sql`${table.latitude} >= -90 AND ${table.latitude} <= 90`,
    ),
    check(
      "barber_profiles_longitude_range",
      sql`${table.longitude} >= -180 AND ${table.longitude} <= 180`,
    ),
    check(
      "barber_profiles_timezone_length",
      sql`${table.timezone} IS NULL OR char_length(${table.timezone}) <= ${sql.raw(
        String(LIMITS.profileTimezone),
      )}`,
    ),
    check(
      "barber_profiles_travel_radius_range",
      sql`${table.travelRadiusKm} IS NULL OR ${table.travelRadiusKm} BETWEEN ${sql.raw(
        String(LIMITS.travelRadiusKmMin),
      )} AND ${sql.raw(String(LIMITS.travelRadiusKmMax))}`,
    ),
  ],
);

export const barberServices = pgTable(
  "barber_services",
  {
    id: text("id").primaryKey(),
    barberProfileId: text("barber_profile_id")
      .notNull()
      .references(() => barberProfiles.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    durationMinutes: integer("duration_minutes").notNull(),
    priceMinor: integer("price_minor").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("barber_services_profile_active_idx").on(
      table.barberProfileId,
      table.isActive,
    ),
    check(
      "barber_services_duration_range",
      sql`${table.durationMinutes} BETWEEN ${sql.raw(
        String(LIMITS.serviceDurationMin),
      )} AND ${sql.raw(String(LIMITS.serviceDurationMax))}`,
    ),
    check(
      "barber_services_price_range",
      sql`${table.priceMinor} BETWEEN ${sql.raw(
        String(LIMITS.servicePriceMinorMin),
      )} AND ${sql.raw(String(LIMITS.servicePriceMinorMax))}`,
    ),
  ],
);

export const barberServiceAudiences = pgTable(
  "barber_service_audiences",
  {
    serviceId: text("service_id")
      .notNull()
      .references(() => barberServices.id, { onDelete: "cascade" }),
    audience: audienceEnum("audience").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.serviceId, table.audience] }),
    index("barber_service_audiences_audience_idx").on(table.audience),
  ],
);

export const barberServiceTechniques = pgTable(
  "barber_service_techniques",
  {
    serviceId: text("service_id")
      .notNull()
      .references(() => barberServices.id, { onDelete: "cascade" }),
    technique: techniqueEnum("technique").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.serviceId, table.technique] }),
    index("barber_service_techniques_technique_idx").on(table.technique),
  ],
);

// Lieux de prestation du profil (lot 8, issue #19) : ensemble de modes
// cumulables, remplacé en bloc lors d'un PUT du profil. Table de liaison
// calquée sur `barber_service_audiences`. Les profils historiques peuvent
// rester sans ligne (aucun mode inventé).
export const barberProfilePlaces = pgTable(
  "barber_profile_places",
  {
    barberProfileId: text("barber_profile_id")
      .notNull()
      .references(() => barberProfiles.id, { onDelete: "cascade" }),
    place: servicePlaceEnum("place").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.barberProfileId, table.place] }),
    index("barber_profile_places_place_idx").on(table.place),
  ],
);

// Horaires hebdomadaires : une ligne par plage de travail. Les heures sont des
// minutes murales locales (0..1440) sans fuseau ; 1440 = 24:00 en fin de plage
// uniquement. Les chevauchements sont refusés au niveau applicatif ; les
// bornes et l'ordre début < fin sont garantis par CHECK en dernier ressort.
export const barberWorkingHours = pgTable(
  "barber_working_hours",
  {
    id: text("id").primaryKey(),
    barberProfileId: text("barber_profile_id")
      .notNull()
      .references(() => barberProfiles.id, { onDelete: "cascade" }),
    weekday: integer("weekday").notNull(),
    startMinute: integer("start_minute").notNull(),
    endMinute: integer("end_minute").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("barber_working_hours_profile_weekday_idx").on(
      table.barberProfileId,
      table.weekday,
    ),
    uniqueIndex("barber_working_hours_profile_weekday_start_unique").on(
      table.barberProfileId,
      table.weekday,
      table.startMinute,
    ),
    check(
      "barber_working_hours_weekday_range",
      sql`${table.weekday} BETWEEN 1 AND 7`,
    ),
    check(
      "barber_working_hours_start_range",
      sql`${table.startMinute} BETWEEN ${sql.raw(
        String(LIMITS.workingHoursStartMin),
      )} AND ${sql.raw(String(LIMITS.workingHoursStartMax))}`,
    ),
    check(
      "barber_working_hours_end_range",
      sql`${table.endMinute} BETWEEN ${sql.raw(
        String(LIMITS.workingHoursEndMin),
      )} AND ${sql.raw(String(LIMITS.workingHoursEndMax))}`,
    ),
    check(
      "barber_working_hours_order",
      sql`${table.startMinute} < ${table.endMinute}`,
    ),
  ],
);

export type BarberProfile = typeof barberProfiles.$inferSelect;
export type NewBarberProfile = typeof barberProfiles.$inferInsert;
export type BarberService = typeof barberServices.$inferSelect;
export type NewBarberService = typeof barberServices.$inferInsert;
export type BarberServiceAudience = typeof barberServiceAudiences.$inferSelect;
export type BarberServiceTechnique = typeof barberServiceTechniques.$inferSelect;
export type BarberProfilePlace = typeof barberProfilePlaces.$inferSelect;
export type NewBarberProfilePlace = typeof barberProfilePlaces.$inferInsert;
export type BarberWorkingHours = typeof barberWorkingHours.$inferSelect;
export type NewBarberWorkingHours = typeof barberWorkingHours.$inferInsert;

// Indisponibilités / fermetures exceptionnelles : journées entières civiles
// (`start_date`..`end_date` incluses), sans fuseau ni conversion. L'unicité
// exacte est un filet de sécurité ; les chevauchements sont refusés côté
// applicatif. Le motif est privé (jamais exposé publiquement).
export const barberTimeOff = pgTable(
  "barber_time_off",
  {
    id: text("id").primaryKey(),
    barberProfileId: text("barber_profile_id")
      .notNull()
      .references(() => barberProfiles.id, { onDelete: "cascade" }),
    startDate: date("start_date", { mode: "string" }).notNull(),
    endDate: date("end_date", { mode: "string" }).notNull(),
    reason: text("reason"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("barber_time_off_profile_start_idx").on(
      table.barberProfileId,
      table.startDate,
    ),
    uniqueIndex("barber_time_off_profile_dates_unique").on(
      table.barberProfileId,
      table.startDate,
      table.endDate,
    ),
    check(
      "barber_time_off_order",
      sql`${table.startDate} <= ${table.endDate}`,
    ),
    check(
      "barber_time_off_range",
      sql`${table.endDate} - ${table.startDate} <= ${sql.raw(
        String(LIMITS.timeOffMaxRangeDays - 1),
      )}`,
    ),
    check(
      "barber_time_off_reason_length",
      sql`${table.reason} IS NULL OR char_length(${table.reason}) <= ${sql.raw(
        String(LIMITS.timeOffReason),
      )}`,
    ),
  ],
);

export type BarberTimeOff = typeof barberTimeOff.$inferSelect;
export type NewBarberTimeOff = typeof barberTimeOff.$inferInsert;

// Réservations (lot 9). `start_at`/`end_at` sont des instants **UTC**
// (`timestamptz`), calculés depuis les minutes murales locales du barber et son
// fuseau IANA. Prix/durée/currency et snapshots texte sont figés à la création.
// Les colonnes `client_*` (adresse) sont nullables et **inutilisées** dans ce
// lot : elles préparent le reste de #19. Le lieu réutilise l'enum existant
// `service_place`. Aucune contrainte d'exclusion : `btree_gist` n'est pas
// disponible sous PGlite (dev/tests) ; l'anti-double-réservation est assuré par
// verrou transactionnel applicatif.
export const bookings = pgTable(
  "bookings",
  {
    id: text("id").primaryKey(),
    clientUserId: text("client_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    barberProfileId: text("barber_profile_id")
      .notNull()
      .references(() => barberProfiles.id, { onDelete: "cascade" }),
    serviceId: text("service_id")
      .notNull()
      .references(() => barberServices.id, { onDelete: "restrict" }),
    startAt: timestamp("start_at", { withTimezone: true }).notNull(),
    endAt: timestamp("end_at", { withTimezone: true }).notNull(),
    servicePlace: servicePlaceEnum("service_place").notNull(),
    status: bookingStatusEnum("status").notNull().default("PENDING"),
    // Snapshots figés à la création.
    barberDisplayName: text("barber_display_name").notNull(),
    serviceName: text("service_name").notNull(),
    serviceDescription: text("service_description"),
    durationMinutes: integer("duration_minutes").notNull(),
    priceMinor: integer("price_minor").notNull(),
    currency: currencyEnum("currency").notNull(),
    // Adresse privée du client (lot 9 passe A, issue #19) : renseignées
    // uniquement pour `AT_CLIENT`, nullables partout ailleurs (compatibilité
    // historique). Jamais exposées publiquement. Les coordonnées sont celles du
    // géocodeur serveur, jamais celles envoyées par le navigateur.
    clientAddress: text("client_address"),
    clientCity: text("client_city"),
    clientPostalCode: text("client_postal_code"),
    clientCountryCode: text("client_country_code"),
    clientLatitude: doublePrecision("client_latitude"),
    clientLongitude: doublePrecision("client_longitude"),
    cancelledBy: text("cancelled_by"),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("bookings_barber_start_idx").on(
      table.barberProfileId,
      table.startAt,
    ),
    index("bookings_client_start_idx").on(table.clientUserId, table.startAt),
    index("bookings_status_idx").on(table.status),
    check("bookings_period_order", sql`${table.startAt} < ${table.endAt}`),
    check(
      "bookings_duration_range",
      sql`${table.durationMinutes} BETWEEN ${sql.raw(
        String(LIMITS.serviceDurationMin),
      )} AND ${sql.raw(String(LIMITS.serviceDurationMax))}`,
    ),
    check(
      "bookings_price_range",
      sql`${table.priceMinor} BETWEEN ${sql.raw(
        String(LIMITS.servicePriceMinorMin),
      )} AND ${sql.raw(String(LIMITS.servicePriceMinorMax))}`,
    ),
    check(
      "bookings_client_latitude_range",
      sql`${table.clientLatitude} IS NULL OR ${table.clientLatitude} BETWEEN -90 AND 90`,
    ),
    check(
      "bookings_client_longitude_range",
      sql`${table.clientLongitude} IS NULL OR ${table.clientLongitude} BETWEEN -180 AND 180`,
    ),
    // Les deux coordonnées sont nulles ensemble ou non nulles ensemble.
    check(
      "bookings_client_coordinates_together",
      sql`(${table.clientLatitude} IS NULL) = (${table.clientLongitude} IS NULL)`,
    ),
  ],
);

export type BookingRow = typeof bookings.$inferSelect;
export type NewBookingRow = typeof bookings.$inferInsert;
