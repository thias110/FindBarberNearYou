import { randomUUID } from "node:crypto";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import bcrypt from "bcryptjs";
import sharp from "sharp";
import { eq } from "drizzle-orm";
import {
  barberPhotos,
  barberProfiles,
  users,
} from "@findbarber/shared/schema";

// Dossier d'upload temporaire AVANT d'importer le serveur (voir env.ts).
const uploadDir = mkdtempSync(join(tmpdir(), "findbarber-gallery-"));
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
  await db.delete(barberPhotos);
  await db.delete(barberProfiles);
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

async function createUser(
  email: string,
  role: "CLIENT" | "BARBER" | "ADMIN",
): Promise<{ id: string }> {
  const passwordHash = await bcrypt.hash(PASSWORD, 12);
  const [row] = await db
    .insert(users)
    .values({ id: randomUUID(), email, passwordHash, role, status: "ACTIVE" })
    .returning({ id: users.id });
  return row;
}

async function seedBarber(email: string) {
  const user = await createUser(email, "BARBER");
  const profileId = randomUUID();
  await db.insert(barberProfiles).values({
    id: profileId,
    userId: user.id,
    displayName: "Barbier Galerie",
    description: "Coupes soignées",
    city: "Genève",
    countryCode: "CH",
    latitude: 46.2044,
    longitude: 6.1432,
    currency: "CHF",
  });
  return { userId: user.id, profileId };
}

async function login(email: string) {
  const agent = request.agent(app);
  const res = await agent
    .post("/api/auth/login")
    .send({ email, password: PASSWORD });
  expect(res.status).toBe(200);
  return { agent, csrf: res.body.csrfToken as string };
}

function pngBuffer(width = 60, height = 40): Promise<Buffer> {
  return sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 20, g: 120, b: 200 },
    },
  })
    .png()
    .toBuffer();
}

describe("POST /api/barber/photos", () => {
  it("ajoute une photo et l'expose dans la galerie du barber", async () => {
    const barber = await seedBarber("barber@example.com");
    const { agent, csrf } = await login("barber@example.com");

    const created = await agent
      .post("/api/barber/photos")
      .set("X-CSRF-Token", csrf)
      .field("caption", "Ma coupe")
      .attach("image", await pngBuffer(), "photo.png");

    expect(created.status).toBe(201);
    expect(created.body.photo.imagePath).toMatch(
      /^\/uploads\/gallery\/[0-9a-f-]+\.webp$/,
    );
    expect(created.body.photo.caption).toBe("Ma coupe");
    expect(created.body.photo.barberProfileId).toBe(barber.profileId);

    const rows = await db
      .select()
      .from(barberPhotos)
      .where(eq(barberPhotos.barberProfileId, barber.profileId));
    expect(rows).toHaveLength(1);
    expect(existsSync(join(uploadDir, rows[0].imagePath))).toBe(true);

    const list = await agent.get("/api/barber/photos");
    expect(list.status).toBe(200);
    expect(list.body.photos).toHaveLength(1);
    expect(list.body.photos[0].id).toBe(created.body.photo.id);
  });

  it("refuse une photo sans CSRF (403) et pour un CLIENT (403)", async () => {
    await seedBarber("barber@example.com");
    const barber = await login("barber@example.com");

    const noCsrf = await barber.agent
      .post("/api/barber/photos")
      .attach("image", await pngBuffer(), "photo.png");
    expect(noCsrf.status).toBe(403);
    expect(noCsrf.body.error.code).toBe("CSRF_INVALID");

    await createUser("client@example.com", "CLIENT");
    const client = await login("client@example.com");
    const asClient = await client.agent
      .post("/api/barber/photos")
      .set("X-CSRF-Token", client.csrf)
      .attach("image", await pngBuffer(), "photo.png");
    expect(asClient.status).toBe(403);
    expect(asClient.body.error.code).toBe("FORBIDDEN");
  });

  it("refuse au-delà de LIMITS.galleryMaxPhotos (409)", async () => {
    const barber = await seedBarber("limit@example.com");
    const { agent, csrf } = await login("limit@example.com");

    // 14 lignes directes + 1 upload API = 15 (limite atteinte).
    for (let index = 0; index < 14; index += 1) {
      await db.insert(barberPhotos).values({
        id: randomUUID(),
        barberProfileId: barber.profileId,
        imagePath: `gallery/fake-${index}.webp`,
        caption: null,
      });
    }

    const fifteenth = await agent
      .post("/api/barber/photos")
      .set("X-CSRF-Token", csrf)
      .attach("image", await pngBuffer(), "photo.png");
    expect(fifteenth.status).toBe(201);

    const blocked = await agent
      .post("/api/barber/photos")
      .set("X-CSRF-Token", csrf)
      .attach("image", await pngBuffer(), "photo.png");
    expect(blocked.status).toBe(409);
    expect(blocked.body.error.code).toBe("GALLERY_LIMIT_REACHED");
  });
});

