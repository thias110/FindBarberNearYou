import i18n from "../i18n";
import { ApiError } from "./apiClient";

// Messages des erreurs d'authentification connues (côté client), traduits via
// l'espace `auth` (clés `apiErrors.<CODE>`). Toute erreur non répertoriée
// retombe sur `err.message` (le message serveur reste la référence, on ne le
// masque jamais).
const AUTH_ERROR_CODES = new Set([
  "INVALID_CREDENTIALS",
  "EMAIL_NOT_VERIFIED",
  "INVALID_VERIFICATION_TOKEN",
  "INVALID_RESET_TOKEN",
  "ACCOUNT_SUSPENDED",
  "INVALID_PASSWORD",
  "EMAIL_TAKEN",
  "ADMIN_REGISTRATION_FORBIDDEN",
  "VALIDATION_ERROR",
  "RATE_LIMITED",
  "CSRF_INVALID",
  "UNAUTHORIZED",
  "FORBIDDEN",
]);

/** Message affichable pour une erreur d'authentification. */
export function authErrorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    if (AUTH_ERROR_CODES.has(err.code)) {
      return i18n.t(`auth:apiErrors.${err.code}`);
    }
    return err.message;
  }
  return err instanceof Error ? err.message : i18n.t("auth:apiErrors.unknown");
}
