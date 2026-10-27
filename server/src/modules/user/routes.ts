import { Router } from "express";
import {
  deleteAccountSchema,
  favoriteParamsSchema,
  localeUpdateSchema,
} from "@findbarber/shared/validation";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { csrfProtection } from "../../middleware/csrf.js";
import { uploadImage } from "../../middleware/upload.js";
import { AppError } from "../../lib/errors.js";
import { toPublicUser } from "../auth/service.js";
import { deleteAvatar, updateAvatar, updateLocale } from "./service.js";
import { AUTH_COOKIE, CSRF_COOKIE } from "../../lib/cookies.js";
import { validationError } from "../../lib/validation.js";
import { deleteOwnAccount, exportPersonalData } from "../privacy/service.js";
import {
  addFavorite,
  listFavorites,
  removeFavorite,
} from "../favorites/service.js";

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

// Langue de l'interface et des emails (issue #32) : uniquement celle du
// titulaire de la session, valeurs fr/en/it/es.
userRouter.patch("/me/locale", requireAuth, csrfProtection, async (req, res) => {
  const parsed = localeUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    throw validationError(parsed.error);
  }
  const user = await updateLocale(req.user!.id, parsed.data.locale);
  res.json({ user: toPublicUser(user) });
});

// --- Favoris (lot N5) : CLIENT uniquement, écritures protégées par le CSRF ---

userRouter.get(
  "/me/favorites",
  requireAuth,
  requireRole("CLIENT"),
  async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    res.json(await listFavorites(req.user!.id));
  },
);

userRouter.put(
  "/me/favorites/:barberId",
  requireAuth,
  requireRole("CLIENT"),
  csrfProtection,
  async (req, res) => {
    const parsed = favoriteParamsSchema.safeParse(req.params);
    if (!parsed.success) {
      throw validationError(parsed.error);
    }
    await addFavorite(req.user!.id, parsed.data.barberId);
    res.status(204).end();
  },
);

userRouter.delete(
  "/me/favorites/:barberId",
  requireAuth,
  requireRole("CLIENT"),
  csrfProtection,
  async (req, res) => {
    const parsed = favoriteParamsSchema.safeParse(req.params);
    if (!parsed.success) {
      throw validationError(parsed.error);
    }
    await removeFavorite(req.user!.id, parsed.data.barberId);
    res.status(204).end();
  },
);

// --- Données personnelles (issue #14) ---

// Export JSON (accès + portabilité), téléchargé en pièce jointe. Lecture seule.
userRouter.get("/me/export", requireAuth, async (req, res) => {
  const data = await exportPersonalData(req.user!.id);
  const day = new Date().toISOString().slice(0, 10);
  res.setHeader("Cache-Control", "no-store");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="findbarber-mes-donnees-${day}.json"`,
  );
  res.json(data);
});

// Suppression du compte, confirmée par le mot de passe. Anonymisation
// irréversible ; la session courante est effacée (les autres sont révoquées).
userRouter.delete("/me", requireAuth, csrfProtection, async (req, res) => {
  const parsed = deleteAccountSchema.safeParse(req.body);
  if (!parsed.success) {
    throw validationError(parsed.error);
  }
  await deleteOwnAccount(req.user!.id, parsed.data.password);
  res.clearCookie(AUTH_COOKIE, { path: "/" });
  res.clearCookie(CSRF_COOKIE, { path: "/" });
  res.status(204).end();
});
