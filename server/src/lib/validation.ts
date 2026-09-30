import type { ZodError } from "zod";
import { AppError } from "./errors.js";

/** Convertit une erreur Zod en erreur normalisée 400 VALIDATION_ERROR. */
export function validationError(err: ZodError): AppError {
  const details = err.issues
    .map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`)
    .join("; ");
  return new AppError(400, "VALIDATION_ERROR", details);
}
