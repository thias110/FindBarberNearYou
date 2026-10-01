// Migration des indisponibilités (lot 7, issue #22) sur une base peuplée. La
// migration cible est découverte PAR CONTENU (`CREATE TABLE "barber_time_off"`),
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

const TIME_OFF_TAG = findTagBySqlContent((sql) =>
  sql.includes('CREATE TABLE "barber_time_off"'),
);

describe("migration barber_time_off sur une base peuplée", () => {
  it("conserve les données existantes et crée barber_time_off vide", async () => {
    const before = tagsBefore(TIME_OFF_TAG);
    expect(before.length).toBeGreaterThan(1);
    // La cible doit suivre les horaires (0004) et le fuseau (0005).
    expect(
      before.some((tag) =>
        readMigration(tag).includes('CREATE TABLE "barber_working_hours"'),
      ),
    ).toBe(true);
    expect(
      before.some((tag) => readMigration(tag).includes('ADD COLUMN "timezone"')),
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
        VALUES ('${userId}', 'legacy-timeoff@example.com', 'hash', 'BARBER', 'ACTIVE');
      INSERT INTO barber_profiles
        (id, user_id, display_name, description, address, city, postal_code, country_code, latitude, longitude, currency, timezone)
        VALUES ('${profileId}', '${userId}', 'Legacy Barber', 'desc', 'Rue 1', 'Genève', NULL, 'CH', 46.2, 6.14, 'CHF', 'Europe/Zurich');
      INSERT INTO barber_services
        (id, barber_profile_id, name, description, duration_minutes, price_minor, is_active)
        VALUES ('${serviceId}', '${profileId}', 'Ancien service', NULL, 30, 2500, true);
      INSERT INTO barber_working_hours
        (id, barber_profile_id, weekday, start_minute, end_minute)
        VALUES ('${randomUUID()}', '${profileId}', 1, 540, 720);
    `);

    await client.exec(readMigration(TIME_OFF_TAG));

    const profiles = await client.query(
      "SELECT count(*)::int AS n, count(timezone)::int AS tz FROM barber_profiles",
    );
    expect(profiles.rows[0].n).toBe(1);
    expect(profiles.rows[0].tz).toBe(1);

    const services = await client.query(
      "SELECT count(*)::int AS n FROM barber_services",
    );
    expect(services.rows[0].n).toBe(1);

    const hours = await client.query(
      "SELECT count(*)::int AS n FROM barber_working_hours",
    );
    expect(hours.rows[0].n).toBe(1);

    // La nouvelle table existe, vide : aucune indisponibilité inventée.
    const timeOff = await client.query(
      "SELECT count(*)::int AS n FROM barber_time_off",
    );
    expect(timeOff.rows[0].n).toBe(0);

    // Contraintes : ordre des dates, durée maximale, longueur du motif.
    await expect(
      client.exec(`
        INSERT INTO barber_time_off (id, barber_profile_id, start_date, end_date)
        VALUES ('${randomUUID()}', '${profileId}', '2026-06-10', '2026-06-01');
      `),
    ).rejects.toThrow();
    await expect(
      client.exec(`
        INSERT INTO barber_time_off (id, barber_profile_id, start_date, end_date)
        VALUES ('${randomUUID()}', '${profileId}', '2026-01-01', '2027-01-02');
      `),
    ).rejects.toThrow();
    await expect(
      client.exec(`
        INSERT INTO barber_time_off (id, barber_profile_id, start_date, end_date, reason)
        VALUES ('${randomUUID()}', '${profileId}', '2026-06-01', '2026-06-01', '${"a".repeat(501)}');
      `),
    ).rejects.toThrow();

    // Bornes acceptées : journée unique, puis 366 jours inclus.
    await client.exec(`
      INSERT INTO barber_time_off (id, barber_profile_id, start_date, end_date, reason)
      VALUES ('${randomUUID()}', '${profileId}', '2026-06-01', '2026-06-01', 'Fermeture');
    `);
    await client.exec(`
      INSERT INTO barber_time_off (id, barber_profile_id, start_date, end_date)
      VALUES ('${randomUUID()}', '${profileId}', '2028-01-01', '2028-12-31');
    `);
    const inserted = await client.query(
      "SELECT count(*)::int AS n FROM barber_time_off",
    );
    expect(inserted.rows[0].n).toBe(2);

    // Unicité exacte (profil, début, fin).
    await expect(
      client.exec(`
        INSERT INTO barber_time_off (id, barber_profile_id, start_date, end_date)
        VALUES ('${randomUUID()}', '${profileId}', '2026-06-01', '2026-06-01');
      `),
    ).rejects.toThrow();

    await client.close();
  });
});
