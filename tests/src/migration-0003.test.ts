import { randomUUID } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { describe, expect, it } from "vitest";

const DRIZZLE_DIR = fileURLToPath(
  new URL("../../server/drizzle", import.meta.url),
);

function readMigration(tag: string): string {
  return readFileSync(`${DRIZZLE_DIR}/${tag}.sql`, "utf8");
}

function findMigration(prefix: string): string {
  const file =
    readdirSync(DRIZZLE_DIR).find(
      (name) => name.startsWith(prefix) && name.endsWith(".sql"),
    ) ?? "";
  return file.replace(/\.sql$/, "");
}

describe("migration 0003 on a populated database", () => {
  it("preserves existing profiles and uncategorized services", async () => {
    const client = new PGlite();

    // Applique 0000-0002 puis insère un profil et un service « anciens ».
    for (const tag of [
      "0000_square_vanisher",
      "0001_cynical_mother_askani",
      "0002_stale_natasha_romanoff",
    ]) {
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
    `);

    const migration = findMigration("0003_");
    expect(migration).not.toBe("");
    await client.exec(readMigration(migration));

    const profiles = await client.query(
      "SELECT count(*)::int AS n FROM barber_profiles",
    );
    expect(profiles.rows[0].n).toBe(1);

    const services = await client.query(
      "SELECT count(*)::int AS n FROM barber_services",
    );
    expect(services.rows[0].n).toBe(1);

    // Les anciens services ne reçoivent aucune catégorie inventée.
    const audiences = await client.query(
      "SELECT count(*)::int AS n FROM barber_service_audiences",
    );
    expect(audiences.rows[0].n).toBe(0);

    const techniques = await client.query(
      "SELECT count(*)::int AS n FROM barber_service_techniques",
    );
    expect(techniques.rows[0].n).toBe(0);

    await client.close();
  });
});
