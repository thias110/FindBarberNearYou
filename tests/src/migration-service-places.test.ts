// Migration des lieux de prestation (lot 8, issue #19) sur une base peuplée. La
// migration cible est découverte PAR CONTENU (`CREATE TABLE "barber_profile_places"`),
// sans dépendre de la dernière entrée du journal : ce test reste valide après
// les migrations suivantes (réservations, paiements…).
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { describe, expect, it } from "vitest";
import {
  findTagBySqlContent,
  readMigration,
  tagsBefore,
} from "./migration-helpers";

const PLACES_TAG = findTagBySqlContent((sql) =>
  sql.includes('CREATE TABLE "barber_profile_places"'),
);

describe("migration barber_profile_places sur une base peuplée", () => {
  it("conserve les données historiques et crée des lieux vides", async () => {
    const before = tagsBefore(PLACES_TAG);
    expect(before.length).toBeGreaterThan(1);
    expect(
      before.some((tag) =>
        readMigration(tag).includes('CREATE TABLE "barber_working_hours"'),
      ),
    ).toBe(true);
    expect(
      before.some((tag) => readMigration(tag).includes('ADD COLUMN "timezone"')),
    ).toBe(true);
    expect(
      before.some((tag) =>
        readMigration(tag).includes('CREATE TABLE "barber_time_off"'),
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
        VALUES ('${userId}', 'legacy-places@example.com', 'hash', 'BARBER', 'ACTIVE');
      INSERT INTO barber_profiles
        (id, user_id, display_name, description, address, city, postal_code, country_code, latitude, longitude, currency, timezone)
        VALUES ('${profileId}', '${userId}', 'Legacy Barber', 'desc', 'Rue historique 1', 'Genève', NULL, 'CH', 46.2, 6.14, 'CHF', 'Europe/Zurich');
      INSERT INTO barber_services
        (id, barber_profile_id, name, description, duration_minutes, price_minor, is_active)
        VALUES ('${serviceId}', '${profileId}', 'Ancien service', NULL, 30, 2500, true);
      INSERT INTO barber_working_hours
        (id, barber_profile_id, weekday, start_minute, end_minute)
        VALUES ('${randomUUID()}', '${profileId}', 1, 540, 720);
      INSERT INTO barber_time_off
        (id, barber_profile_id, start_date, end_date)
        VALUES ('${randomUUID()}', '${profileId}', '2026-06-01', '2026-06-01');
    `);

    await client.exec(readMigration(PLACES_TAG));

    // Données conservées, adresse historique intacte, aucun lieu inventé.
    const profiles = await client.query(
      "SELECT count(*)::int AS n, max(address) AS address, max(travel_radius_km) AS radius FROM barber_profiles",
    );
    expect(profiles.rows[0].n).toBe(1);
    expect(profiles.rows[0].address).toBe("Rue historique 1");
    expect(profiles.rows[0].radius).toBeNull();

    const services = await client.query(
      "SELECT count(*)::int AS n FROM barber_services",
    );
    expect(services.rows[0].n).toBe(1);
    const hours = await client.query(
      "SELECT count(*)::int AS n FROM barber_working_hours",
    );
    expect(hours.rows[0].n).toBe(1);
    const timeOff = await client.query(
      "SELECT count(*)::int AS n FROM barber_time_off",
    );
    expect(timeOff.rows[0].n).toBe(1);

    const places = await client.query(
      "SELECT count(*)::int AS n FROM barber_profile_places",
    );
    expect(places.rows[0].n).toBe(0);

    // Relaxation NOT NULL sur address : un profil mobile peut désormais l'effacer.
    await client.exec(
      `UPDATE barber_profiles SET address = NULL, travel_radius_km = 25 WHERE id = '${profileId}'`,
    );
    const cleared = await client.query(
      "SELECT address, travel_radius_km FROM barber_profiles WHERE id = $1",
      [profileId],
    );
    expect(cleared.rows[0].address).toBeNull();
    expect(cleared.rows[0].travel_radius_km).toBe(25);

    // CHECK du rayon : 0 et 101 refusés, 1 et 100 acceptés.
    await expect(
      client.exec(
        `UPDATE barber_profiles SET travel_radius_km = 0 WHERE id = '${profileId}'`,
      ),
    ).rejects.toThrow();
    await expect(
      client.exec(
        `UPDATE barber_profiles SET travel_radius_km = 101 WHERE id = '${profileId}'`,
      ),
    ).rejects.toThrow();
    await client.exec(
      `UPDATE barber_profiles SET travel_radius_km = 1 WHERE id = '${profileId}'`,
    );
    await client.exec(
      `UPDATE barber_profiles SET travel_radius_km = 100 WHERE id = '${profileId}'`,
    );

    // Ensemble de lieux : insertion, enum et unicité (profil, lieu).
    await client.exec(`
      INSERT INTO barber_profile_places (barber_profile_id, place)
        VALUES ('${profileId}', 'SALON'), ('${profileId}', 'AT_CLIENT');
    `);
    const inserted = await client.query(
      "SELECT count(*)::int AS n FROM barber_profile_places",
    );
    expect(inserted.rows[0].n).toBe(2);
    await expect(
      client.exec(`
        INSERT INTO barber_profile_places (barber_profile_id, place)
          VALUES ('${profileId}', 'SALON');
      `),
    ).rejects.toThrow();

    await client.close();
  });
});
