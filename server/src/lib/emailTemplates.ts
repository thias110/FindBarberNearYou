import { LIMITS } from "@findbarber/shared/constants";
import { env } from "../config/env.js";
import type { MailMessage } from "./mailer.js";

// --- Gabarits d'emails (issue #9) ---
// Texte brut + HTML, en français. Le HTML n'utilise que des styles en ligne et
// des tableaux (compatibilité clients mail) ; toute donnée variable est
// échappée. Couleurs alignées sur le design system (contrastes AA).

const COLORS = {
  background: "#F7F6F2",
  surface: "#FFFFFF",
  text: "#1C1B1A",
  muted: "#6F6A63",
  accent: "#B86B2B",
  accentText: "#121212",
  border: "#DEDAD2",
};

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function appUrl(path: string): string {
  return `${env.FRONTEND_URL.replace(/\/+$/, "")}${path}`;
}

interface Layout {
  title: string;
  /** Paragraphes en texte brut (échappés pour le HTML). */
  paragraphs: string[];
  action?: { label: string; url: string };
  footer?: string;
}

function renderHtml({ title, paragraphs, action, footer }: Layout): string {
  const body = paragraphs
    .map(
      (p) =>
        `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:${COLORS.text};">${escapeHtml(p)}</p>`,
    )
    .join("");
  const button = action
    ? `<p style="margin:24px 0;"><a href="${escapeHtml(action.url)}" style="display:inline-block;background:${COLORS.accent};color:${COLORS.accentText};text-decoration:none;font-weight:600;font-size:15px;padding:12px 20px;border-radius:8px;">${escapeHtml(action.label)}</a></p>
<p style="margin:0 0 16px;font-size:13px;line-height:1.5;color:${COLORS.muted};">Si le bouton ne fonctionne pas, copiez ce lien : <a href="${escapeHtml(action.url)}" style="color:${COLORS.muted};">${escapeHtml(action.url)}</a></p>`
    : "";
  const foot = escapeHtml(
    footer ?? "Vous recevez cet email car vous avez un compte FindBarber.",
  );
  return `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title></head>
<body style="margin:0;padding:0;background:${COLORS.background};font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${COLORS.background};padding:24px 12px;"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:${COLORS.surface};border:1px solid ${COLORS.border};border-radius:16px;">
<tr><td style="padding:24px 28px 8px;">
<img src="${escapeHtml(appUrl("/email-logo.png"))}" width="40" height="40" alt="FindBarber" style="display:inline-block;vertical-align:middle;border:0;">
<span style="display:inline-block;vertical-align:middle;margin-left:10px;font-size:18px;font-weight:600;color:${COLORS.text};">FindBarber</span>
</td></tr>
<tr><td style="padding:16px 28px 8px;">
<h1 style="margin:0 0 16px;font-size:20px;line-height:1.3;color:${COLORS.text};">${escapeHtml(title)}</h1>
${body}${button}
</td></tr>
<tr><td style="padding:16px 28px 24px;border-top:1px solid ${COLORS.border};font-size:12px;line-height:1.5;color:${COLORS.muted};">${foot}</td></tr>
</table></td></tr></table></body></html>`;
}

function renderText({ title, paragraphs, action, footer }: Layout): string {
  return [
    title,
    "",
    ...paragraphs.flatMap((p) => [p, ""]),
    ...(action ? [`${action.label} : ${action.url}`, ""] : []),
    "—",
    footer ?? "Vous recevez cet email car vous avez un compte FindBarber.",
  ].join("\n");
}

function render(to: string, subject: string, layout: Layout): MailMessage {
  return { to, subject, text: renderText(layout), html: renderHtml(layout) };
}

// --- Comptes ---

export function verificationEmail(to: string, token: string): MailMessage {
  const url = appUrl(`/verify-email?token=${encodeURIComponent(token)}`);
  const hours = Math.round(env.EMAIL_VERIFICATION_TOKEN_TTL_SECONDS / 3600);
  return render(to, "Confirmez votre adresse email", {
    title: "Bienvenue sur FindBarber",
    paragraphs: [
      "Confirmez votre adresse email pour activer votre compte et pouvoir vous connecter.",
      `Ce lien est valable ${hours} h et ne peut être utilisé qu'une seule fois.`,
    ],
    action: { label: "Confirmer mon adresse", url },
    footer:
      "Si vous n'êtes pas à l'origine de cette inscription, ignorez cet email.",
  });
}

export function passwordResetEmail(to: string, token: string): MailMessage {
  const url = appUrl(`/reset-password?token=${encodeURIComponent(token)}`);
  const minutes = Math.round(env.PASSWORD_RESET_TOKEN_TTL_SECONDS / 60);
  return render(to, "Réinitialisation de votre mot de passe", {
    title: "Réinitialiser votre mot de passe",
    paragraphs: [
      "Vous avez demandé à réinitialiser le mot de passe de votre compte FindBarber.",
      `Ce lien est valable ${minutes} minutes et ne peut être utilisé qu'une seule fois. Après le changement, vos autres sessions seront déconnectées.`,
    ],
    action: { label: "Choisir un nouveau mot de passe", url },
    footer:
      "Si vous n'avez rien demandé, ignorez cet email : votre mot de passe reste inchangé.",
  });
}

// --- Réservations ---

export interface BookingEmailContext {
  to: string;
  recipientName: string | null;
  barberName: string;
  barberProfileId: string;
  clientName: string | null;
  serviceName: string;
  placeLabel: string;
  startAt: Date;
  timeZone: string;
  declineReason?: string | null;
}

