import type { ErrorRequestHandler } from "express";
import { AppError, isUniqueViolation } from "../lib/errors.js";

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof AppError) {
    res.status(err.status).json({ error: { code: err.code, message: err.message } });
    return;
  }
  if (isUniqueViolation(err)) {
    res.status(409).json({
      error: { code: "EMAIL_TAKEN", message: "This email is already registered." },
    });
    return;
  }
  console.error("[server error]", err);
  res.status(500).json({ error: { code: "INTERNAL", message: "Internal server error." } });
};
