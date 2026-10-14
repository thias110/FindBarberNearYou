// Migration des emails (issue #9) sur une base peuplée : colonnes nullables
// ajoutées sans toucher aux données, tables vides, déduplication de la file.
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { btree_gist } from "@electric-sql/pglite/contrib/btree_gist";
import { describe, expect, it } from "vitest";
import {
  findTagBySqlContent,
  readMigration,
  tagsBefore,
} from "./migration-helpers";

const EMAIL_TAG = findTagBySqlContent((sql) =>
  sql.includes('CREATE TABLE "email_outbox"'),
);

describe("migration emails sur une base peuplée", () => {
  it("ajoute colonnes et tables sans altérer l'existant", async () => {
    const client = new PGlite({ extensions: { btree_gist } });
    for (const tag of tagsBefore(EMAIL_TAG)) {
      await client.exec(readMigration(tag));
    }
    const userId = randomUUID();
    await client.exec(`
      INSERT INTO users (id, email, password_hash, role, status, email_verified_at)
        VALUES ('${userId}', 'legacy-mail@example.com', 'hash', 'CLIENT', 'ACTIVE', now());
    `);

    await client.exec(readMigration(EMAIL_TAG));

    const user = await client.query<{
      password_changed_at: Date | null;
      password_hash: string;
    }>(
      `SELECT password_changed_at, password_hash FROM users WHERE id = '${userId}'`,
    );
    expect(user.rows[0]).toEqual({
      password_changed_at: null,
      password_hash: "hash",
    });

    for (const table of ["email_outbox", "password_reset_tokens"]) {
      const res = await client.query<{ n: number }>(
        `SELECT count(*)::int AS n FROM ${table}`,
      );
      expect(res.rows[0].n).toBe(0);
    }

    const insert = (id: string) =>
      client.exec(`
        INSERT INTO email_outbox (id, recipient_user_id, to_email, kind, dedupe_key, subject, text_body, html_body)
          VALUES ('${id}', '${userId}', 'legacy-mail@example.com', 'BOOKING_REMINDER', 'same-key', 's', 't', 'h');
      `);
    await insert(randomUUID());
    await expect(insert(randomUUID())).rejects.toThrow();

    // Suppression du compte : sa file d'emails part avec lui.
    await client.exec(`DELETE FROM users WHERE id = '${userId}'`);
    const left = await client.query<{ n: number }>(
      "SELECT count(*)::int AS n FROM email_outbox",
    );
    expect(left.rows[0].n).toBe(0);
    await client.close();
  });
});
