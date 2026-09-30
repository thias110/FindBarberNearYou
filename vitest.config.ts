import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/src/**/*.test.ts"],
    setupFiles: ["./tests/setup.ts"],
    hookTimeout: 30000,
    testTimeout: 30000,
  },
});
