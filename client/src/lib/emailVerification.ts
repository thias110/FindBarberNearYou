import { ApiError } from "./apiClient";

// --- Vérification d'email (page /verify-email) ---
// Logique PURE séparée de la page : elle résout TOUJOURS vers un état final
// (succès ou erreur), jamais vers « en cours ». La page n'a plus qu'à appliquer
// ce résultat, sans pouvoir rester bloquée sur « Vérification en cours… ».
//
// Multilingue (issue #32) : `message` est une CLÉ de l'espace `auth`, traduite
// au rendu par la page (`t(message)`), pour suivre un changement de langue.

export const INVALID_TOKEN_MESSAGE = "verifyEmail.errors.invalidToken";
export const RATE_LIMITED_MESSAGE = "verifyEmail.errors.rateLimited";
export const NETWORK_MESSAGE = "verifyEmail.errors.network";

export type EmailVerificationMessage =
  | typeof INVALID_TOKEN_MESSAGE
  | typeof RATE_LIMITED_MESSAGE
  | typeof NETWORK_MESSAGE;

export type EmailVerificationOutcome =
  | { phase: "success" }
  | { phase: "error"; message: EmailVerificationMessage };

export async function runEmailVerification(
  token: string | null,
  verify: (input: { token: string }) => Promise<unknown>,
): Promise<EmailVerificationOutcome> {
  if (!token) {
    return { phase: "error", message: INVALID_TOKEN_MESSAGE };
  }
  try {
    await verify({ token });
    return { phase: "success" };
  } catch (err) {
    if (err instanceof ApiError) {
      // Expiré / déjà utilisé / invalide : message public uniforme.
      return {
        phase: "error",
        message:
          err.code === "RATE_LIMITED"
            ? RATE_LIMITED_MESSAGE
            : INVALID_TOKEN_MESSAGE,
      };
    }
    return { phase: "error", message: NETWORK_MESSAGE };
  }
}
