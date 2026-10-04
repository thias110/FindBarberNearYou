import { z } from "zod";
import { LIMITS } from "../constants";
import { safeText } from "./safeText";

// Métadonnées d'une photo de galerie (issue #8). Le fichier binaire n'est
// jamais validé par Zod : multer applique le filtre MIME / la taille, puis
// `sharp` vérifie qu'il est réellement décodable.
export const galleryPhotoCreateSchema = z
  .object({
    caption: safeText(
      LIMITS.galleryCaption,
      "La légende est trop longue.",
    )
      .nullish()
      .transform((value) =>
        value === undefined || value === null || value.length === 0
          ? null
          : value,
      ),
  })
  .strict();

export type GalleryPhotoCreateInput = z.infer<typeof galleryPhotoCreateSchema>;

// Paramètre de route `:photoId` (suppression). Chaîne unique, bornée.
export const galleryPhotoParamsSchema = z
  .object({
    photoId: z
      .string()
      .trim()
      .min(1, "Identifiant requis.")
      .max(64, "Identifiant trop long."),
  })
  .strict();

export type GalleryPhotoParams = z.infer<typeof galleryPhotoParamsSchema>;

// Paramètre de route `:barberId` de la galerie publique. Même convention que
// les autres identifiants : chaîne unique, trimée, bornée. Une valeur vide ou
// malformée est rejetée AVANT tout accès base (400 VALIDATION_ERROR) ; un
// identifiant bien formé mais inconnu reste un 404 via `getPublicProfile`.
export const publicBarberPhotosParamsSchema = z
  .object({
    barberId: z
      .string()
      .trim()
      .min(1, "Identifiant requis.")
      .max(64, "Identifiant trop long."),
  })
  .strict();

export type PublicBarberPhotosParams = z.infer<
  typeof publicBarberPhotosParamsSchema
>;
