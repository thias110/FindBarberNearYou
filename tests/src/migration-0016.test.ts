// Migration du journal d'audit (issue #13) sur une base peuplée. La cible est
// découverte PAR CONTENU (`CREATE TABLE "audit_logs"`). Vérifie que la
// migration est additive, que l'enum refuse une action inconnue et que la
// suppression d'un acteur conserve l'entrée (actor_user_id → NULL).
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { btree_gist } from "@electric-sql/pglite/contrib/btree_gist";
import { describe, expect, it } from "vitest";
import {
  findTagBySqlContent,
  readMigration,
  tagsBefore,
} from "./migration-helpers";

const AUDIT_TAG = findTagBySqlContent((sql) =>
  sql.includes('CREATE TABLE "audit_logs"'),
);

describe("migration audit_logs sur une base peuplée", () => {
  it("crée la table vide, valide les actions et survit à la suppression de l'acteur", async () => {
    const client = new PGlite({ extensions: { btree_gist } });
    for (const tag of tagsBefore(AUDIT_TAG)) {
      await client.exec(readMigration(tag));
    }

    const adminId = randomUUID();
    const targetId = randomUUID();
    await client.exec(`
      INSERT INTO users (id, email, password_hash, role, status)
        VALUES ('${adminId}', 'legacy-admin@example.com', 'hash', 'ADMIN', 'ACTIVE'),
               ('${targetId}', 'legacy-user@example.com', 'hash', 'CLIENT', 'ACTIVE');
    `);

    await client.exec(readMigration(AUDIT_TAG));

    const users = await client.query("SELECT count(*)::int AS n FROM users");
    expect(users.rows[0]).toEqual({ n: 2 });
    const empty = await client.query(
      "SELECT count(*)::int AS n FROM audit_logs",
    );
    expect(empty.rows[0]).toEqual({ n: 0 });

    const entryId = randomUUID();
    await client.exec(`
      INSERT INTO audit_logs (id, actor_user_id, actor_role, action, target_type, target_id, metadata)
        VALUES ('${entryId}', '${adminId}', 'ADMIN', 'USER_SUSPENDED', 'USER', '${targetId}', '{"role":"CLIENT"}');
    `);

    await expect(
      client.exec(`
        INSERT INTO audit_logs (id, action, target_type, target_id)
          VALUES ('${randomUUID()}', 'UNKNOWN_ACTION', 'USER', '${targetId}')
      `),
    ).rejects.toThrow();

    await client.exec(`DELETE FROM users WHERE id = '${adminId}'`);
    const kept = await client.query<{
      actor_user_id: string | null;
      actor_role: string;
    }>(
      `SELECT actor_user_id, actor_role FROM audit_logs WHERE id = '${entryId}'`,
    );
    expect(kept.rows[0]).toEqual({ actor_user_id: null, actor_role: "ADMIN" });

    await client.close();
  });
});
