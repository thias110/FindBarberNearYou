// Migration du paiement en ligne (issue #10) sur une base peuplée : profils et
// réservations existants passent en « paiement sur place », sans rien perdre.
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { btree_gist } from "@electric-sql/pglite/contrib/btree_gist";
import { describe, expect, it } from "vitest";
import { findTagBySqlContent, readMigration, tagsBefore } from "./migration-helpers";

const TAG = findTagBySqlContent((sql) => sql.includes('CREATE TYPE "public"."payment_mode"'));

describe("migration paiement sur une base peuplée", () => {
  it("valeurs par défaut sûres et contraintes actives", async () => {
    const client = new PGlite({ extensions: { btree_gist } });
    for (const tag of tagsBefore(TAG)) await client.exec(readMigration(tag));
    const userId = randomUUID();
    const profileId = randomUUID();
    await client.exec(`
      INSERT INTO users (id, email, password_hash, role, status)
        VALUES ('${userId}', 'legacy-pay@example.com', 'hash', 'BARBER', 'ACTIVE');
      INSERT INTO barber_profiles
        (id, user_id, display_name, description, address, city, postal_code, country_code, latitude, longitude, currency)
        VALUES ('${profileId}', '${userId}', 'Legacy', 'desc', 'Rue 1', 'Genève', NULL, 'CH', 46.2, 6.14, 'CHF');
    `);

    await client.exec(readMigration(TAG));

    const profile = await client.query<{ payment_mode: string; deposit_percent: number; stripe_charges_enabled: boolean }>(
      `SELECT payment_mode, deposit_percent, stripe_charges_enabled FROM barber_profiles WHERE id = '${profileId}'`,
    );
    expect(profile.rows[0]).toEqual({ payment_mode: "NONE", deposit_percent: 20, stripe_charges_enabled: false });
    await expect(
      client.exec(`UPDATE barber_profiles SET deposit_percent = 95 WHERE id = '${profileId}'`),
    ).rejects.toThrow();
    await client.close();
  });
});
