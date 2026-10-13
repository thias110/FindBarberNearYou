import { Router } from "express";
import { notificationListQuerySchema } from "@findbarber/shared/validation";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { csrfProtection } from "../../middleware/csrf.js";
import { validationError } from "../../lib/validation.js";
import {
  listNotifications,
  markAllRead,
  markRead,
  unreadCount,
} from "./service.js";

export const notificationRouter = Router();

// Toutes les lectures/mutations sont scopées à `req.user.id` dans le service :
// impossible de lire ou modifier les notifications d'autrui (404 si non possédé).
notificationRouter.get(
  "/",
  requireAuth,
  requireRole("CLIENT", "BARBER"),
  async (req, res) => {
    const parsed = notificationListQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      throw validationError(parsed.error);
    }
    res.json({
      notifications: await listNotifications(req.user!.id, parsed.data.limit),
    });
  },
);

notificationRouter.get(
  "/unread-count",
  requireAuth,
  requireRole("CLIENT", "BARBER"),
  async (req, res) => {
    res.json({ count: await unreadCount(req.user!.id) });
  },
);

notificationRouter.post(
  "/:id/read",
  requireAuth,
  requireRole("CLIENT", "BARBER"),
  csrfProtection,
  async (req, res) => {
    await markRead(req.user!.id, req.params.id as string);
    res.status(204).end();
  },
);

notificationRouter.post(
  "/read-all",
  requireAuth,
  requireRole("CLIENT", "BARBER"),
  csrfProtection,
  async (req, res) => {
    await markAllRead(req.user!.id);
    res.status(204).end();
  },
);
