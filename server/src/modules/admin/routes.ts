import { Router } from "express";
import {
  adminBookingListQuerySchema,
  adminReviewListQuerySchema,
  adminUserListQuerySchema,
  barberStatsQuerySchema,
} from "@findbarber/shared/validation";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { csrfProtection } from "../../middleware/csrf.js";
import { validationError } from "../../lib/validation.js";
import {
  getAdminMetrics,
  hideReview,
  listAdminBookings,
  listAdminReviews,
  listAdminUsers,
  reactivateUser,
  suspendUser,
} from "./service.js";
import { getBarberStatsForAdmin } from "../barber/statsService.js";

export const adminRouter = Router();

// Conservée : c'est la route minimale qui exerce le garde ADMIN dans les tests
// d'authentification existants.
adminRouter.get("/status", requireAuth, requireRole("ADMIN"), (_req, res) => {
  res.json({ ok: true });
});

adminRouter.get("/metrics", requireAuth, requireRole("ADMIN"), async (_req, res) => {
  res.json(await getAdminMetrics());
});

adminRouter.get("/users", requireAuth, requireRole("ADMIN"), async (req, res) => {
  const parsed = adminUserListQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    throw validationError(parsed.error);
  }
  res.json(await listAdminUsers(parsed.data));
});

adminRouter.post(
  "/users/:id/suspend",
  requireAuth,
  requireRole("ADMIN"),
  csrfProtection,
  async (req, res) => {
    res.json({
      user: await suspendUser(req.user!.id, req.params.id as string),
    });
  },
);

adminRouter.post(
  "/users/:id/reactivate",
  requireAuth,
  requireRole("ADMIN"),
  csrfProtection,
  async (req, res) => {
    res.json({ user: await reactivateUser(req.params.id as string) });
  },
);

adminRouter.get(
  "/bookings",
  requireAuth,
  requireRole("ADMIN"),
  async (req, res) => {
    const parsed = adminBookingListQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      throw validationError(parsed.error);
    }
    res.json(await listAdminBookings(parsed.data));
  },
);

adminRouter.get(
  "/reviews",
  requireAuth,
  requireRole("ADMIN"),
  async (req, res) => {
    const parsed = adminReviewListQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      throw validationError(parsed.error);
    }
    res.json(await listAdminReviews(parsed.data));
  },
);

adminRouter.post(
  "/reviews/:id/hide",
  requireAuth,
  requireRole("ADMIN"),
  csrfProtection,
  async (req, res) => {
    res.json({ review: await hideReview(req.params.id as string) });
  },
);

// Statistiques d'un barber ciblé, réutilisant la logique de stats existante.
adminRouter.get(
  "/barbers/:id/stats",
  requireAuth,
  requireRole("ADMIN"),
  async (req, res) => {
    const parsed = barberStatsQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      throw validationError(parsed.error);
    }
    res.json(await getBarberStatsForAdmin(req.params.id as string, parsed.data));
  },
);
