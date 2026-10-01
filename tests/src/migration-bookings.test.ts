// Migration des réservations (lot 9) sur une base peuplée. La migration cible
// est découverte PAR CONTENU (`CREATE TABLE "bookings"`), sans dépendre de la
// dernière entrée du journal : ce test reste valide après les migrations
// suivantes. Vérifie aussi que l'enum `service_place` est bien RÉUTILISÉ (pas
// de nouvel enum `booking_place`).
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { describe, expect, it } from "vitest";
import {
  findTagBySqlContent,
  readMigration,
  tagsBefore,
} from "./migration-helpers";

const BOOKINGS_TAG = findTagBySqlContent((sql) =>
  sql.includes('CREATE TABLE "bookings"'),
);

describe("migration bookings sur une base peuplée", () => {
  it("conserve l'historique et crée des réservations avec l'enum service_place réutilisé", async () => {
    const before = tagsBefore(BOOKINGS_TAG);
    expect(before.length).toBeGreaterThan(1);
    expect(
      before.some((tag) =>
        readMigration(tag).includes('CREATE TABLE "barber_profile_places"'),
      ),
    ).toBe(true);

    const client = new PGlite();
    for (const tag of before) {
      await client.exec(readMigration(tag));
    }

    // Données « anciennes » insérées avant la migration additive.
    const userId = randomUUID();
    const profileId = randomUUID();
    const serviceId = randomUUID();
    await client.exec(`
      INSERT INTO users (id, email, password_hash, role, status)
        VALUES ('${userId}', 'legacy-bookings@example.com', 'hash', 'BARBER', 'ACTIVE');
      INSERT INTO barber_profiles
        (id, user_id, display_name, description, address, city, postal_code, country_code, latitude, longitude, currency, timezone)
        VALUES ('${profileId}', '${userId}', 'Legacy Barber', 'desc', 'Rue historique 1', 'Genève', NULL, 'CH', 46.2, 6.14, 'CHF', 'Europe/Zurich');
      INSERT INTO barber_services
        (id, barber_profile_id, name, description, duration_minutes, price_minor, is_active)
        VALUES ('${serviceId}', '${profileId}', 'Ancien service', NULL, 30, 2500, true);
      INSERT INTO barber_profile_places (barber_profile_id, place)
        VALUES ('${profileId}', 'SALON');
      INSERT INTO barber_working_hours
        (id, barber_profile_id, weekday, start_minute, end_minute)
        VALUES ('${randomUUID()}', '${profileId}', 1, 540, 720);
    `);

    await client.exec(readMigration(BOOKINGS_TAG));

    // Données historiques conservées.
    const profiles = await client.query(
      "SELECT count(*)::int AS n FROM barber_profiles",
    );
    expect(profiles.rows[0].n).toBe(1);
    const services = await client.query(
      "SELECT count(*)::int AS n FROM barber_services",
    );
    expect(services.rows[0].n).toBe(1);
    const hours = await client.query(
      "SELECT count(*)::int AS n FROM barber_working_hours",
    );
    expect(hours.rows[0].n).toBe(1);

    // Table réservations vide, sans réservation inventée.
    const empty = await client.query(
      "SELECT count(*)::int AS n FROM bookings",
    );
    expect(empty.rows[0].n).toBe(0);

    // Enum des statuts complet dès la migration.
    const statuses = await client.query(
      "SELECT unnest(enum_range(NULL::booking_status))::text AS status",
    );
    expect(statuses.rows.map((r: { status: string }) => r.status).sort()).toEqual(
      ["CANCELLED", "COMPLETED", "CONFIRMED", "NO_SHOW", "PENDING"],
    );

    // Pas de nouvel enum booking_place : la colonne réutilise service_place.
    const placeType = await client.query(`
      SELECT data_type, udt_name
        FROM information_schema.columns
       WHERE table_name = 'bookings' AND column_name = 'service_place'
    `);
    expect(placeType.rows[0].udt_name).toBe("service_place");

    // Insertion d'une réservation valide (défaut PENDING, snapshots, service_place).
    const bookingId = randomUUID();
    await client.exec(`
      INSERT INTO bookings
        (id, client_user_id, barber_profile_id, service_id, start_at, end_at,
         service_place, status, barber_display_name, service_name, service_description,
         duration_minutes, price_minor, currency)
        VALUES ('${bookingId}', '${userId}', '${profileId}', '${serviceId}',
          '2026-06-01T09:00:00Z', '2026-06-01T09:30:00Z', 'SALON', 'PENDING',
          'Legacy Barber', 'Ancien service', NULL, 30, 2500, 'CHF');
    `);
    const inserted = await client.query(
      "SELECT status, barber_display_name, service_description FROM bookings WHERE id = $1",
      [bookingId],
    );
    expect(inserted.rows[0].status).toBe("PENDING");
    expect(inserted.rows[0].barber_display_name).toBe("Legacy Barber");
    expect(inserted.rows[0].service_description).toBeNull();

    // CHECK start < end et bornes durée/prix.
    await expect(
      client.exec(`
        UPDATE bookings SET end_at = '2026-06-01T08:00:00Z' WHERE id = '${bookingId}'
      `),
    ).rejects.toThrow();
    await expect(
      client.exec(`
        UPDATE bookings SET duration_minutes = 0 WHERE id = '${bookingId}'
      `),
    ).rejects.toThrow();
    await expect(
      client.exec(`
        UPDATE bookings SET price_minor = -1 WHERE id = '${bookingId}'
      `),
    ).rejects.toThrow();

    // FK : suppression du profil → réservation supprimée en cascade ; service → restrict.
    await expect(
      client.exec(`DELETE FROM barber_services WHERE id = '${serviceId}'`),
    ).rejects.toThrow();
    await client.exec(`DELETE FROM barber_profiles WHERE id = '${profileId}'`);
    const afterCascade = await client.query(
      "SELECT count(*)::int AS n FROM bookings",
    );
    expect(afterCascade.rows[0].n).toBe(0);

    await client.close();
  });
});
