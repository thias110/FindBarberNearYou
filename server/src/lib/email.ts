import { env } from "../config/env.js";

export interface VerificationEmailInput {
  to: string;
  token: string;
}

/**
 * Faux mailer local (mission A) : journalise l'email de vérification au lieu de
 * l'envoyer réellement. Aucune dépendance npm. Le jeton brut n'est JAMAIS écrit
 * dans les logs : on n'affiche que le destinataire et l'URL sans la partie
 * sensible du lien.
 */
export async function sendVerificationEmail(
  input: VerificationEmailInput,
): Promise<void> {
  const link = `${env.FRONTEND_URL}/verify-email?token=${encodeURIComponent(
    input.token,
  )}`;
  const url = new URL(link);
  console.log(
    `[email:log] Vérification d'email demandée pour ${input.to} ` +
      `(lien ${url.origin}${url.pathname}, jeton masqué)`,
  );
}
