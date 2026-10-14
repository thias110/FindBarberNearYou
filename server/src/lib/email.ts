import { passwordResetEmail, verificationEmail } from "./emailTemplates.js";
import { sendMail, type MailMessage } from "./mailer.js";

// --- Emails à jeton (vérification, réinitialisation) — issue #9 ---
// Envoyés directement (jamais via `email_outbox`, pour ne pas stocker de jeton
// brut en base) et APRÈS les écritures en base. Ne lèvent jamais : un échec
// SMTP est journalisé (sans le jeton) et n'échoue pas la requête ; l'utilisateur
// peut redemander un lien.

async function sendSafely(message: MailMessage, label: string): Promise<void> {
  try {
    await sendMail(message);
  } catch (err) {
    console.error(
      `[email] échec d'envoi (${label}) : ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

export async function sendVerificationEmail(input: {
  to: string;
  token: string;
}): Promise<void> {
  await sendSafely(verificationEmail(input.to, input.token), "vérification");
}

export async function sendPasswordResetEmail(input: {
  to: string;
  token: string;
}): Promise<void> {
  await sendSafely(passwordResetEmail(input.to, input.token), "mot de passe");
}
