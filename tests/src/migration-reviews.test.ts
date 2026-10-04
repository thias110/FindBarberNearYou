// Migration des avis (lot 11) sur une base peuplée. La migration cible est
// découverte PAR CONTENU (`CREATE TABLE "reviews"`), sans dépendre de la
// dernière entrée du journal. Vérifie l'unicité par réservation et les CHECK
// note/commentaire en dernier ressort.
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { describe, expect, it } from "vitest";
import {
  findTagBySqlContent,
  readMigration,
  tagsBefore,
} from "./migration-helpers";

const REVIEWS_TAG = findTagBySqlContent((sql) =>
  sql.includes('CREATE TABLE "reviews"'),
);

describe("migration reviews sur une base peuplée", () => {
  it("crée la table avec unicité par booking et CHECK note/commentaire", async () => {
    const before = tagsBefore(REVIEWS_TAG);
    expect(
      before.some((tag) =>
        readMigration(tag).includes('CREATE TABLE "bookings"'),
      ),
    ).toBe(true);

    const client = new PGlite();
    for (const tag of before) {
      await client.exec(readMigration(tag));
    }

    const userId = randomUUID();
    const profileId = randomUUID();
    const serviceId = randomUUID();
    const bookingId = randomUUID();
    const bookingId2 = randomUUID();
    await client.exec(`
      INSERT INTO users (id, email, password_hash, role, status)
        VALUES ('${userId}', 'legacy-reviews@example.com', 'hash', 'BARBER', 'ACTIVE');
      INSERT INTO barber_profiles
        (id, user_id, display_name, description, address, city, postal_code, country_code, latitude, longitude, currency, timezone)
        VALUES ('${profileId}', '${userId}', 'Legacy Barber', 'desc', 'Rue historique 1', 'Genève', NULL, 'CH', 46.2, 6.14, 'CHF', 'Europe/Zurich');
      INSERT INTO barber_services
        (id, barber_profile_id, name, description, duration_minutes, price_minor, is_active)
        VALUES ('${serviceId}', '${profileId}', 'Ancien service', NULL, 30, 2500, true);
      INSERT INTO bookings
        (id, client_user_id, barber_profile_id, service_id, start_at, end_at,
         service_place, status, barber_display_name, service_name, service_description,
         duration_minutes, price_minor, currency)
        VALUES ('${bookingId}', '${userId}', '${profileId}', '${serviceId}',
          '2026-06-01T09:00:00Z', '2026-06-01T09:30:00Z', 'SALON', 'COMPLETED',
          'Legacy Barber', 'Ancien service', NULL, 30, 2500, 'CHF'),
        ('${bookingId2}', '${userId}', '${profileId}', '${serviceId}',
          '2026-06-02T09:00:00Z', '2026-06-02T09:30:00Z', 'SALON', 'COMPLETED',
          'Legacy Barber', 'Ancien service', NULL, 30, 2500, 'CHF');
    `);

    await client.exec(readMigration(REVIEWS_TAG));

    // Table vide, sans avis inventé.
    const empty = await client.query("SELECT count(*)::int AS n FROM reviews");
    expect(empty.rows[0].n).toBe(0);

    // Insertion valide.
    const reviewId = randomUUID();
    await client.exec(`
      INSERT INTO reviews (id, booking_id, rating, comment)
        VALUES ('${reviewId}', '${bookingId}', 5, 'Super !');
    `);

    // Unicité par réservation : second avis refusé pour le même booking.
    await expect(
      client.exec(`
        INSERT INTO reviews (id, booking_id, rating, comment)
          VALUES ('${randomUUID()}', '${bookingId}', 4, NULL)
      `),
    ).rejects.toThrow();

    // CHECK note 1..5.
    await expect(
      client.exec(`
        INSERT INTO reviews (id, booking_id, rating, comment)
          VALUES ('${randomUUID()}', '${bookingId2}', 0, NULL)
      `),
    ).rejects.toThrow();
    await expect(
      client.exec(`
        INSERT INTO reviews (id, booking_id, rating, comment)
          VALUES ('${randomUUID()}', '${bookingId2}', 6, NULL)
      `),
    ).rejects.toThrow();

    // CHECK longueur de commentaire (<= 1000).
    await expect(
      client.exec(`
        INSERT INTO reviews (id, booking_id, rating, comment)
          VALUES ('${randomUUID()}', '${bookingId2}', 5, '${"a".repeat(1001)}')
      `),
    ).rejects.toThrow();

    // FK cascade : suppression du booking → avis supprimé.
    await client.exec(`DELETE FROM bookings WHERE id = '${bookingId}'`);
    const afterCascade = await client.query(
      "SELECT count(*)::int AS n FROM reviews",
    );
    expect(afterCascade.rows[0].n).toBe(0);

    await client.close();
  });
});
