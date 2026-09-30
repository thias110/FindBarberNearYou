import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "../shared/src/schema.ts",
  out: "./drizzle",
});
