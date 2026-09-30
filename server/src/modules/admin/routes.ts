import { Router } from "express";
import { requireAuth, requireRole } from "../../middleware/auth.js";

export const adminRouter = Router();

// Placeholder protected route — exercises the ADMIN role guard (expanded later).
adminRouter.get("/status", requireAuth, requireRole("ADMIN"), (_req, res) => {
  res.json({ ok: true });
});
