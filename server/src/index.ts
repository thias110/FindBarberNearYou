import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { migrateDb } from "./db/migrate.js";

await migrateDb();

const app = createApp();
app.listen(env.PORT, () => {
  console.log(`[server] listening on http://localhost:${env.PORT} (${env.NODE_ENV})`);
});
