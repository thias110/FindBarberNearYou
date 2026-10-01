import { Router } from "express";
import {
  profileSchema,
  serviceCreateSchema,
  serviceUpdateSchema,
  timeOffCreateSchema,
  workingHoursSchema,
} from "@findbarber/shared/validation";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { csrfProtection } from "../../middleware/csrf.js";
import { validationError } from "../../lib/validation.js";
import {
  createService,
  createTimeOff,
  deleteTimeOff,
  getOwnProfile,
  getWorkingHours,
  listOwnServices,
  listTimeOff,
  replaceWorkingHours,
  updateService,
  upsertProfile,
} from "./service.js";

export const barberRouter = Router();

barberRouter.get("/profile", requireAuth, requireRole("BARBER"), async (req, res) => {
  const profile = await getOwnProfile(req.user!.id);
  res.json({ profile });
});

barberRouter.put(
  "/profile",
  requireAuth,
  requireRole("BARBER"),
  csrfProtection,
  async (req, res) => {
    const parsed = profileSchema.safeParse(req.body);
    if (!parsed.success) {
      throw validationError(parsed.error);
    }
    const profile = await upsertProfile(req.user!.id, parsed.data);
    res.json({ profile });
  },
);

barberRouter.get("/services", requireAuth, requireRole("BARBER"), async (req, res) => {
  const services = await listOwnServices(req.user!.id);
  res.json({ services });
});

barberRouter.post(
  "/services",
  requireAuth,
  requireRole("BARBER"),
  csrfProtection,
  async (req, res) => {
    const parsed = serviceCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      throw validationError(parsed.error);
    }
    const service = await createService(req.user!.id, parsed.data);
    res.status(201).json({ service });
  },
);

barberRouter.patch(
  "/services/:serviceId",
  requireAuth,
  requireRole("BARBER"),
  csrfProtection,
  async (req, res) => {
    const parsed = serviceUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      throw validationError(parsed.error);
    }
    const service = await updateService(
      req.user!.id,
      req.params.serviceId as string,
      parsed.data,
    );
    res.json({ service });
  },
);

barberRouter.get(
  "/working-hours",
  requireAuth,
  requireRole("BARBER"),
  async (req, res) => {
    const intervals = await getWorkingHours(req.user!.id);
    res.json({ intervals });
  },
);

// Remplacement complet du planning (suppression = `{ "intervals": [] }`).
// Requiert un profil existant (404 sinon).
barberRouter.put(
  "/working-hours",
  requireAuth,
  requireRole("BARBER"),
  csrfProtection,
  async (req, res) => {
    const parsed = workingHoursSchema.safeParse(req.body);
    if (!parsed.success) {
      throw validationError(parsed.error);
    }
    const intervals = await replaceWorkingHours(req.user!.id, parsed.data);
    res.json({ intervals });
  },
);

// --- Indisponibilités / fermetures exceptionnelles (lot 7, issue #22) ---
// Gestion par élément : liste, création, suppression. Pas d'édition (PATCH)
// ni de remplacement global. Le propriétaire est déduit de l'utilisateur
// authentifié ; aucun identifiant de profil n'est accepté dans le payload.
barberRouter.get(
  "/time-off",
  requireAuth,
  requireRole("BARBER"),
  async (req, res) => {
    const timeOff = await listTimeOff(req.user!.id);
    res.json({ timeOff });
  },
);

barberRouter.post(
  "/time-off",
  requireAuth,
  requireRole("BARBER"),
  csrfProtection,
  async (req, res) => {
    const parsed = timeOffCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      throw validationError(parsed.error);
    }
    const timeOff = await createTimeOff(req.user!.id, parsed.data);
    res.status(201).json({ timeOff });
  },
);

barberRouter.delete(
  "/time-off/:timeOffId",
  requireAuth,
  requireRole("BARBER"),
  csrfProtection,
  async (req, res) => {
    await deleteTimeOff(req.user!.id, req.params.timeOffId as string);
    res.status(204).end();
  },
);
