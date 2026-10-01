import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { describe, expect, it } from "vitest";

const DRIZZLE_DIR = fileURLToPath(
  new URL("../../server/drizzle", import.meta.url),
);

function readMigration(tag: string): string {
  return readFileSync(`${DRIZZLE_DIR}/${tag}.sql`, "utf8");
}

// Découvre les tags dynamiquement depuis le journal drizzle : aucun numéro de
// migration n'est supposé. La dernière entrée est celle qui ajoute
// `barber_working_hours`.
function migrationTags(): string[] {
  const journal = JSON.parse(
    readFileSync(`${DRIZZLE_DIR}/meta/_journal.json`, "utf8"),
  ) as { entries: { tag: string }[] };
  return journal.entries.map((entry) => entry.tag);
}

describe("dernière migration sur une base peuplée", () => {
  it("conserve les données existantes et crée barber_working_hours vide", async () => {
    const tags = migrationTags();
    expect(tags.length).toBeGreaterThan(1);
    const last = tags[tags.length - 1];

    const client = new PGlite();
    for (const tag of tags.slice(0, -1)) {
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

    await client.exec(readMigration(last));

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
