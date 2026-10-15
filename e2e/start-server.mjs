// Serveur des tests E2E : base PGlite de démo NEUVE (seed Genève), puis API,
// puis client Vite une fois l'API prête. Lancé par Playwright (webServer).
import { spawn } from "node:child_process";
import { rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dataDir = path.join(root, "data", "e2e");
rmSync(dataDir, { recursive: true, force: true });

const env = {
  ...process.env,
  NODE_ENV: "development",
  DB_DRIVER: "pglite",
  PGLITE_DATA_DIR: path.join(dataDir, "pglite"),
  UPLOAD_DIR: path.join(dataDir, "uploads"),
  // Secret factice réservé aux tests E2E (jamais utilisé hors de cette base).
  JWT_SECRET: "e2e-only-not-a-secret-0123456789abcdef",
  CORS_ORIGIN: "http://localhost:5173",
  FRONTEND_URL: "http://localhost:5173",
  VITE_API_URL: "http://localhost:4000",
  // Les parcours se connectent souvent depuis la même IP.
  LOGIN_RATE_LIMIT_MAX: "1000",
  REGISTER_RATE_LIMIT_MAX: "1000",
  MUTATION_RATE_LIMIT_MAX: "1000",
  // Footer et mentions légales (#58, #59) : un seul réseau configuré, pour
  // vérifier que les autres n'apparaissent pas.
  SUPPORT_EMAIL: "support@demo.ch",
  SOCIAL_INSTAGRAM_URL: "https://www.instagram.com/findbarber.demo",
  SOCIAL_FACEBOOK_URL: "",
  SOCIAL_TIKTOK_URL: "",
  SOCIAL_LINKEDIN_URL: "",
  LEGAL_OPERATOR_NAME: "FindBarber Démo",
  LEGAL_OPERATOR_ADDRESS: "",
};

const children = [];
function run(args, cwd = root) {
  const child = spawn("npm", args, { cwd, env, stdio: "inherit" });
  children.push(child);
  return child;
}
function stopAll() {
  for (const child of children) child.kill("SIGTERM");
}
process.on("SIGTERM", () => {
  stopAll();
  process.exit(0);
});
process.on("SIGINT", () => {
  stopAll();
  process.exit(0);
});

await new Promise((resolve, reject) => {
  run(["run", "seed:demo"]).on("exit", (code) =>
    code === 0 ? resolve() : reject(new Error(`seed exit ${code}`)),
  );
});

run(["run", "dev:server"]);
for (let i = 0; i < 120; i += 1) {
  try {
    const res = await fetch("http://localhost:4000/api/health");
    if (res.ok) break;
  } catch {
    // API pas encore prête.
  }
  await new Promise((r) => setTimeout(r, 500));
}
run(["run", "dev:client"]);
