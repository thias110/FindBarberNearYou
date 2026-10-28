import {
  LIMITS,
  type Locale,
  type ServicePlace,
} from "@findbarber/shared/constants";
import { env } from "../config/env.js";
import {
  EMAIL_DATE_TAGS,
  emailStrings,
  resolveEmailLocale,
  type BookingTextParams,
  type EmailStrings,
} from "./emailI18n.js";
import type { MailMessage } from "./mailer.js";

// --- Gabarits d'emails (issues #9, #36) ---
// Texte brut + HTML, dans la langue du DESTINATAIRE (`users.locale`, repli
// français ; textes dans `emailI18n.ts`). Le HTML n'utilise que des styles en
// ligne et des tableaux (compatibilité clients mail) ; toute donnée variable
// est échappée. Couleurs alignées sur le design system (contrastes AA).

const COLORS = {
  background: "#F2F5FA",
  surface: "#FFFFFF",
  text: "#0E1B3D",
  muted: "#55617D",
  accent: "#1463F3",
  accentText: "#FFFFFF",
  border: "#E1E6EF",
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
  locale: Locale;
  strings: EmailStrings;
  title: string;
  /** Paragraphes en texte brut (échappés pour le HTML). */
  paragraphs: string[];
  action?: { label: string; url: string };
  footer?: string;
}

