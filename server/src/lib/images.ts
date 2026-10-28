import sharp, { type ResizeOptions } from "sharp";
import { LIMITS } from "@findbarber/shared/constants";
import { AppError } from "./errors.js";

// Traitement d'image (issue #8). `sharp` vérifie implicitement que le buffer est
// une image décodable ; `.rotate()` applique l'orientation EXIF puis la retire.
// Les métadonnées ne sont PAS conservées (sharp les supprime par défaut, on
// n'appelle jamais `withMetadata`). Sortie WebP.
// Le format est lu dans le contenu (jamais le type annoncé par le navigateur) :
// seuls JPEG, PNG et WebP sont décodés, ce qui écarte SVG, TIFF et les autres
// décodeurs natifs. La taille en pixels est bornée avant décodage, contre les
// « bombes » de décompression (petit fichier, image géante en mémoire).

const ACCEPTED_FORMATS = new Set(["jpeg", "png", "webp"]);

async function toWebp(
  buffer: Buffer,
  resize: ResizeOptions,
): Promise<Buffer> {
  const options = { limitInputPixels: LIMITS.imageMaxInputPixels, failOn: "error" as const };
  try {
    const { format } = await sharp(buffer, options).metadata();
    if (!format || !ACCEPTED_FORMATS.has(format)) throw new Error("format refusé");
    return await sharp(buffer, options)
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
