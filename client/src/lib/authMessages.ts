import { ApiError } from "./apiClient";

// Messages français des erreurs d'authentification connues (côté client).
// Toute erreur non répertoriée retombe sur `err.message` (le message serveur
// reste la référence, on ne le masque jamais).
const AUTH_ERROR_MESSAGES: Record<string, string> = {
  INVALID_CREDENTIALS: "Email ou mot de passe incorrect.",
  ACCOUNT_SUSPENDED: "Ce compte est suspendu. Contactez l'administration.",
  EMAIL_TAKEN: "Un compte existe déjà avec cet email.",
  ADMIN_REGISTRATION_FORBIDDEN:
    "La création de comptes administrateur n'est pas autorisée.",
  VALIDATION_ERROR:
    "Certaines informations sont invalides. Vérifiez les champs du formulaire.",
  RATE_LIMITED: "Trop de tentatives. Réessayez dans quelques instants.",
  CSRF_INVALID: "Session expirée. Rechargez la page puis réessayez.",
  UNAUTHORIZED: "Votre session a expiré. Veuillez vous reconnecter.",
  FORBIDDEN: "Vous n'avez pas les droits pour effectuer cette action.",
};

/** Message affichable pour une erreur d'authentification. */
export function authErrorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    const mapped = AUTH_ERROR_MESSAGES[err.code];
    if (mapped) return mapped;
    return err.message;
  }
  return err instanceof Error ? err.message : "Une erreur est survenue.";
}
