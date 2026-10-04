import { randomUUID } from "node:crypto";
import { Router } from "express";
import { and, asc, eq, sql } from "drizzle-orm";
import { barberPhotos, type BarberPhotoRow } from "@findbarber/shared/schema";
import { LIMITS } from "@findbarber/shared/constants";
import type { OwnBarberPhoto } from "@findbarber/shared/types";
import {
  barberStatsQuerySchema,
  galleryPhotoCreateSchema,
  galleryPhotoParamsSchema,
  profileSchema,
  serviceCreateSchema,
  serviceUpdateSchema,
  timeOffCreateSchema,
  workingHoursSchema,
} from "@findbarber/shared/validation";
import { db } from "../../db/client.js";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { csrfProtection } from "../../middleware/csrf.js";
import { uploadImage } from "../../middleware/upload.js";
import { AppError } from "../../lib/errors.js";
import { toGalleryWebp } from "../../lib/images.js";
import { publicUploadPath, remove, save } from "../../lib/storage.js";
import { validationError } from "../../lib/validation.js";
import {
  createService,
  createTimeOff,
  deleteTimeOff,
  getOwnProfile,
  getWorkingHours,
  listOwnServices,
  listTimeOff,
  replaceWorkingHours,
  updateService,
  upsertProfile,
} from "./service.js";
import { getBarberStats } from "./statsService.js";

export const barberRouter = Router();

function toOwnPhoto(row: BarberPhotoRow): OwnBarberPhoto {
  return {
    id: row.id,
    barberProfileId: row.barberProfileId,
    imagePath: publicUploadPath(row.imagePath),
    caption: row.caption,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

// Statistiques d'activité du barber (issue #20) : lecture seule, réservée au
// BARBER propriétaire. La période est validée ici, le calcul délégué au service.
barberRouter.get(
  "/stats",
  requireAuth,
  requireRole("BARBER"),
  async (req, res) => {
    const parsed = barberStatsQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      throw validationError(parsed.error);
    }
    res.json(await getBarberStats(req.user!.id, parsed.data));
  },
);

barberRouter.get("/profile", requireAuth, requireRole("BARBER"), async (req, res) => {
  const profile = await getOwnProfile(req.user!.id);
  res.json({ profile });
});

barberRouter.put(
  "/profile",
  requireAuth,
  requireRole("BARBER"),
  csrfProtection,
  async (req, res) => {
    const parsed = profileSchema.safeParse(req.body);
    if (!parsed.success) {
      throw validationError(parsed.error);
    }
    const profile = await upsertProfile(req.user!.id, parsed.data);
    res.json({ profile });
  },
);

barberRouter.get("/services", requireAuth, requireRole("BARBER"), async (req, res) => {
  const services = await listOwnServices(req.user!.id);
  res.json({ services });
});

barberRouter.post(
  "/services",
  requireAuth,
  requireRole("BARBER"),
  csrfProtection,
  async (req, res) => {
    const parsed = serviceCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      throw validationError(parsed.error);
    }
    const service = await createService(req.user!.id, parsed.data);
    res.status(201).json({ service });
  },
);

barberRouter.patch(
  "/services/:serviceId",
  requireAuth,
  requireRole("BARBER"),
  csrfProtection,
  async (req, res) => {
    const parsed = serviceUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      throw validationError(parsed.error);
    }
    const service = await updateService(
      req.user!.id,
      req.params.serviceId as string,
      parsed.data,
    );
    res.json({ service });
  },
);

barberRouter.get(
  "/working-hours",
  requireAuth,
  requireRole("BARBER"),
  async (req, res) => {
    const intervals = await getWorkingHours(req.user!.id);
    res.json({ intervals });
  },
);

// Remplacement complet du planning (suppression = `{ "intervals": [] }`).
// Requiert un profil existant (404 sinon).
barberRouter.put(
  "/working-hours",
  requireAuth,
  requireRole("BARBER"),
  csrfProtection,
  async (req, res) => {
    const parsed = workingHoursSchema.safeParse(req.body);
    if (!parsed.success) {
      throw validationError(parsed.error);
    }
    const intervals = await replaceWorkingHours(req.user!.id, parsed.data);
    res.json({ intervals });
  },
);

