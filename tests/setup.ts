// Runs before test files are loaded, so the server env is configured before
// `server/src/config/env.ts` is imported.
process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test-secret-with-at-least-32-characters-long";
process.env.PGLITE_DATA_DIR = "";
