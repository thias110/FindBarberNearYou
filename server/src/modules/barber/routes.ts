import { Router } from "express";
import { requireAuth, requireRole } from "../../middleware/auth.js";

export const barberRouter = Router();

// Placeholder protected route — exercises the BARBER role guard (expanded later).
barberRouter.get("/status", requireAuth, requireRole("BARBER"), (_req, res) => {
  res.json({ ok: true });
});
