import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { migrateDb } from "./db/migrate.js";
import { startPendingExpirySweeper } from "./modules/booking/expiry.js";
import { startEmailWorker } from "./modules/email/outbox.js";

await migrateDb();
// Persiste l'expiration des demandes PENDING échues (24 h) toutes les 5 min.
startPendingExpirySweeper();
// Envoie la file des emails de réservation et les rappels J-1 (issue #9).
startEmailWorker();
if (env.MAIL_TRANSPORT === "log") {
  console.log("[email] transport « log » : les emails sont affichés, pas envoyés (MAIL_TRANSPORT).");
}

const app = createApp();
app.listen(env.PORT, () => {
  console.log(`[server] listening on http://localhost:${env.PORT} (${env.NODE_ENV})`);
});
