import { Router } from "express";
import { requireAuth } from "../../middleware/auth.js";
import { csrfProtection } from "../../middleware/csrf.js";
import { uploadImage } from "../../middleware/upload.js";
import { AppError } from "../../lib/errors.js";
import { toPublicUser } from "../auth/service.js";
import { deleteAvatar, updateAvatar } from "./service.js";

export const userRouter = Router();

// Avatar : toute personne authentifiée. Ordre imposé :
// requireAuth -> csrfProtection -> upload -> handler. Le CSRF est donc vérifié
// AVANT que multer ne parse le multipart.
userRouter.put(
  "/me/avatar",
  requireAuth,
  csrfProtection,
  uploadImage("image"),
  async (req, res) => {
    if (!req.file) {
      throw new AppError(400, "FILE_REQUIRED", "Image requise.");
    }
    const user = await updateAvatar(req.user!.id, req.file.buffer);
    res.json({ user: toPublicUser(user) });
  },
);

userRouter.delete(
  "/me/avatar",
  requireAuth,
  csrfProtection,
  async (req, res) => {
    const user = await deleteAvatar(req.user!.id);
    res.json({ user: toPublicUser(user) });
  },
);
