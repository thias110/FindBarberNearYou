// Migration des horaires (lot 5) sur une base peuplée. La migration cible est
// découverte PAR CONTENU (`CREATE TABLE "barber_working_hours"`), sans
// dépendre de la dernière entrée du journal : ce test reste valide après les
// migrations suivantes (fuseau, congés, réservations…).
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { describe, expect, it } from "vitest";
import {
  findTagBySqlContent,
  readMigration,
  tagsBefore,
} from "./migration-helpers";

const WORKING_HOURS_TAG = findTagBySqlContent((sql) =>
  sql.includes('CREATE TABLE "barber_working_hours"'),
);

describe("migration barber_working_hours sur une base peuplée", () => {
  it("conserve les données existantes et crée barber_working_hours vide", async () => {
    const before = tagsBefore(WORKING_HOURS_TAG);
    expect(before.length).toBeGreaterThan(1);

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
        VALUES ('${userId}', 'legacy@example.com', 'hash', 'BARBER', 'ACTIVE');
      INSERT INTO barber_profiles
        (id, user_id, display_name, description, address, city, postal_code, country_code, latitude, longitude, currency)
        VALUES ('${profileId}', '${userId}', 'Legacy Barber', 'desc', 'Rue 1', 'Genève', NULL, 'CH', 46.2, 6.14, 'CHF');
      INSERT INTO barber_services
        (id, barber_profile_id, name, description, duration_minutes, price_minor, is_active)
        VALUES ('${serviceId}', '${profileId}', 'Ancien service', NULL, 30, 2500, true);
    `);

    await client.exec(readMigration(WORKING_HOURS_TAG));

    const profiles = await client.query(
      "SELECT count(*)::int AS n FROM barber_profiles",
    );
    expect(profiles.rows[0].n).toBe(1);

    const services = await client.query(
      "SELECT count(*)::int AS n FROM barber_services",
    );
    expect(services.rows[0].n).toBe(1);

    // La nouvelle table existe, vide : aucun horaire inventé.
    const hours = await client.query(
      "SELECT count(*)::int AS n FROM barber_working_hours",
    );
    expect(hours.rows[0].n).toBe(0);

    await client.close();
  });
});
