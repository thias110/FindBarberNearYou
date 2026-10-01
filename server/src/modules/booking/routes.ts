import { Router } from "express";
import { bookingCreateSchema } from "@findbarber/shared/validation";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { csrfProtection } from "../../middleware/csrf.js";
import { validationError } from "../../lib/validation.js";
import {
  cancelBooking,
  confirmBooking,
  createBooking,
  getBookingDetails,
  listBookings,
} from "./service.js";

export const bookingRouter = Router();

// Création : CLIENT uniquement. Le créneau est recalculé côté serveur.
bookingRouter.post(
  "/",
  requireAuth,
  requireRole("CLIENT"),
  csrfProtection,
  async (req, res) => {
    const parsed = bookingCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      throw validationError(parsed.error);
    }
    const booking = await createBooking(req.user!.id, parsed.data);
    res.status(201).json({ booking });
  },
);

// Liste : le CLIENT voit les siennes, le BARBER celles de son profil.
bookingRouter.get(
  "/",
  requireAuth,
  requireRole("CLIENT", "BARBER"),
  async (req, res) => {
    const bookings = await listBookings({
      id: req.user!.id,
      role: req.user!.role,
    });
    res.json({ bookings });
  },
);

// Détail privé : adresse et coordonnées exactes du client, réservées au CLIENT
// propriétaire, au BARBER concerné et à ADMIN (404 sinon).
bookingRouter.get(
  "/:bookingId",
  requireAuth,
  requireRole("CLIENT", "BARBER", "ADMIN"),
  async (req, res) => {
    const booking = await getBookingDetails(
      { id: req.user!.id, role: req.user!.role },
      req.params.bookingId as string,
    );
    res.json({ booking });
  },
);

// Confirmation : BARBER propriétaire, PENDING → CONFIRMED.
bookingRouter.post(
  "/:bookingId/confirm",
  requireAuth,
  requireRole("BARBER"),
  csrfProtection,
  async (req, res) => {
    const booking = await confirmBooking(
      req.user!.id,
      req.params.bookingId as string,
    );
    res.json({ booking });
  },
);

// Annulation : CLIENT (délai 2 h) ou BARBER (sans délai).
bookingRouter.post(
  "/:bookingId/cancel",
  requireAuth,
  requireRole("CLIENT", "BARBER"),
  csrfProtection,
  async (req, res) => {
    const booking = await cancelBooking(
      { id: req.user!.id, role: req.user!.role },
      req.params.bookingId as string,
    );
    res.json({ booking });
  },
);
