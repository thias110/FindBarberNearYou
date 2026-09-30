import { closeDb } from "../db/client.js";
import { migrateDb } from "../db/migrate.js";

await migrateDb();
await closeDb();
console.log("[migrate] Migrations applied.");
process.exit(0);
