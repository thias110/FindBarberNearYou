// Migration de vérification d'email (mission A) sur une base peuplée. La cible
// est découverte PAR CONTENU (`ADD COLUMN "email_verified_at"`), sans dépendre
// de la dernière entrée du journal. Vérifie le backfill des comptes existants
// et la création de la table de jetons (unicité + cascade).
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { describe, expect, it } from "vitest";
import {
  findTagBySqlContent,
  readMigration,
  tagsBefore,
} from "./migration-helpers";

const EMAIL_VERIFICATION_TAG = findTagBySqlContent((sql) =>
  sql.includes('ADD COLUMN "email_verified_at"'),
);

describe("migration email_verified_at sur une base peuplée", () => {
  it("backfill les comptes existants et crée la table de jetons", async () => {
    const before = tagsBefore(EMAIL_VERIFICATION_TAG);
    expect(
      before.some((tag) => readMigration(tag).includes('CREATE TABLE "users"')),
    ).toBe(true);

    const targetSql = readMigration(EMAIL_VERIFICATION_TAG);
    expect(targetSql).toContain('ADD COLUMN "email_verified_at"');
    expect(targetSql).toContain('CREATE TABLE "email_verification_tokens"');
    expect(targetSql).toContain(
      'UPDATE "users" SET "email_verified_at" = "created_at"',
    );

    const client = new PGlite();
    for (const tag of before) {
      await client.exec(readMigration(tag));
    }

    const userId = randomUUID();
    await client.exec(`
      INSERT INTO users (id, email, password_hash, role, status)
        VALUES ('${userId}', 'legacy@example.com', 'hash', 'CLIENT', 'ACTIVE');
    `);

    await client.exec(readMigration(EMAIL_VERIFICATION_TAG));

    // Backfill : les comptes existants sont marqués vérifiés.
    const backfilled = await client.query(
      `SELECT
         email_verified_at IS NOT NULL AS verified,
         email_verified_at = created_at AS matches
       FROM users WHERE id = $1`,
      [userId],
    );
    expect(backfilled.rows[0].verified).toBe(true);
    expect(backfilled.rows[0].matches).toBe(true);

    // Table de jetons créée vide.
    const empty = await client.query(
      "SELECT count(*)::int AS n FROM email_verification_tokens",
    );
    expect(empty.rows[0].n).toBe(0);

    // Insertion valide d'un jeton (empreinte unique).
    await client.exec(`
      INSERT INTO email_verification_tokens (id, user_id, token_hash, expires_at)
        VALUES ('${randomUUID()}', '${userId}', 'hash1', '2027-01-01T00:00:00Z');
    `);
    const inserted = await client.query(
      "SELECT count(*)::int AS n FROM email_verification_tokens",
    );
    expect(inserted.rows[0].n).toBe(1);

    // Unicité de l'empreinte.
    await expect(
      client.exec(`
        INSERT INTO email_verification_tokens (id, user_id, token_hash, expires_at)
          VALUES ('${randomUUID()}', '${userId}', 'hash1', '2027-01-01T00:00:00Z')
      `),
    ).rejects.toThrow();

    // FK cascade : suppression de l'utilisateur → jetons supprimés.
    await client.exec(`DELETE FROM users WHERE id = '${userId}'`);
    const afterCascade = await client.query(
      "SELECT count(*)::int AS n FROM email_verification_tokens",
    );
    expect(afterCascade.rows[0].n).toBe(0);

    await client.close();
  });
});