// --- Indisponibilités / fermetures exceptionnelles (lot 7, issue #22) ---
// Gestion par élément : liste, création, suppression. Pas d'édition (PATCH)
// ni de remplacement global. Le propriétaire est déduit de l'utilisateur
// authentifié ; aucun identifiant de profil n'est accepté dans le payload.
barberRouter.get(
  "/time-off",
  requireAuth,
  requireRole("BARBER"),
  async (req, res) => {
    const timeOff = await listTimeOff(req.user!.id);
    res.json({ timeOff });
  },
);

barberRouter.post(
  "/time-off",
  requireAuth,
  requireRole("BARBER"),
  csrfProtection,
  async (req, res) => {
    const parsed = timeOffCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      throw validationError(parsed.error);
    }
    const timeOff = await createTimeOff(req.user!.id, parsed.data);
    res.status(201).json({ timeOff });
  },
);

barberRouter.delete(
  "/time-off/:timeOffId",
  requireAuth,
  requireRole("BARBER"),
  csrfProtection,
  async (req, res) => {
    await deleteTimeOff(req.user!.id, req.params.timeOffId as string);
    res.status(204).end();
  },
);

// --- Galerie photos (issue #8, lot 1) ---
// Le propriétaire est toujours déduit de `req.user!.id` (jamais d'un identifiant
// fourni). Aucune modération admin ni réordonnancement dans ce lot.
barberRouter.get(
  "/photos",
  requireAuth,
  requireRole("BARBER"),
  async (req, res) => {
    const profile = await getOwnProfile(req.user!.id);
    const rows = await db
      .select()
      .from(barberPhotos)
      .where(eq(barberPhotos.barberProfileId, profile.id))
      .orderBy(asc(barberPhotos.createdAt), asc(barberPhotos.id));
    res.json({ photos: rows.map(toOwnPhoto) });
  },
);

barberRouter.post(
  "/photos",
  requireAuth,
  requireRole("BARBER"),
  csrfProtection,
  uploadImage("image"),
  async (req, res) => {
    if (!req.file) {
      throw new AppError(400, "FILE_REQUIRED", "Image requise.");
    }
    const parsed = galleryPhotoCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      throw validationError(parsed.error);
    }
    const profile = await getOwnProfile(req.user!.id);

    const [countRow] = await db
      .select({ total: sql<number>`count(*)::int` })
      .from(barberPhotos)
      .where(eq(barberPhotos.barberProfileId, profile.id));
    if (Number(countRow?.total ?? 0) >= LIMITS.galleryMaxPhotos) {
      throw new AppError(
        409,
        "GALLERY_LIMIT_REACHED",
        `La galerie est limitée à ${LIMITS.galleryMaxPhotos} photos.`,
      );
    }

    const webp = await toGalleryWebp(req.file.buffer);
    const storedPath = await save(webp, "gallery");

    let row: BarberPhotoRow;
    try {
      [row] = await db
        .insert(barberPhotos)
        .values({
          id: randomUUID(),
          barberProfileId: profile.id,
          imagePath: storedPath,
          caption: parsed.data.caption,
        })
        .returning();
    } catch (err) {
      // Insertion DB échouée : supprimer la photo orpheline sans masquer
      // l'erreur initiale.
      await remove(storedPath).catch(() => {});
      throw err;
    }
    res.status(201).json({ photo: toOwnPhoto(row) });
  },
);

barberRouter.delete(
  "/photos/:photoId",
  requireAuth,
  requireRole("BARBER"),
  csrfProtection,
  async (req, res) => {
    const parsed = galleryPhotoParamsSchema.safeParse(req.params);
    if (!parsed.success) {
      throw validationError(parsed.error);
    }
    const profile = await getOwnProfile(req.user!.id);

    // Filtrage SQL scopé : une photo d'un autre barber est introuvable (404).
    const [row] = await db
      .delete(barberPhotos)
      .where(
        and(
          eq(barberPhotos.id, parsed.data.photoId),
          eq(barberPhotos.barberProfileId, profile.id),
        ),
      )
      .returning();
    if (!row) {
      throw new AppError(404, "PHOTO_NOT_FOUND", "Photo introuvable.");
    }
    await remove(row.imagePath);
    res.status(204).end();
  },
);
