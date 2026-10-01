// Migration du fuseau (lot 6A) sur une base peuplée. La migration cible est
// découverte PAR CONTENU (`ADD COLUMN "timezone"`), sans dépendre de la
// dernière entrée du journal : ce test reste valide après les migrations
// suivantes (congés, réservations…).
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { describe, expect, it } from "vitest";
import {
  findTagBySqlContent,
  readMigration,
  tagsBefore,
} from "./migration-helpers";

const TIMEZONE_TAG = findTagBySqlContent((sql) =>
  sql.includes('ADD COLUMN "timezone"'),
);

describe("migration timezone sur une base peuplée", () => {
  it("ajoute une colonne nullable sans altérer les données existantes", async () => {
    const before = tagsBefore(TIMEZONE_TAG);
    // Les horaires (0004) doivent précéder la cible : on insère des plages.
    expect(
      before.some((tag) =>
        readMigration(tag).includes('CREATE TABLE "barber_working_hours"'),
      ),
    ).toBe(true);

    const client = new PGlite();
    for (const tag of before) {
      await client.exec(readMigration(tag));
    }

    const userId = randomUUID();
    const profileId = randomUUID();
    const serviceId = randomUUID();
    await client.exec(`
      INSERT INTO users (id, email, password_hash, role, status)
        VALUES ('${userId}', 'legacy@example.com', 'hash', 'BARBER', 'ACTIVE');
      INSERT INTO barber_profiles
        (id, user_id, display_name, description, address, city, postal_code, country_code, latitude, longitude, currency)
        VALUES ('${profileId}', '${userId}', 'Legacy Barber', 'desc', 'Rue 1', 'Genève', NULL, 'CH', 46.2, 6.14, 'CHF');
      INSERT INTO barber_services
        (id, barber_profile_id, name, description, duration_minutes, price_minor, is_active)
        VALUES ('${serviceId}', '${profileId}', 'Ancien service', NULL, 30, 2500, true);
      INSERT INTO barber_working_hours
        (id, barber_profile_id, weekday, start_minute, end_minute)
        VALUES ('${randomUUID()}', '${profileId}', 1, 540, 720);
    `);

    await client.exec(readMigration(TIMEZONE_TAG));

    // Données conservées ; aucun fuseau inventé pour les profils existants.
    const profiles = await client.query(
      "SELECT count(*)::int AS n, count(timezone)::int AS tz FROM barber_profiles",
    );
    expect(profiles.rows[0].n).toBe(1);
    expect(profiles.rows[0].tz).toBe(0);

    const services = await client.query(
      "SELECT count(*)::int AS n FROM barber_services",
    );
    expect(services.rows[0].n).toBe(1);

    const hours = await client.query(
      "SELECT count(*)::int AS n FROM barber_working_hours",
    );
    expect(hours.rows[0].n).toBe(1);

    // Colonne utilisable : valeur puis effacement.
    await client.exec(
      `UPDATE barber_profiles SET timezone = 'Europe/Zurich' WHERE id = '${profileId}'`,
    );
    const set = await client.query(
      "SELECT timezone FROM barber_profiles WHERE id = $1",
      [profileId],
    );
    expect(set.rows[0].timezone).toBe("Europe/Zurich");

    await client.exec(
      `UPDATE barber_profiles SET timezone = NULL WHERE id = '${profileId}'`,
    );
    const cleared = await client.query(
      "SELECT timezone FROM barber_profiles WHERE id = $1",
      [profileId],
    );
    expect(cleared.rows[0].timezone).toBeNull();

    // CHECK de longueur (<= 64) appliqué en dernier ressort.
    await expect(
      client.exec(
        `UPDATE barber_profiles SET timezone = '${"Europe/" + "x".repeat(58)}' WHERE id = '${profileId}'`,
      ),
    ).rejects.toThrow();

    await client.close();
  });
});
