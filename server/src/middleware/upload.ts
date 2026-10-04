import type { RequestHandler } from "express";
import multer from "multer";
import {
  LIMITS,
  UPLOAD_IMAGE_MIME_TYPES,
} from "@findbarber/shared/constants";
import { AppError } from "../lib/errors.js";

// Upload en mémoire uniquement (jamais d'écriture directe du fichier client sur
// le disque) : le buffer est ensuite réencodé par `sharp`. Le nom de fichier
// fourni par le client est ignoré.
const ACCEPTED_MIME_TYPES = new Set<string>(UPLOAD_IMAGE_MIME_TYPES);

const memoryUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: LIMITS.uploadMaxBytes, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (!ACCEPTED_MIME_TYPES.has(file.mimetype)) {
      cb(
        new AppError(
          400,
          "INVALID_FILE_TYPE",
          "Format accepté : JPEG, PNG ou WebP.",
        ),
      );
      return;
    }
    cb(null, true);
  },
});

/** Middleware d'upload d'une image unique (champ `image` par défaut). */
export function uploadImage(fieldName = "image"): RequestHandler {
  return (req, res, next) => {
    memoryUpload.single(fieldName)(req, res, (err: unknown) => {
      if (!err) {
        next();
        return;
      }
      if (err instanceof AppError) {
        next(err);
        return;
      }
      if (err instanceof multer.MulterError) {
        if (err.code === "LIMIT_FILE_SIZE") {
          next(
            new AppError(
              413,
              "FILE_TOO_LARGE",
              `Image trop volumineuse (${Math.round(
                LIMITS.uploadMaxBytes / 1_048_576,
              )} Mo maximum).`,
            ),
          );
          return;
        }
        next(new AppError(400, "UPLOAD_ERROR", err.message));
        return;
      }
      next(err);
    });
  };
}
