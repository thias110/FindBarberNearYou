import { Router } from "express";
import {
  barberSearchQuerySchema,
  bookingSlotsQuerySchema,
} from "@findbarber/shared/validation";
import { validationError } from "../../lib/validation.js";
import { getPublicProfile, searchBarbers } from "./service.js";
import { getBookingSlots } from "../booking/service.js";

export const barbersRouter = Router();

// Recherche publique : lecture seule, aucun garde d'authentification.
// Les paramètres inconnus ou répétés sont rejetés (Zod .strict + z.string()).
barbersRouter.get("/", async (req, res) => {
  const parsed = barberSearchQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    throw validationError(parsed.error);
  }
  res.json(await searchBarbers(parsed.data));
});

// Créneaux publics d'un professionnel (date civile dans SON fuseau).
barbersRouter.get("/:barberId/slots", async (req, res) => {
  const parsed = bookingSlotsQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    throw validationError(parsed.error);
  }
  const slots = await getBookingSlots(
    req.params.barberId as string,
    parsed.data,
  );
  res.json({ slots });
});

// Route publique de détail. `barberId` = barber_profiles.id.
barbersRouter.get("/:barberId", async (req, res) => {
  const result = await getPublicProfile(req.params.barberId);
  res.json(result);
});