function renderHtml({
  locale,
  strings,
  title,
  paragraphs,
  action,
  footer,
}: Layout): string {
  const body = paragraphs
    .map(
      (p) =>
        `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:${COLORS.text};">${escapeHtml(p)}</p>`,
    )
    .join("");
  const button = action
    ? `<p style="margin:24px 0;"><a href="${escapeHtml(action.url)}" style="display:inline-block;background:${COLORS.accent};color:${COLORS.accentText};text-decoration:none;font-weight:600;font-size:15px;padding:12px 20px;border-radius:8px;">${escapeHtml(action.label)}</a></p>
<p style="margin:0 0 16px;font-size:13px;line-height:1.5;color:${COLORS.muted};">${escapeHtml(strings.buttonFallback)} <a href="${escapeHtml(action.url)}" style="color:${COLORS.muted};">${escapeHtml(action.url)}</a></p>`
    : "";
  const foot = escapeHtml(footer ?? strings.defaultFooter);
  return `<!doctype html>
<html lang="${locale}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title></head>
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

function renderText({
  strings,
  title,
  paragraphs,
  action,
  footer,
}: Layout): string {
  return [
    title,
    "",
    ...paragraphs.flatMap((p) => [p, ""]),
    ...(action ? [strings.actionLine(action.label, action.url), ""] : []),
    "—",
    footer ?? strings.defaultFooter,
  ].join("\n");
}

function render(to: string, subject: string, layout: Layout): MailMessage {
  return { to, subject, text: renderText(layout), html: renderHtml(layout) };
}

// --- Comptes ---

/** `locale` : langue du destinataire (inconnue ou absente → français). */
export function verificationEmail(
  to: string,
  token: string,
  locale?: string | null,
): MailMessage {
  const lang = resolveEmailLocale(locale);
  const s = emailStrings(lang);
  const url = appUrl(`/verify-email?token=${encodeURIComponent(token)}`);
  const hours = Math.round(env.EMAIL_VERIFICATION_TOKEN_TTL_SECONDS / 3600);
  return render(to, s.verificationSubject, {
    locale: lang,
    strings: s,
    title: s.verificationTitle,
    paragraphs: [s.verificationIntro, s.verificationValidity(hours)],
    action: { label: s.verificationAction, url },
    footer: s.verificationFooter,
  });
}

/**
 * Inscription ou réservation express avec une adresse déjà inscrite : la
 * réponse de l'API est celle d'un succès (aucune fuite de l'existence du
 * compte) et le titulaire reçoit ce message, sans aucun lien à jeton.
 */
export function accountExistsEmail(to: string, locale?: string | null): MailMessage {
  const lang = resolveEmailLocale(locale);
  const s = emailStrings(lang);
  return render(to, s.accountExistsSubject, {
    locale: lang,
    strings: s,
    title: s.accountExistsTitle,
    paragraphs: [s.accountExistsIntro],
    action: { label: s.accountExistsAction, url: appUrl("/login") },
    footer: s.accountExistsFooter,
  });
}

/** Réservation express (lot N6) : le contexte du récapitulatif. */
export interface ExpressBookingEmailContext {
  barberName: string;
  serviceName: string;
  servicePlace: ServicePlace;
  startAt: Date;
  /** Fuseau du salon : l'heure affichée est toujours celle du salon. */
  timeZone: string;
  /** Délai pour cliquer sur le lien. */
  minutes: number;
}

/**
 * Réservation express (lot N6) : un seul email réunit le lien de choix du
 * mot de passe et le récapitulatif de la demande. Choisir son mot de passe
 * vérifie l'adresse et transmet la demande au barber.
 */
export function expressBookingEmail(
  to: string,
  token: string,
  locale: string | null | undefined,
  ctx: ExpressBookingEmailContext,
): MailMessage {
  const lang = resolveEmailLocale(locale);
  const s = emailStrings(lang);
  const url = appUrl(`/reset-password?token=${encodeURIComponent(token)}`);
  const params = {
    barber: ctx.barberName,
    when: s.salonTime(formatBookingDate(ctx.startAt, ctx.timeZone, lang)),
    what: `${ctx.serviceName} · ${s.servicePlace[ctx.servicePlace]}`,
  };
  return render(to, s.expressSubject(ctx.barberName), {
    locale: lang,
    strings: s,
    title: s.expressTitle,
    paragraphs: [s.expressIntro(params), s.expressDeadline(ctx.minutes)],
    action: { label: s.expressAction, url },
    footer: s.expressFooter,
  });
}

/** `locale` : langue du destinataire (inconnue ou absente → français). */
export function passwordResetEmail(
  to: string,
  token: string,
  locale?: string | null,
): MailMessage {
  const lang = resolveEmailLocale(locale);
  const s = emailStrings(lang);
  const url = appUrl(`/reset-password?token=${encodeURIComponent(token)}`);
  const minutes = Math.round(env.PASSWORD_RESET_TOKEN_TTL_SECONDS / 60);
  return render(to, s.resetSubject, {
    locale: lang,
    strings: s,
    title: s.resetTitle,
    paragraphs: [s.resetIntro, s.resetValidity(minutes)],
    action: { label: s.resetAction, url },
    footer: s.resetFooter,
  });
}

// --- Réservations ---

export interface BookingEmailContext {
  to: string;
  /** Langue du destinataire (`users.locale`) ; inconnue ou absente → français. */
  locale?: string | null;
  recipientName: string | null;
  barberName: string;
  barberProfileId: string;
  clientName: string | null;
  serviceName: string;
  /** Lieu de prestation, traduit dans la langue du destinataire. */
  servicePlace: ServicePlace;
  startAt: Date;
  /** Fuseau du salon : l'heure affichée est toujours celle du salon. */
  timeZone: string;
  declineReason?: string | null;
}

/** Date et heure du rendez-vous, dans le fuseau du salon et la langue donnée. */
export function formatBookingDate(
  startAt: Date,
  timeZone: string,
  locale?: string | null,
): string {
  return new Intl.DateTimeFormat(EMAIL_DATE_TAGS[resolveEmailLocale(locale)], {
    timeZone,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(startAt);
}

function firstName(name: string | null): string | null {
  return name?.trim().split(/\s+/)[0] || null;
}

const CANCEL_DELAY_HOURS = Math.round(
  LIMITS.bookingClientCancelMinMinutes / 60,
);

export type BookingEmailKind =
  | "BOOKING_REQUESTED"
  | "BOOKING_CONFIRMED"
  | "BOOKING_DECLINED"
  | "BOOKING_CANCELLED_BY_CLIENT"
  | "BOOKING_CANCELLED_BY_BARBER"
  | "BOOKING_CANCELLED_BY_ADMIN"
  | "BOOKING_EXPIRED"
  | "BOOKING_REMINDER";

const BOOKING_TEXTS = {
  BOOKING_REQUESTED: "bookingRequested",
  BOOKING_CONFIRMED: "bookingConfirmed",
  BOOKING_DECLINED: "bookingDeclined",
  BOOKING_CANCELLED_BY_CLIENT: "bookingCancelledByClient",
  BOOKING_CANCELLED_BY_BARBER: "bookingCancelledByBarber",
  BOOKING_CANCELLED_BY_ADMIN: "bookingCancelledByAdmin",
  BOOKING_EXPIRED: "bookingExpired",
  BOOKING_REMINDER: "bookingReminder",
} as const satisfies Record<BookingEmailKind, keyof EmailStrings>;

// Lien du bouton : page du barber quand il faut choisir un autre créneau,
// sinon les rendez-vous du destinataire.
const LINKS_TO_BARBER_PAGE: ReadonlySet<BookingEmailKind> = new Set([
  "BOOKING_DECLINED",
  "BOOKING_CANCELLED_BY_BARBER",
  "BOOKING_EXPIRED",
]);

export function bookingEmail(
  kind: BookingEmailKind,
  ctx: BookingEmailContext,
  recipientIsBarber: boolean,
): MailMessage {
  const lang = resolveEmailLocale(ctx.locale);
  const s = emailStrings(lang);
  const params: BookingTextParams = {
    when: s.salonTime(formatBookingDate(ctx.startAt, ctx.timeZone, lang)),
    what: `${ctx.serviceName} · ${s.servicePlace[ctx.servicePlace]}`,
    client: ctx.clientName?.trim() || s.someClient,
    barber: ctx.barberName,
    cancelDelay: s.cancelDelay(CANCEL_DELAY_HOURS),
    reason: ctx.declineReason?.trim() || null,
  };
  const url = LINKS_TO_BARBER_PAGE.has(kind)
    ? appUrl(`/barbers/${ctx.barberProfileId}`)
    : appUrl(recipientIsBarber ? "/pro/bookings" : "/appointments");

  const texts = s[BOOKING_TEXTS[kind]];
  return render(ctx.to, texts.subject(params), {
    locale: lang,
    strings: s,
    title: texts.title,
    paragraphs: [
      s.greeting(firstName(ctx.recipientName)),
      ...texts.paragraphs(params),
    ],
    action: { label: texts.action ?? s.viewAppointments, url },
  });
}
