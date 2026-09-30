import { Router } from "express";
import { getPublicProfile } from "./service.js";

export const barbersRouter = Router();

// Route publique : aucun garde d'authentification. `barberId` = barber_profiles.id.
barbersRouter.get("/:barberId", async (req, res) => {
  const result = await getPublicProfile(req.params.barberId);
  res.json(result);
});
