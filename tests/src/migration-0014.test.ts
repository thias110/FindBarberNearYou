// Migration des notifications (lot notifications Mission A) sur une base
// peuplée. La cible est découverte PAR CONTENU (`CREATE TABLE "notifications"`),
// sans dépendre de la dernière entrée du journal. Vérifie la table, l'enum, le
// dédoublonnage (user_id, type, booking_id) et la cascade.
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { describe, expect, it } from "vitest";
import {
  findTagBySqlContent,
  readMigration,
  tagsBefore,
} from "./migration-helpers";

const NOTIFICATIONS_TAG = findTagBySqlContent((sql) =>
  sql.includes('CREATE TABLE "notifications"'),
);

describe("migration notifications sur une base peuplée", () => {
  it("crée la table, l'enum et l'index unique anti-doublon", async () => {
    const before = tagsBefore(NOTIFICATIONS_TAG);
    expect(
      before.some((tag) => readMigration(tag).includes('CREATE TABLE "bookings"')),
    ).toBe(true);

    const client = new PGlite();
    for (const tag of before) {
      await client.exec(readMigration(tag));
    }

    const userId = randomUUID();
    const profileId = randomUUID();
    const serviceId = randomUUID();
    const bookingId = randomUUID();
    await client.exec(`
      INSERT INTO users (id, email, password_hash, role, status)
        VALUES ('${userId}', 'legacy-notif@example.com', 'hash', 'BARBER', 'ACTIVE');
      INSERT INTO barber_profiles
        (id, user_id, display_name, description, address, city, postal_code, country_code, latitude, longitude, currency)
        VALUES ('${profileId}', '${userId}', 'Legacy Barber', 'desc', 'Rue 1', 'Genève', NULL, 'CH', 46.2, 6.14, 'CHF');
      INSERT INTO barber_services
        (id, barber_profile_id, name, description, duration_minutes, price_minor, is_active)
        VALUES ('${serviceId}', '${profileId}', 'Ancien service', NULL, 30, 2500, true);
      INSERT INTO bookings
        (id, client_user_id, barber_profile_id, service_id, start_at, end_at,
         service_place, status, barber_display_name, service_name, service_description,
         duration_minutes, price_minor, currency)
        VALUES ('${bookingId}', '${userId}', '${profileId}', '${serviceId}',
          '2026-06-01T09:00:00Z', '2026-06-01T09:30:00Z', 'SALON', 'COMPLETED',
          'Legacy Barber', 'Ancien service', NULL, 30, 2500, 'CHF');
    `);

    await client.exec(readMigration(NOTIFICATIONS_TAG));

    // Table créée vide.
    const empty = await client.query(
      "SELECT count(*)::int AS n FROM notifications",
    );
    expect(empty.rows[0].n).toBe(0);

    // Insertion valide.
    await client.exec(`
      INSERT INTO notifications (id, user_id, actor_user_id, booking_id, type)
        VALUES ('${randomUUID()}', '${userId}', NULL, '${bookingId}', 'BOOKING_CONFIRMED');
    `);
    const one = await client.query(
      "SELECT count(*)::int AS n FROM notifications",
    );
    expect(one.rows[0].n).toBe(1);

    // Unicité (user_id, type, booking_id) : doublon refusé.
    await expect(
      client.exec(`
        INSERT INTO notifications (id, user_id, actor_user_id, booking_id, type)
          VALUES ('${randomUUID()}', '${userId}', NULL, '${bookingId}', 'BOOKING_CONFIRMED')
      `),
    ).rejects.toThrow();

    // FK cascade sur booking : suppression de la réservation → notification supprimée.
    await client.exec(`DELETE FROM bookings WHERE id = '${bookingId}'`);
    const afterCascade = await client.query(
      "SELECT count(*)::int AS n FROM notifications",
    );
    expect(afterCascade.rows[0].n).toBe(0);

    await client.close();
  });
});
