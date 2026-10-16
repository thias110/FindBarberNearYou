import type { ZodError } from "zod";
import { AppError } from "./errors.js";

/** Convertit une erreur Zod en erreur normalisée 400 VALIDATION_ERROR. */
export function validationError(err: ZodError): AppError {
  const details = err.issues
    .map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`)
    .join("; ");
  // `message` reste la liste lisible ; `fields` permet au client d'afficher
  // chaque erreur sous le champ concerné (issue #57).
  const fields = err.issues
    .filter((issue) => issue.path.length > 0)
    .map((issue) => ({ path: issue.path.join("."), message: issue.message }));
  return new AppError(400, "VALIDATION_ERROR", details, fields);
}
