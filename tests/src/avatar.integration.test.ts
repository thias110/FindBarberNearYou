import { randomUUID } from "node:crypto";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import bcrypt from "bcryptjs";
import sharp from "sharp";
import { eq } from "drizzle-orm";
import { users } from "@findbarber/shared/schema";

// Dossier d'upload temporaire AVANT d'importer le serveur : `env.UPLOAD_DIR`
// est lu au chargement de `server/src/config/env.ts`.
const uploadDir = mkdtempSync(join(tmpdir(), "findbarber-avatar-"));
process.env.UPLOAD_DIR = uploadDir;

const { createApp } = await import("../../server/src/app");
const { db } = await import("../../server/src/db/client");
const { migrateDb } = await import("../../server/src/db/migrate");

const app = createApp();
const PASSWORD = "password123";

beforeAll(async () => {
  await migrateDb();
});

beforeEach(async () => {
  await db.delete(users);
});

const RETRYABLE_RM_CODES = new Set(["EPERM", "EBUSY", "ENOTEMPTY"]);

// Windows garde parfois un handle transitoire sur le dossier temporaire
// (antivirus, indexeur, cache sharp) : on retente quelques fois sur
// EPERM/EBUSY/ENOTEMPTY, puis on abandonne sans faire échouer la suite.
async function removeUploadDir(dir: string): Promise<void> {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    try {
      rmSync(dir, { recursive: true, force: true });
      return;
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code;
      const retryable = code !== undefined && RETRYABLE_RM_CODES.has(code);
      if (!retryable || attempt === 9) {
        console.warn(
          `[test] Nettoyage de ${dir} impossible (${code ?? "inconnu"}), ignoré.`,
        );
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 50 * (attempt + 1)));
    }
  }
}

afterAll(async () => {
  await removeUploadDir(uploadDir);
});

async function createUser(email: string): Promise<{ id: string }> {
  const passwordHash = await bcrypt.hash(PASSWORD, 12);
  const [row] = await db
    .insert(users)
    .values({
      id: randomUUID(),
      email,
      passwordHash,
      role: "CLIENT",
      status: "ACTIVE",
      emailVerifiedAt: new Date(),
    })
    .returning({ id: users.id });
  return row;
}

async function login(email: string) {
  const agent = request.agent(app);
  const res = await agent
    .post("/api/auth/login")
    .send({ email, password: PASSWORD });
  expect(res.status).toBe(200);
  return { agent, csrf: res.body.csrfToken as string };
}

function pngBuffer(width = 40, height = 40): Promise<Buffer> {
  return sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 200, g: 40, b: 40 },
    },
  })
    .png()
    .toBuffer();
}

describe("PUT /api/users/me/avatar", () => {
  it("téléverse un avatar, le réencode en WebP et met à jour users.avatarPath", async () => {
    const user = await createUser("avatar@example.com");
    const { agent, csrf } = await login("avatar@example.com");

    const res = await agent
      .put("/api/users/me/avatar")
      .set("X-CSRF-Token", csrf)
      .attach("image", await pngBuffer(), "photo.png");

    expect(res.status).toBe(200);
    expect(res.body.user.avatarPath).toMatch(
      /^\/uploads\/avatars\/[0-9a-f-]+\.webp$/,
    );

    const [row] = await db.select().from(users).where(eq(users.id, user.id));
    expect(row.avatarPath).toMatch(/^avatars\/[0-9a-f-]+\.webp$/);
    expect(existsSync(join(uploadDir, row.avatarPath as string))).toBe(true);

    // Le fichier stocké est bien un WebP décodable.
    const metadata = await sharp(
      join(uploadDir, row.avatarPath as string),
    ).metadata();
    expect(metadata.format).toBe("webp");
  });

  // Issue #55 : la session (GET /api/auth/me) expose la photo, pour qu'elle
  // reste affichée après un rechargement de page.
  it("expose l'avatar dans GET /api/auth/me", async () => {
    await createUser("me@example.com");
    const { agent, csrf } = await login("me@example.com");
    expect((await agent.get("/api/auth/me")).body.user.avatarPath).toBeNull();

    const put = await agent
      .put("/api/users/me/avatar")
      .set("X-CSRF-Token", csrf)
      .attach("image", await pngBuffer(), "photo.png");
    const me = await agent.get("/api/auth/me");
    expect(me.status).toBe(200);
    expect(me.body.user.avatarPath).toBe(put.body.user.avatarPath);
    expect(me.body.user).not.toHaveProperty("passwordHash");
  });

  it("remplace l'ancien avatar et supprime le fichier précédent", async () => {
    const user = await createUser("replace@example.com");
    const { agent, csrf } = await login("replace@example.com");

    await agent
      .put("/api/users/me/avatar")
      .set("X-CSRF-Token", csrf)
      .attach("image", await pngBuffer(), "first.png");
    const [first] = await db.select().from(users).where(eq(users.id, user.id));
    const firstPath = first.avatarPath as string;
    expect(existsSync(join(uploadDir, firstPath))).toBe(true);

    const res = await agent
      .put("/api/users/me/avatar")
      .set("X-CSRF-Token", csrf)
      .attach("image", await pngBuffer(80, 80), "second.png");
    expect(res.status).toBe(200);

    const [second] = await db.select().from(users).where(eq(users.id, user.id));
    expect(second.avatarPath).not.toBe(firstPath);
    expect(existsSync(join(uploadDir, firstPath))).toBe(false);
  });

  it("refuse un upload sans jeton CSRF (403)", async () => {
    await createUser("csrf@example.com");
    const { agent } = await login("csrf@example.com");

    const res = await agent
      .put("/api/users/me/avatar")
      .attach("image", await pngBuffer(), "photo.png");

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("CSRF_INVALID");
  });

  it("refuse sans authentification (401)", async () => {
    const res = await request(app)
      .put("/api/users/me/avatar")
      .attach("image", await pngBuffer(), "photo.png");
    expect(res.status).toBe(401);
  });

  it("refuse un type de fichier non autorisé (400)", async () => {
    await createUser("type@example.com");
    const { agent, csrf } = await login("type@example.com");

    const res = await agent
      .put("/api/users/me/avatar")
      .set("X-CSRF-Token", csrf)
      .attach("image", Buffer.from("pas une image"), {
        filename: "note.txt",
        contentType: "text/plain",
      });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("INVALID_FILE_TYPE");
  });

  it("refuse un contenu non décodable malgré un MIME valide (400)", async () => {
    await createUser("decode@example.com");
    const { agent, csrf } = await login("decode@example.com");

    const res = await agent
      .put("/api/users/me/avatar")
      .set("X-CSRF-Token", csrf)
      .attach("image", Buffer.from("fausse image png"), {
        filename: "fake.png",
        contentType: "image/png",
      });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("INVALID_IMAGE");
  });

  it("refuse un fichier de plus de 5 Mo (413)", async () => {
    await createUser("big@example.com");
    const { agent, csrf } = await login("big@example.com");

    const tooLarge = Buffer.alloc(5_242_881, 1);
    const res = await agent
      .put("/api/users/me/avatar")
      .set("X-CSRF-Token", csrf)
      .attach("image", tooLarge, {
        filename: "big.png",
        contentType: "image/png",
      });

    expect(res.status).toBe(413);
    expect(res.body.error.code).toBe("FILE_TOO_LARGE");
  });
});

