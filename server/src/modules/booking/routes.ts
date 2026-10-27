import { Router } from "express";
import {
  bookingCreateSchema,
  bookingDeclineSchema,
  bookingExpressSchema,
  reviewCreateSchema,
} from "@findbarber/shared/validation";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { csrfProtection } from "../../middleware/csrf.js";
import { validationError } from "../../lib/validation.js";
import { createReview } from "../review/service.js";
import { createExpressBooking, EXPRESS_HOLD_MS } from "./express.js";
import {
  cancelBooking,
  completeBooking,
  confirmBooking,
  createBooking,
  declineBooking,
  getBookingDetails,
  listBookings,
  markBookingNoShow,
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
    // `checkoutUrl` non nul : le client doit payer en ligne (issue #10).
    res.status(201).json(await createBooking(req.user!.id, parsed.data));
  },
);

// Réservation express (lot N6) : visiteur SANS compte. Publique comme
// l'inscription (aucune session, donc aucun CSRF), limitée en débit comme elle
// (app.ts). Le champ masqué `website` piège les robots : rempli, la réponse est
// la même qu'un succès mais rien n'est créé ni envoyé.
bookingRouter.post("/express", async (req, res) => {
  const parsed = bookingExpressSchema.safeParse(req.body);
  if (!parsed.success) {
    throw validationError(parsed.error);
  }
  const { website, ...input } = parsed.data;
  if (website?.trim()) {
    const decoy = new Date(Date.now() + EXPRESS_HOLD_MS);
    res.status(201).json({ expiresAt: decoy.toISOString() });
    return;
  }
  res.status(201).json(await createExpressBooking(input));
});

// Liste : le CLIENT voit les siennes, le BARBER celles de son profil.
bookingRouter.get(
  "/",
  requireAuth,
  requireRole("CLIENT", "BARBER"),
  async (req, res) => {
    const bookings = await listBookings(req.user!);
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
      req.user!,
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
      req.user!,
      req.params.bookingId as string,
    );
    res.json({ booking });
  },
);

// Refus : BARBER propriétaire, PENDING → DECLINED, motif facultatif.
bookingRouter.post(
  "/:bookingId/decline",
  requireAuth,
  requireRole("BARBER"),
  csrfProtection,
  async (req, res) => {
    const parsed = bookingDeclineSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      throw validationError(parsed.error);
    }
    const booking = await declineBooking(
      req.user!,
      req.params.bookingId as string,
      parsed.data.reason ? parsed.data.reason : null,
    );
    res.json({ booking });
  },
);

// Marquage terminé (lot 11) : BARBER propriétaire, CONFIRMED → COMPLETED.
bookingRouter.post(
  "/:bookingId/complete",
  requireAuth,
  requireRole("BARBER"),
  csrfProtection,
  async (req, res) => {
    const booking = await completeBooking(
      req.user!,
      req.params.bookingId as string,
    );
    res.json({ booking });
  },
);

// Absence du client (lot N8) : BARBER propriétaire, CONFIRMED → NO_SHOW,
// après le début du rendez-vous et dans les 48 h (sinon 409 NO_SHOW_WINDOW).
bookingRouter.post(
  "/:bookingId/no-show",
  requireAuth,
  requireRole("BARBER"),
  csrfProtection,
  async (req, res) => {
    const booking = await markBookingNoShow(
      req.user!,
      req.params.bookingId as string,
    );
    res.json({ booking });
  },
);

// Avis post-rendez-vous (lot 11) : CLIENT propriétaire d'une réservation
// COMPLETED. `barberId`/`clientId` sont déduits du booking et de la session.
bookingRouter.post(
  "/:bookingId/review",
  requireAuth,
  requireRole("CLIENT"),
  csrfProtection,
  async (req, res) => {
    const parsed = reviewCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      throw validationError(parsed.error);
    }
    const review = await createReview(
      req.user!,
      req.params.bookingId as string,
      parsed.data,
    );
    res.status(201).json({ review });
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
      req.user!,
      req.params.bookingId as string,
    );
    res.json({ booking });
  },
);
