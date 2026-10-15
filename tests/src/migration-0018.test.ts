// Migration de la suppression de compte (issue #14) sur une base peuplée :
// nouveau statut DELETED, action d'audit USER_DELETED, colonne deleted_at.
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { btree_gist } from "@electric-sql/pglite/contrib/btree_gist";
import { describe, expect, it } from "vitest";
import {
  findTagBySqlContent,
  readMigration,
  tagsBefore,
} from "./migration-helpers";

const TAG = findTagBySqlContent((sql) => sql.includes(`ADD VALUE 'DELETED'`));

describe("migration suppression de compte sur une base peuplée", () => {
  it("ajoute le statut, l'action d'audit et deleted_at sans toucher aux comptes", async () => {
    const client = new PGlite({ extensions: { btree_gist } });
    for (const tag of tagsBefore(TAG)) {
      await client.exec(readMigration(tag));
    }
    const id = randomUUID();
    await client.exec(`
      INSERT INTO users (id, email, password_hash, role, status)
        VALUES ('${id}', 'legacy-del@example.com', 'hash', 'CLIENT', 'ACTIVE');
    `);

    await client.exec(readMigration(TAG));

    const before = await client.query<{
      status: string;
      deleted_at: Date | null;
    }>(`SELECT status, deleted_at FROM users WHERE id = '${id}'`);
    expect(before.rows[0]).toEqual({ status: "ACTIVE", deleted_at: null });

    await client.exec(
      `UPDATE users SET status = 'DELETED', deleted_at = now() WHERE id = '${id}'`,
    );
    await client.exec(`
      INSERT INTO audit_logs (id, actor_user_id, actor_role, action, target_type, target_id)
        VALUES ('${randomUUID()}', '${id}', 'CLIENT', 'USER_DELETED', 'USER', '${id}');
    `);
    const after = await client.query<{ status: string }>(
      `SELECT status FROM users WHERE id = '${id}'`,
    );
    expect(after.rows[0].status).toBe("DELETED");
    await client.close();
  });
});