describe("DELETE /api/barber/photos/:photoId", () => {
  it("supprime uniquement une photo du barber connecté", async () => {
    const owner = await seedBarber("owner@example.com");
    await seedBarber("other@example.com");
    const ownerSession = await login("owner@example.com");
    const otherSession = await login("other@example.com");

    const created = await ownerSession.agent
      .post("/api/barber/photos")
      .set("X-CSRF-Token", ownerSession.csrf)
      .attach("image", await pngBuffer(), "photo.png");
    const photoId = created.body.photo.id as string;

    const [row] = await db
      .select()
      .from(barberPhotos)
      .where(eq(barberPhotos.id, photoId));
    expect(row.barberProfileId).toBe(owner.profileId);
    expect(existsSync(join(uploadDir, row.imagePath))).toBe(true);

    // Un autre barber obtient 404 (aucune fuite d'existence).
    const forbidden = await otherSession.agent
      .delete(`/api/barber/photos/${photoId}`)
      .set("X-CSRF-Token", otherSession.csrf);
    expect(forbidden.status).toBe(404);
    expect(forbidden.body.error.code).toBe("PHOTO_NOT_FOUND");

    // Le propriétaire supprime : ligne + fichier retirés.
    const deleted = await ownerSession.agent
      .delete(`/api/barber/photos/${photoId}`)
      .set("X-CSRF-Token", ownerSession.csrf);
    expect(deleted.status).toBe(204);

    const remaining = await db
      .select()
      .from(barberPhotos)
      .where(eq(barberPhotos.id, photoId));
    expect(remaining).toHaveLength(0);
    expect(existsSync(join(uploadDir, row.imagePath))).toBe(false);
  });

  it("renvoie 404 pour une photo inconnue", async () => {
    await seedBarber("unknown@example.com");
    const { agent, csrf } = await login("unknown@example.com");

    const res = await agent
      .delete(`/api/barber/photos/${randomUUID()}`)
      .set("X-CSRF-Token", csrf);
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("PHOTO_NOT_FOUND");
  });
});

describe("GET /api/barbers/:barberId/photos (public)", () => {
  it("expose la galerie d'un barber actif sans authentification", async () => {
    const barber = await seedBarber("public@example.com");
    const { agent, csrf } = await login("public@example.com");
    await agent
      .post("/api/barber/photos")
      .set("X-CSRF-Token", csrf)
      .field("caption", "Salon")
      .attach("image", await pngBuffer(), "photo.png");

    const res = await request(app).get(
      `/api/barbers/${barber.profileId}/photos`,
    );
    expect(res.status).toBe(200);
    expect(res.body.photos).toHaveLength(1);
    expect(res.body.photos[0].imagePath).toMatch(/^\/uploads\/gallery\//);
    expect(res.body.photos[0].caption).toBe("Salon");
    expect(res.body.photos[0]).not.toHaveProperty("barberProfileId");
  });

  it("renvoie 404 pour un barber inconnu ou suspendu", async () => {
    const unknown = await request(app).get(
      `/api/barbers/${randomUUID()}/photos`,
    );
    expect(unknown.status).toBe(404);
    expect(unknown.body.error.code).toBe("BARBER_PROFILE_NOT_FOUND");

    const suspended = await seedBarber("suspended@example.com");
    await db
      .update(users)
      .set({ status: "SUSPENDED" })
      .where(eq(users.id, suspended.userId));

    const res = await request(app).get(
      `/api/barbers/${suspended.profileId}/photos`,
    );
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("BARBER_PROFILE_NOT_FOUND");
  });
});
