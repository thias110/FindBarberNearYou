import { sql } from "drizzle-orm";
import {
  boolean,
  check,
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
  LIMITS,
  ROLES,
  SUPPORTED_CURRENCIES,
  TECHNIQUES,
  USER_STATUSES,
} from "./constants";

export const userRoleEnum = pgEnum("user_role", [...ROLES]);
export const userStatusEnum = pgEnum("user_status", [...USER_STATUSES]);
export const currencyEnum = pgEnum("currency", [...SUPPORTED_CURRENCIES]);
export const audienceEnum = pgEnum("audience", [...AUDIENCES]);
export const techniqueEnum = pgEnum("technique", [...TECHNIQUES]);

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
    address: text("address").notNull(),
    city: text("city").notNull(),
    postalCode: text("postal_code"),
    countryCode: text("country_code").notNull(),
    latitude: doublePrecision("latitude").notNull(),
    longitude: doublePrecision("longitude").notNull(),
    currency: currencyEnum("currency").notNull().default("CHF"),
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
export type BarberWorkingHours = typeof barberWorkingHours.$inferSelect;
export type NewBarberWorkingHours = typeof barberWorkingHours.$inferInsert;
