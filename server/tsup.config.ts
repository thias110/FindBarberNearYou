import { cpSync } from "node:fs";
import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  platform: "node",
  target: "node20",
  bundle: true,
  // Bundle the workspace source (it ships raw TS), keep node_modules external.
  noExternal: ["@findbarber/shared"],
  outDir: "dist",
  clean: true,
  sourcemap: false,
  splitting: false,
  onSuccess: async () => {
    cpSync("drizzle", "dist/drizzle", { recursive: true });
  },
});
