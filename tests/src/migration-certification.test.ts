// Migration du badge « Certifié » (issue #41) sur une base peuplée : les
// profils existants ne sont pas certifiés et les nouvelles actions d'audit
// sont utilisables.
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { btree_gist } from "@electric-sql/pglite/contrib/btree_gist";
import { describe, expect, it } from "vitest";
import { findTagBySqlContent, readMigration, tagsBefore } from "./migration-helpers";

const TAG = findTagBySqlContent((sql) => sql.includes('ADD COLUMN "certified_at"'));

describe("migration badge « Certifié » sur une base peuplée", () => {
  it("laisse les profils existants non certifiés et accepte les actions d'audit", async () => {
    const client = new PGlite({ extensions: { btree_gist } });
    for (const tag of tagsBefore(TAG)) await client.exec(readMigration(tag));
    const userId = randomUUID();
    const profileId = randomUUID();
    await client.exec(`
      INSERT INTO users (id, email, password_hash, role, status)
        VALUES ('${userId}', 'legacy-cert@example.com', 'hash', 'BARBER', 'ACTIVE');
      INSERT INTO barber_profiles
        (id, user_id, display_name, description, address, city, postal_code, country_code, latitude, longitude, currency)
        VALUES ('${profileId}', '${userId}', 'Legacy', 'desc', 'Rue 1', 'Genève', NULL, 'CH', 46.2, 6.14, 'CHF');
    `);

    await client.exec(readMigration(TAG));

    const profile = await client.query<{ certified_at: Date | null }>(
      `SELECT certified_at FROM barber_profiles WHERE id = '${profileId}'`,
    );
    expect(profile.rows[0].certified_at).toBeNull();
    await client.exec(`
      INSERT INTO audit_logs (id, actor_user_id, actor_role, action, target_type, target_id)
        VALUES ('${randomUUID()}', NULL, NULL, 'BARBER_CERTIFIED', 'BARBER_PROFILE', '${profileId}');
    `);
    await client.close();
  });
});
