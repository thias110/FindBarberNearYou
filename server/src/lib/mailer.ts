import nodemailer, { type Transporter } from "nodemailer";
import { env } from "../config/env.js";

// --- Envoi d'emails (issue #9) ---
// Transport choisi par MAIL_TRANSPORT :
//  - `smtp`   : fournisseur réel (Resend, Brevo… via SMTP), obligatoire en prod ;
//  - `log`    : développement local, journalise destinataire + sujet SANS le
//               corps (les liens à jeton ne doivent jamais finir dans les logs) ;
//  - `memory` : tests, messages capturés en mémoire (aucun envoi réel).

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
}

let smtpTransporter: Transporter | null = null;

function smtp(): Transporter {
  if (!smtpTransporter) {
    smtpTransporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_SECURE === "true",
      auth: env.SMTP_USER
        ? { user: env.SMTP_USER, pass: env.SMTP_PASSWORD ?? "" }
        : undefined,
    });
  }
  return smtpTransporter;
}

// Transport mémoire (tests) : boîte d'envoi inspectable et pannes simulées.
const memoryOutbox: MailMessage[] = [];
let simulatedFailures = 0;

export function sentEmails(): readonly MailMessage[] {
  return memoryOutbox;
}

export function clearSentEmails(): void {
  memoryOutbox.length = 0;
  simulatedFailures = 0;
}

/** Les `count` prochains envois échouent (transport mémoire uniquement). */
export function simulateMailFailures(count: number): void {
  simulatedFailures = count;
}

/** Envoie un email ; lève une erreur si le transport échoue. */
export async function sendMail(message: MailMessage): Promise<void> {
  switch (env.MAIL_TRANSPORT) {
    case "memory":
      if (simulatedFailures > 0) {
        simulatedFailures -= 1;
        throw new Error("Simulated SMTP failure");
      }
      memoryOutbox.push(message);
      return;
    case "log":
      console.log(`[email:log] « ${message.subject} » → ${message.to}`);
      return;
    case "smtp":
      await smtp().sendMail({ from: env.EMAIL_FROM, ...message });
      return;
  }
}
