import { Router } from "express";
import { asc, eq } from "drizzle-orm";
import { barberPhotos, type BarberPhotoRow } from "@findbarber/shared/schema";
import type { PublicBarberPhoto } from "@findbarber/shared/types";
import {
  barberSearchQuerySchema,
  bookingSlotsQuerySchema,
  publicBarberPhotosParamsSchema,
  reviewListQuerySchema,
} from "@findbarber/shared/validation";
import { db } from "../../db/client.js";
import { publicUploadPath } from "../../lib/storage.js";
import { validationError } from "../../lib/validation.js";
import { getPublicProfile, searchBarbers } from "./service.js";
import { getBookingSlots } from "../booking/service.js";
import { listBarberReviews } from "../review/service.js";

export const barbersRouter = Router();

function toPublicPhoto(row: BarberPhotoRow): PublicBarberPhoto {
  return {
    id: row.id,
    imagePath: publicUploadPath(row.imagePath),
    caption: row.caption,
    createdAt: row.createdAt.toISOString(),
  };
}

// Recherche publique : lecture seule, aucun garde d'authentification.
// Les paramètres inconnus ou répétés sont rejetés (Zod .strict + z.string()).
barbersRouter.get("/", async (req, res) => {
  const parsed = barberSearchQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    throw validationError(parsed.error);
  }
  res.json(await searchBarbers(parsed.data));
});

// Créneaux publics d'un professionnel (date civile dans SON fuseau).
barbersRouter.get("/:barberId/slots", async (req, res) => {
  const parsed = bookingSlotsQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    throw validationError(parsed.error);
  }
  const slots = await getBookingSlots(
    req.params.barberId as string,
    parsed.data,
  );
  res.json({ slots });
});

// Avis publics d'un professionnel (lot 11) : lecture seule, sans auth,
// paginée. Whitelist stricte (aucune donnée privée ni détail de réservation).
barbersRouter.get("/:barberId/reviews", async (req, res) => {
  const parsed = reviewListQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    throw validationError(parsed.error);
  }
  const result = await listBarberReviews(
    req.params.barberId as string,
    parsed.data,
  );
  res.json(result);
});

// Galerie photos publique (issue #8). `barberId` est validé avant tout accès
// base ; un identifiant bien formé mais inconnu/inactif/non-BARBER reste un 404
// via `getPublicProfile` (même comportement que le détail public).
barbersRouter.get("/:barberId/photos", async (req, res) => {
  const parsed = publicBarberPhotosParamsSchema.safeParse(req.params);
  if (!parsed.success) {
    throw validationError(parsed.error);
  }
  const barberId = parsed.data.barberId;
  await getPublicProfile(barberId);
  const rows = await db
    .select()
    .from(barberPhotos)
    .where(eq(barberPhotos.barberProfileId, barberId))
    .orderBy(asc(barberPhotos.createdAt), asc(barberPhotos.id));
  res.json({ photos: rows.map(toPublicPhoto) });
});

// Route publique de détail. `barberId` = barber_profiles.id.
barbersRouter.get("/:barberId", async (req, res) => {
  const result = await getPublicProfile(req.params.barberId);
  res.json(result);
});
