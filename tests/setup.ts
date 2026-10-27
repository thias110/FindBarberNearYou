// Runs before test files are loaded, so the server env is configured before
// `server/src/config/env.ts` is imported.
process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test-secret-with-at-least-32-characters-long";
process.env.PGLITE_DATA_DIR = "";
// Emails capturés en mémoire (`sentEmails()`), quel que soit le `.env` local :
// un `MAIL_TRANSPORT=log` de développement ferait échouer les tests d'emails.
process.env.MAIL_TRANSPORT = "memory";
