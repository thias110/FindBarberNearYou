import { ApiError } from "./apiClient";

// --- Vérification d'email (page /verify-email) ---
// Logique PURE séparée de la page : elle résout TOUJOURS vers un état final
// (succès ou erreur), jamais vers « en cours ». La page n'a plus qu'à appliquer
// ce résultat, sans pouvoir rester bloquée sur « Vérification en cours… ».

export const INVALID_TOKEN_MESSAGE =
  "Ce lien de vérification est invalide ou expiré.";
export const RATE_LIMITED_MESSAGE =
  "Trop de tentatives. Réessayez dans quelques instants.";
export const NETWORK_MESSAGE =
  "Impossible de joindre le serveur. Vérifiez votre connexion puis réessayez.";

export type EmailVerificationOutcome =
  | { phase: "success" }
  | { phase: "error"; message: string };

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