describe("DELETE /api/users/me/avatar", () => {
  it("supprime l'avatar, efface la colonne et retire le fichier", async () => {
    const user = await createUser("delete@example.com");
    const { agent, csrf } = await login("delete@example.com");

    await agent
      .put("/api/users/me/avatar")
      .set("X-CSRF-Token", csrf)
      .attach("image", await pngBuffer(), "photo.png");
    const [before] = await db.select().from(users).where(eq(users.id, user.id));
    const storedPath = before.avatarPath as string;

    const res = await agent
      .delete("/api/users/me/avatar")
      .set("X-CSRF-Token", csrf);

    expect(res.status).toBe(200);
    expect(res.body.user.avatarPath).toBeNull();

    const [after] = await db.select().from(users).where(eq(users.id, user.id));
    expect(after.avatarPath).toBeNull();
    expect(existsSync(join(uploadDir, storedPath))).toBe(false);
  });

  it("reste idempotent sans avatar existant", async () => {
    await createUser("noavatar@example.com");
    const { agent, csrf } = await login("noavatar@example.com");

    const res = await agent
      .delete("/api/users/me/avatar")
      .set("X-CSRF-Token", csrf);
    expect(res.status).toBe(200);
    expect(res.body.user.avatarPath).toBeNull();
  });
});

// Issue #55 : la photo n'est modifiable que par son titulaire. L'API ne prend
// aucun identifiant : elle agit toujours sur l'utilisateur de la session.
describe("isolation entre utilisateurs", () => {
  it("un client B ne peut ni remplacer ni supprimer la photo d'un client A", async () => {
    const a = await createUser("owner-a@example.com");
    const b = await createUser("other-b@example.com");
    const sessionA = await login("owner-a@example.com");
    await sessionA.agent
      .put("/api/users/me/avatar")
      .set("X-CSRF-Token", sessionA.csrf)
      .attach("image", await pngBuffer(), "photo.png");
    const [beforeA] = await db.select().from(users).where(eq(users.id, a.id));
    const pathA = beforeA.avatarPath as string;

    const sessionB = await login("other-b@example.com");
    // Un identifiant glissé dans l'URL ou le corps est ignoré.
    const put = await sessionB.agent
      .put(`/api/users/me/avatar?userId=${a.id}`)
      .set("X-CSRF-Token", sessionB.csrf)
      .field("userId", a.id)
      .attach("image", await pngBuffer(20, 20), "autre.png");
    expect(put.status).toBe(200);
    expect(put.body.user.id).toBe(b.id);

    const del = await sessionB.agent
      .delete(`/api/users/me/avatar?userId=${a.id}`)
      .set("X-CSRF-Token", sessionB.csrf)
      .send({ userId: a.id });
    expect(del.status).toBe(200);
    expect(del.body.user.id).toBe(b.id);

    const [afterA] = await db.select().from(users).where(eq(users.id, a.id));
    expect(afterA.avatarPath).toBe(pathA);
    expect(existsSync(join(uploadDir, pathA))).toBe(true);
  });

  // Le jeton CSRF de B ne vaut pas pour la session de A.
  it("refuse une session A accompagnée du jeton CSRF de B (403)", async () => {
    await createUser("csrf-a@example.com");
    await createUser("csrf-b@example.com");
    const sessionA = await login("csrf-a@example.com");
    const sessionB = await login("csrf-b@example.com");

    const res = await sessionA.agent
      .delete("/api/users/me/avatar")
      .set("X-CSRF-Token", sessionB.csrf);
    expect(res.status).toBe(403);
  });
});
