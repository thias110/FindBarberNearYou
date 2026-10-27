import { Router } from "express";
import { placeSuggestQuerySchema } from "@findbarber/shared/validation";
import { validationError } from "../../lib/validation.js";
import { suggestCities } from "./service.js";

export const placesRouter = Router();

// Villes et quartiers pour le champ Ville de la recherche publique (lot N4).
// Lecture seule, sans authentification : limitée en débit (app.ts) et
// validée strictement (2 à 80 caractères, aucun autre paramètre).
placesRouter.get("/suggest", async (req, res) => {
  const parsed = placeSuggestQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    throw validationError(parsed.error);
  }
  const suggestions = await suggestCities(parsed.data.q);
  res.setHeader("Cache-Control", "public, max-age=86400");
  res.json({ suggestions });
});
