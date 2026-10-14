import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { migrateDb } from "./db/migrate.js";
import { startPendingExpirySweeper } from "./modules/booking/expiry.js";

await migrateDb();
// Persiste l'expiration des demandes PENDING échues (24 h) toutes les 5 min.
startPendingExpirySweeper();

const app = createApp();
app.listen(env.PORT, () => {
  console.log(`[server] listening on http://localhost:${env.PORT} (${env.NODE_ENV})`);
});
