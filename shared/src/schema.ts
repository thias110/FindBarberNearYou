import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  doublePrecision,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import {
  LIMITS,
  ROLES,
  SUPPORTED_CURRENCIES,
  USER_STATUSES,
} from "./constants";

export const userRoleEnum = pgEnum("user_role", [...ROLES]);
export const userStatusEnum = pgEnum("user_status", [...USER_STATUSES]);
export const currencyEnum = pgEnum("currency", [...SUPPORTED_CURRENCIES]);

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

export type BarberProfile = typeof barberProfiles.$inferSelect;
export type NewBarberProfile = typeof barberProfiles.$inferInsert;
export type BarberService = typeof barberServices.$inferSelect;
export type NewBarberService = typeof barberServices.$inferInsert;
