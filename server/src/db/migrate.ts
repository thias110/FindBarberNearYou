import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { migrate as migratePglite } from "drizzle-orm/pglite/migrator";
import { migrate as migrateNodePg } from "drizzle-orm/node-postgres/migrator";
import { db, driverKind } from "./client.js";

// Works both from src/ (dev) and from the compiled bundle (dist/index.js,
// where the drizzle folder is copied to dist/drizzle).
const migrationCandidates = [
  fileURLToPath(new URL("../../drizzle", import.meta.url)), // dev: src/db -> server/drizzle
  fileURLToPath(new URL("../drizzle", import.meta.url)), // local compiled: server/drizzle
  fileURLToPath(new URL("./drizzle", import.meta.url)), // deployed compiled: dist/drizzle
];

const MIGRATIONS_FOLDER =
  migrationCandidates.find((p) => existsSync(p)) ?? migrationCandidates[0];

export async function migrateDb(): Promise<void> {
  if (driverKind === "postgres") {
    await migrateNodePg(db as never, { migrationsFolder: MIGRATIONS_FOLDER });
  } else {
    await migratePglite(db as never, { migrationsFolder: MIGRATIONS_FOLDER });
  }
}
