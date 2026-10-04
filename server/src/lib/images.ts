import sharp from "sharp";
import { LIMITS } from "@findbarber/shared/constants";
import { AppError } from "./errors.js";

// Traitement d'image (issue #8). `sharp` vérifie implicitement que le buffer est
// une image décodable ; `.rotate()` applique l'orientation EXIF puis la retire.
// Les métadonnées ne sont PAS conservées (sharp les supprime par défaut, on
// n'appelle jamais `withMetadata`). Sortie WebP.

async function toWebp(
  buffer: Buffer,
  resize: sharp.ResizeOptions,
): Promise<Buffer> {
  try {
    return await sharp(buffer)
      .rotate()
      .resize(resize)
      .webp({ quality: 82 })
      .toBuffer();
  } catch {
    throw new AppError(400, "INVALID_IMAGE", "Fichier image illisible.");
  }
}

/** Avatar carré 512x512 (crop cover), WebP sans métadonnées. */
export function toAvatarWebp(buffer: Buffer): Promise<Buffer> {
  return toWebp(buffer, {
    width: LIMITS.avatarSizePx,
    height: LIMITS.avatarSizePx,
    fit: "cover",
  });
}

/** Galerie : largeur max 1600px, ratio conservé, sans agrandissement. */
export function toGalleryWebp(buffer: Buffer): Promise<Buffer> {
  return toWebp(buffer, {
    width: LIMITS.galleryMaxWidthPx,
    withoutEnlargement: true,
  });
}