export function formatBookingDate(startAt: Date, timeZone: string): string {
  // fr-FR : « mardi 20 octobre » (fr-CH insère une virgule après le jour).
  return new Intl.DateTimeFormat("fr-FR", {
    timeZone,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(startAt);
}

function greeting(name: string | null): string {
  const first = name?.trim().split(/\s+/)[0];
  return first ? `Bonjour ${first},` : "Bonjour,";
}

const CANCEL_DELAY = `${Math.round(LIMITS.bookingClientCancelMinMinutes / 60)} heures`;

export type BookingEmailKind =
  | "BOOKING_REQUESTED"
  | "BOOKING_CONFIRMED"
  | "BOOKING_DECLINED"
  | "BOOKING_CANCELLED_BY_CLIENT"
  | "BOOKING_CANCELLED_BY_BARBER"
  | "BOOKING_CANCELLED_BY_ADMIN"
  | "BOOKING_EXPIRED"
  | "BOOKING_REMINDER";

export function bookingEmail(
  kind: BookingEmailKind,
  ctx: BookingEmailContext,
  recipientIsBarber: boolean,
): MailMessage {
  const when = `${formatBookingDate(ctx.startAt, ctx.timeZone)} (heure du salon)`;
  const what = `${ctx.serviceName} · ${ctx.placeLabel}`;
  const hello = greeting(ctx.recipientName);
  const client = ctx.clientName?.trim() || "Un client";
  const appointments = {
    label: "Voir mes rendez-vous",
    url: appUrl(recipientIsBarber ? "/pro/bookings" : "/appointments"),
  };

  switch (kind) {
    case "BOOKING_REQUESTED":
      return render(ctx.to, `Nouvelle demande de réservation — ${when}`, {
        title: "Nouvelle demande de réservation",
        paragraphs: [
          hello,
          `${client} souhaite réserver : ${what}, le ${when}.`,
          "Confirmez ou refusez la demande dans les 24 heures ; sans réponse, elle expirera et le créneau sera libéré.",
        ],
        action: { label: "Répondre à la demande", url: appointments.url },
      });
    case "BOOKING_CONFIRMED":
      return render(ctx.to, `Rendez-vous confirmé — ${when}`, {
        title: "Votre rendez-vous est confirmé",
        paragraphs: [
          hello,
          `${ctx.barberName} a confirmé votre rendez-vous : ${what}, le ${when}.`,
          `Vous pouvez l'annuler depuis vos rendez-vous jusqu'à ${CANCEL_DELAY} avant.`,
        ],
        action: appointments,
      });
    case "BOOKING_DECLINED":
      return render(ctx.to, "Votre demande de réservation a été refusée", {
        title: "Demande refusée",
        paragraphs: [
          hello,
          `${ctx.barberName} ne peut pas vous recevoir le ${when} (${what}).`,
          ...(ctx.declineReason?.trim()
            ? [`Motif indiqué : « ${ctx.declineReason.trim()} »`]
            : []),
          "Le créneau est libéré : vous pouvez choisir un autre horaire.",
        ],
        action: {
          label: "Choisir un autre créneau",
          url: appUrl(`/barbers/${ctx.barberProfileId}`),
        },
      });
    case "BOOKING_CANCELLED_BY_CLIENT":
      return render(ctx.to, `Rendez-vous annulé par le client — ${when}`, {
        title: "Rendez-vous annulé",
        paragraphs: [
          hello,
          `${client} a annulé son rendez-vous : ${what}, le ${when}.`,
          "Le créneau est de nouveau disponible.",
        ],
        action: appointments,
      });
    case "BOOKING_CANCELLED_BY_BARBER":
      return render(ctx.to, `Rendez-vous annulé — ${when}`, {
        title: "Votre rendez-vous a été annulé",
        paragraphs: [
          hello,
          `${ctx.barberName} a annulé votre rendez-vous : ${what}, le ${when}.`,
          "Vous pouvez réserver un autre créneau.",
        ],
        action: {
          label: "Réserver un autre créneau",
          url: appUrl(`/barbers/${ctx.barberProfileId}`),
        },
      });
    case "BOOKING_CANCELLED_BY_ADMIN":
      return render(ctx.to, `Rendez-vous annulé — ${when}`, {
        title: "Rendez-vous annulé par l'administration",
        paragraphs: [
          hello,
          `Le rendez-vous ${what} du ${when} avec ${ctx.barberName} a été annulé par l'équipe FindBarber.`,
        ],
        action: appointments,
      });
    case "BOOKING_EXPIRED":
      return render(ctx.to, "Votre demande de réservation a expiré", {
        title: "Demande expirée",
        paragraphs: [
          hello,
          `${ctx.barberName} n'a pas répondu à temps à votre demande : ${what}, le ${when}.`,
          "La demande a expiré et le créneau est libéré. Vous pouvez en choisir un autre.",
        ],
        action: {
          label: "Choisir un autre créneau",
          url: appUrl(`/barbers/${ctx.barberProfileId}`),
        },
      });
    case "BOOKING_REMINDER":
      return render(ctx.to, `Rappel : rendez-vous le ${when}`, {
        title: "Rappel de votre rendez-vous",
        paragraphs: [
          hello,
          `Petit rappel : ${what} avec ${ctx.barberName}, le ${when}.`,
          `Un empêchement ? Annulez depuis vos rendez-vous jusqu'à ${CANCEL_DELAY} avant pour libérer le créneau.`,
        ],
        action: appointments,
      });
  }
}
