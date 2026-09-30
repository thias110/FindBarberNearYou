import { Router } from "express";
import type { ZodError } from "zod";
import {
  profileSchema,
  serviceCreateSchema,
  serviceUpdateSchema,
} from "@findbarber/shared/validation";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { csrfProtection } from "../../middleware/csrf.js";
import { AppError } from "../../lib/errors.js";
import {
  createService,
  getOwnProfile,
  listOwnServices,
  updateService,
  upsertProfile,
} from "./service.js";

export const barberRouter = Router();

function validationError(err: ZodError): AppError {
  const details = err.issues
    .map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`)
    .join("; ");
  return new AppError(400, "VALIDATION_ERROR", details);
}

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
