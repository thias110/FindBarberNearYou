import { mkdirSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import type { PgliteDatabase } from "drizzle-orm/pglite";
import { drizzle as drizzleNodePg } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { barberProfiles, barberServices, users } from "@findbarber/shared/schema";
import { env } from "../config/env.js";

export const schema = { users, barberProfiles, barberServices };

// The query API is identical for both drivers; we type `db` with the PGlite
// database type and keep the concrete driver in `driverKind`.
export type Db = PgliteDatabase<typeof schema>;
export type DriverKind = "pglite" | "postgres";

let pglite: PGlite | undefined;
let pool: Pool | undefined;

export const driverKind: DriverKind =
  env.NODE_ENV === "production" ? "postgres" : "pglite";

function createDb(): Db {
  if (driverKind === "postgres") {
    pool = new Pool({ connectionString: env.DATABASE_URL });
    return drizzleNodePg(pool, { schema }) as unknown as Db;
  }

  const dataDir = env.PGLITE_DATA_DIR || undefined;
  if (dataDir) {
    mkdirSync(dataDir, { recursive: true });
  }
  pglite = new PGlite(dataDir);
  return drizzlePglite(pglite, { schema });
}

export const db = createDb();

export async function closeDb(): Promise<void> {
  if (pool) await pool.end();
  if (pglite) await pglite.close();
}
