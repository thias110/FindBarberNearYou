import {
  DEFAULT_LOCALE,
  LOCALES,
  type Locale,
  type ServicePlace,
} from "@findbarber/shared/constants";

// --- Textes des emails transactionnels par langue (issue #36) ---
// La langue est TOUJOURS celle du destinataire (`users.locale`), jamais celle
// de l'auteur de l'action. Toute clé absente d'une langue retombe sur le
// français. En italien et en espagnol : tutoiement (comme l'application).
// Les valeurs sont du texte brut : l'échappement HTML est fait au rendu.

/** Valeurs variables d'un email de réservation (déjà mises en forme). */
export interface BookingTextParams {
  /** Date et heure du rendez-vous, avec la mention « heure du salon ». */
  when: string;
  /** Prestation · lieu. */
  what: string;
  /** Nom du client, ou « Un client ». */
  client: string;
  barber: string;
  /** Délai d'annulation par le client (« 2 heures »). */
  cancelDelay: string;
  /** Motif de refus (déjà nettoyé), ou null. */
  reason: string | null;
}

interface BookingTexts {
  subject: (p: BookingTextParams) => string;
  title: string;
  paragraphs: (p: BookingTextParams) => string[];
  action?: string;
}

export interface EmailStrings {
  /** Texte avant le lien de secours sous le bouton. */
  buttonFallback: string;
  defaultFooter: string;
  /** Ligne « libellé : lien » de la version texte. */
  actionLine: (label: string, url: string) => string;

  verificationSubject: string;
  verificationTitle: string;
  verificationIntro: string;
  verificationValidity: (hours: number) => string;
  verificationAction: string;
  verificationFooter: string;

  // Réservation express (lot N6) : vérification + récapitulatif en un email.
  expressSubject: (barber: string) => string;
  expressTitle: string;
  expressIntro: (p: { barber: string; when: string; what: string }) => string;
  expressDeadline: (minutes: number) => string;
  expressAction: string;
  expressFooter: string;

  resetSubject: string;
  resetTitle: string;
  resetIntro: string;
  resetValidity: (minutes: number) => string;
  resetAction: string;
  resetFooter: string;

  greeting: (firstName: string | null) => string;
  salonTime: (date: string) => string;
  someClient: string;
  viewAppointments: string;
  cancelDelay: (hours: number) => string;
  servicePlace: Record<ServicePlace, string>;

  bookingRequested: BookingTexts;
  bookingConfirmed: BookingTexts;
  bookingDeclined: BookingTexts;
  bookingCancelledByClient: BookingTexts;
  bookingCancelledByBarber: BookingTexts;
  bookingCancelledByAdmin: BookingTexts;
  bookingExpired: BookingTexts;
  bookingReminder: BookingTexts;
}

/**
 * Balise de formatage des dates dans les emails. fr-FR plutôt que fr-CH :
 * « mardi 20 octobre » (fr-CH insère une virgule après le jour) ; de même
 * it-IT plutôt que it-CH.
 */
export const EMAIL_DATE_TAGS: Record<Locale, string> = {
  fr: "fr-FR",
  en: "en-GB",
  it: "it-IT",
  es: "es-ES",
};

const fr: EmailStrings = {
  buttonFallback: "Si le bouton ne fonctionne pas, copiez ce lien :",
  defaultFooter: "Vous recevez cet email car vous avez un compte FindBarber.",
  actionLine: (label, url) => `${label} : ${url}`,

  verificationSubject: "Confirmez votre adresse email",
  verificationTitle: "Bienvenue sur FindBarber",
  verificationIntro:
    "Confirmez votre adresse email pour activer votre compte et pouvoir vous connecter.",
  verificationValidity: (hours) =>
    `Ce lien est valable ${hours} h et ne peut être utilisé qu'une seule fois.`,
  verificationAction: "Confirmer mon adresse",
  verificationFooter:
    "Si vous n'êtes pas à l'origine de cette inscription, ignorez cet email.",

  expressSubject: (barber) => `Confirmez votre email pour envoyer votre demande à ${barber}`,
  expressTitle: "Dernière étape : confirmez votre email",
  expressIntro: ({ barber, when, what }) =>
    `Votre demande chez ${barber} pour ${what}, le ${when}, est prête. Choisissez le mot de passe de votre compte FindBarber pour l'envoyer : votre adresse sera confirmée en même temps.`,
  expressDeadline: (minutes) =>
    `Le créneau vous est réservé pendant ${minutes} minutes. Sans confirmation dans ce délai, la demande est annulée et le créneau libéré.`,
  expressAction: "Choisir mon mot de passe et envoyer ma demande",
  expressFooter:
    "Si vous n'êtes pas à l'origine de cette demande, ignorez cet email : aucune réservation ne sera envoyée.",

  resetSubject: "Réinitialisation de votre mot de passe",
  resetTitle: "Réinitialiser votre mot de passe",
  resetIntro:
    "Vous avez demandé à réinitialiser le mot de passe de votre compte FindBarber.",
  resetValidity: (minutes) =>
    `Ce lien est valable ${minutes} minutes et ne peut être utilisé qu'une seule fois. Après le changement, vos autres sessions seront déconnectées.`,
  resetAction: "Choisir un nouveau mot de passe",
  resetFooter:
    "Si vous n'avez rien demandé, ignorez cet email : votre mot de passe reste inchangé.",

  greeting: (first) => (first ? `Bonjour ${first},` : "Bonjour,"),
  salonTime: (date) => `${date} (heure du salon)`,
  someClient: "Un client",
  viewAppointments: "Voir mes rendez-vous",
  cancelDelay: (hours) => `${hours} ${hours === 1 ? "heure" : "heures"}`,
  servicePlace: {
    SALON: "En salon",
    AT_PROVIDER: "Chez le professionnel",
    AT_CLIENT: "Chez le client",
  },

  bookingRequested: {
    subject: (p) => `Nouvelle demande de réservation — ${p.when}`,
    title: "Nouvelle demande de réservation",
    paragraphs: (p) => [
      `${p.client} souhaite réserver : ${p.what}, le ${p.when}.`,
      "Confirmez ou refusez la demande dans les 24 heures ; sans réponse, elle expirera et le créneau sera libéré.",
    ],
    action: "Répondre à la demande",
  },
  bookingConfirmed: {
    subject: (p) => `Rendez-vous confirmé — ${p.when}`,
    title: "Votre rendez-vous est confirmé",
    paragraphs: (p) => [
      `${p.barber} a confirmé votre rendez-vous : ${p.what}, le ${p.when}.`,
      `Vous pouvez l'annuler depuis vos rendez-vous jusqu'à ${p.cancelDelay} avant.`,
    ],
  },
  bookingDeclined: {
    subject: () => "Votre demande de réservation a été refusée",
    title: "Demande refusée",
    paragraphs: (p) => [
      `${p.barber} ne peut pas vous recevoir le ${p.when} (${p.what}).`,
      ...(p.reason ? [`Motif indiqué : « ${p.reason} »`] : []),
      "Le créneau est libéré : vous pouvez choisir un autre horaire.",
    ],
    action: "Choisir un autre créneau",
  },
  bookingCancelledByClient: {
    subject: (p) => `Rendez-vous annulé par le client — ${p.when}`,
    title: "Rendez-vous annulé",
    paragraphs: (p) => [
      `${p.client} a annulé son rendez-vous : ${p.what}, le ${p.when}.`,
      "Le créneau est de nouveau disponible.",
    ],
  },
  bookingCancelledByBarber: {
    subject: (p) => `Rendez-vous annulé — ${p.when}`,
    title: "Votre rendez-vous a été annulé",
    paragraphs: (p) => [
      `${p.barber} a annulé votre rendez-vous : ${p.what}, le ${p.when}.`,
      "Vous pouvez réserver un autre créneau.",
    ],
    action: "Réserver un autre créneau",
  },
  bookingCancelledByAdmin: {
    subject: (p) => `Rendez-vous annulé — ${p.when}`,
    title: "Rendez-vous annulé par l'administration",
    paragraphs: (p) => [
      `Le rendez-vous ${p.what} du ${p.when} avec ${p.barber} a été annulé par l'équipe FindBarber.`,
    ],
  },
  bookingExpired: {
    subject: () => "Votre demande de réservation a expiré",
    title: "Demande expirée",
    paragraphs: (p) => [
      `${p.barber} n'a pas répondu à temps à votre demande : ${p.what}, le ${p.when}.`,
      "La demande a expiré et le créneau est libéré. Vous pouvez en choisir un autre.",
    ],
    action: "Choisir un autre créneau",
  },
  bookingReminder: {
    subject: (p) => `Rappel : rendez-vous le ${p.when}`,
    title: "Rappel de votre rendez-vous",
    paragraphs: (p) => [
      `Petit rappel : ${p.what} avec ${p.barber}, le ${p.when}.`,
      `Un empêchement ? Annulez depuis vos rendez-vous jusqu'à ${p.cancelDelay} avant pour libérer le créneau.`,
    ],
  },
};

const en: EmailStrings = {
  buttonFallback: "If the button doesn't work, copy this link:",
  defaultFooter: "You are receiving this email because you have a FindBarber account.",
  actionLine: (label, url) => `${label}: ${url}`,

  verificationSubject: "Confirm your email address",
  verificationTitle: "Welcome to FindBarber",
  verificationIntro:
    "Confirm your email address to activate your account and sign in.",
  verificationValidity: (hours) =>
    `This link is valid for ${hours} ${hours === 1 ? "hour" : "hours"} and can only be used once.`,
  verificationAction: "Confirm my address",
  verificationFooter:
    "If you didn't sign up for an account, please ignore this email.",

  expressSubject: (barber) => `Confirm your email to send your request to ${barber}`,
  expressTitle: "Last step: confirm your email",
  expressIntro: ({ barber, when, what }) =>
    `Your request with ${barber} for ${what} on ${when} is ready. Choose the password for your FindBarber account to send it; your email address will be confirmed at the same time.`,
  expressDeadline: (minutes) =>
    `The slot is held for you for ${minutes} minutes. Without confirmation within that time, the request is cancelled and the slot released.`,
  expressAction: "Choose my password and send my request",
  expressFooter:
    "If you didn't make this request, please ignore this email: no booking will be sent.",

  resetSubject: "Reset your password",
  resetTitle: "Reset your password",
  resetIntro:
    "You asked to reset the password for your FindBarber account.",
  resetValidity: (minutes) =>
    `This link is valid for ${minutes} minutes and can only be used once. Once you've changed your password, you'll be signed out of your other sessions.`,
  resetAction: "Choose a new password",
  resetFooter:
    "If you didn't request this, please ignore this email: your password stays the same.",

  greeting: (first) => (first ? `Hello ${first},` : "Hello,"),
  salonTime: (date) => `${date} (salon time)`,
  someClient: "A client",
  viewAppointments: "View my appointments",
  cancelDelay: (hours) => `${hours} ${hours === 1 ? "hour" : "hours"}`,
  servicePlace: {
    SALON: "In the salon",
    AT_PROVIDER: "At the barber's place",
    AT_CLIENT: "At the client's home",
  },

  bookingRequested: {
    subject: (p) => `New booking request — ${p.when}`,
    title: "New booking request",
    paragraphs: (p) => [
      `${p.client} would like to book: ${p.what}, on ${p.when}.`,
      "Confirm or decline the request within 24 hours; without a reply, it will expire and the slot will be freed up.",
    ],
    action: "Reply to the request",
  },
  bookingConfirmed: {
    subject: (p) => `Appointment confirmed — ${p.when}`,
    title: "Your appointment is confirmed",
    paragraphs: (p) => [
      `${p.barber} has confirmed your appointment: ${p.what}, on ${p.when}.`,
      `You can cancel it from your appointments up to ${p.cancelDelay} beforehand.`,
    ],
  },
  bookingDeclined: {
    subject: () => "Your booking request has been declined",
    title: "Request declined",
    paragraphs: (p) => [
      `${p.barber} can't see you on ${p.when} (${p.what}).`,
      ...(p.reason ? [`Reason given: “${p.reason}”`] : []),
      "The slot has been freed up: you can choose another time.",
    ],
    action: "Choose another slot",
  },
  bookingCancelledByClient: {
    subject: (p) => `Appointment cancelled by the client — ${p.when}`,
    title: "Appointment cancelled",
    paragraphs: (p) => [
      `${p.client} has cancelled their appointment: ${p.what}, on ${p.when}.`,
      "The slot is available again.",
    ],
  },
  bookingCancelledByBarber: {
    subject: (p) => `Appointment cancelled — ${p.when}`,
    title: "Your appointment has been cancelled",
    paragraphs: (p) => [
      `${p.barber} has cancelled your appointment: ${p.what}, on ${p.when}.`,
      "You can book another slot.",
    ],
    action: "Book another slot",
  },
  bookingCancelledByAdmin: {
    subject: (p) => `Appointment cancelled — ${p.when}`,
    title: "Appointment cancelled by the administrators",
    paragraphs: (p) => [
      `Your appointment ${p.what} on ${p.when} with ${p.barber} has been cancelled by the FindBarber team.`,
    ],
  },
  bookingExpired: {
    subject: () => "Your booking request has expired",
    title: "Request expired",
    paragraphs: (p) => [
      `${p.barber} didn't reply to your request in time: ${p.what}, on ${p.when}.`,
      "The request has expired and the slot has been freed up. You can choose another one.",
    ],
    action: "Choose another slot",
  },
  bookingReminder: {
    subject: (p) => `Reminder: appointment on ${p.when}`,
    title: "Appointment reminder",
    paragraphs: (p) => [
      `Just a reminder: ${p.what} with ${p.barber}, on ${p.when}.`,
      `Can't make it? Cancel from your appointments up to ${p.cancelDelay} beforehand to free up the slot.`,
    ],
  },
};

const it: EmailStrings = {
  buttonFallback: "Se il pulsante non funziona, copia questo link:",
  defaultFooter: "Ricevi questa email perché hai un account FindBarber.",
  actionLine: (label, url) => `${label}: ${url}`,

  verificationSubject: "Conferma il tuo indirizzo email",
  verificationTitle: "Ti diamo il benvenuto su FindBarber",
  verificationIntro:
    "Conferma il tuo indirizzo email per attivare l'account e poter accedere.",
  verificationValidity: (hours) =>
    `Questo link è valido ${hours} ${hours === 1 ? "ora" : "ore"} e può essere usato una sola volta.`,
  verificationAction: "Conferma il mio indirizzo",
  verificationFooter:
    "Se non hai richiesto tu questa registrazione, ignora questa email.",

  expressSubject: (barber) => `Conferma la tua email per inviare la richiesta a ${barber}`,
  expressTitle: "Ultimo passaggio: conferma la tua email",
  expressIntro: ({ barber, when, what }) =>
    `La tua richiesta presso ${barber} per ${what}, il ${when}, è pronta. Scegli la password del tuo account FindBarber per inviarla: il tuo indirizzo email verrà confermato nello stesso momento.`,
  expressDeadline: (minutes) =>
    `Lo slot è riservato per te per ${minutes} minuti. Senza conferma entro questo tempo, la richiesta viene annullata e lo slot liberato.`,
  expressAction: "Scegli la password e invia la richiesta",
  expressFooter:
    "Se non hai fatto tu questa richiesta, ignora questa email: nessuna prenotazione verrà inviata.",

  resetSubject: "Reimpostazione della password",
  resetTitle: "Reimposta la tua password",
  resetIntro:
    "Hai chiesto di reimpostare la password del tuo account FindBarber.",
  resetValidity: (minutes) =>
    `Questo link è valido ${minutes} minuti e può essere usato una sola volta. Dopo la modifica, le tue altre sessioni verranno disconnesse.`,
  resetAction: "Scegli una nuova password",
  resetFooter:
    "Se non hai chiesto nulla, ignora questa email: la tua password resta invariata.",

  greeting: (first) => (first ? `Ciao ${first},` : "Ciao,"),
  salonTime: (date) => `${date} (ora del salone)`,
  someClient: "Un cliente",
  viewAppointments: "Vedi i miei appuntamenti",
  cancelDelay: (hours) => `${hours} ${hours === 1 ? "ora" : "ore"}`,
  servicePlace: {
    SALON: "In salone",
    AT_PROVIDER: "Presso il professionista",
    AT_CLIENT: "A domicilio del cliente",
  },

  bookingRequested: {
    subject: (p) => `Nuova richiesta di prenotazione — ${p.when}`,
    title: "Nuova richiesta di prenotazione",
    paragraphs: (p) => [
      `${p.client} vorrebbe prenotare: ${p.what}, ${p.when}.`,
      "Conferma o rifiuta la richiesta entro 24 ore; senza risposta, scadrà e la fascia oraria verrà liberata.",
    ],
    action: "Rispondi alla richiesta",
  },
  bookingConfirmed: {
    subject: (p) => `Appuntamento confermato — ${p.when}`,
    title: "Il tuo appuntamento è confermato",
    paragraphs: (p) => [
      `${p.barber} ha confermato il tuo appuntamento: ${p.what}, ${p.when}.`,
      `Puoi annullarlo dai tuoi appuntamenti fino a ${p.cancelDelay} prima.`,
    ],
  },
  bookingDeclined: {
    subject: () => "La tua richiesta di prenotazione è stata rifiutata",
    title: "Richiesta rifiutata",
    paragraphs: (p) => [
      `${p.barber} non può riceverti ${p.when} (${p.what}).`,
      ...(p.reason ? [`Motivo indicato: «${p.reason}»`] : []),
      "La fascia oraria è stata liberata: puoi scegliere un altro orario.",
    ],
    action: "Scegli un'altra fascia oraria",
  },
  bookingCancelledByClient: {
    subject: (p) => `Appuntamento annullato dal cliente — ${p.when}`,
    title: "Appuntamento annullato",
    paragraphs: (p) => [
      `${p.client} ha annullato l'appuntamento: ${p.what}, ${p.when}.`,
      "La fascia oraria è di nuovo disponibile.",
    ],
  },
  bookingCancelledByBarber: {
    subject: (p) => `Appuntamento annullato — ${p.when}`,
    title: "Il tuo appuntamento è stato annullato",
    paragraphs: (p) => [
      `${p.barber} ha annullato il tuo appuntamento: ${p.what}, ${p.when}.`,
      "Puoi prenotare un'altra fascia oraria.",
    ],
    action: "Prenota un'altra fascia oraria",
  },
  bookingCancelledByAdmin: {
    subject: (p) => `Appuntamento annullato — ${p.when}`,
    title: "Appuntamento annullato dall'amministrazione",
    paragraphs: (p) => [
      `L'appuntamento ${p.what} di ${p.when} con ${p.barber} è stato annullato dal team FindBarber.`,
    ],
  },
  bookingExpired: {
    subject: () => "La tua richiesta di prenotazione è scaduta",
    title: "Richiesta scaduta",
    paragraphs: (p) => [
      `${p.barber} non ha risposto in tempo alla tua richiesta: ${p.what}, ${p.when}.`,
      "La richiesta è scaduta e la fascia oraria è stata liberata. Puoi sceglierne un'altra.",
    ],
    action: "Scegli un'altra fascia oraria",
  },
  bookingReminder: {
    subject: (p) => `Promemoria: appuntamento ${p.when}`,
    title: "Promemoria del tuo appuntamento",
    paragraphs: (p) => [
      `Un piccolo promemoria: ${p.what} con ${p.barber}, ${p.when}.`,
      `Un imprevisto? Annulla dai tuoi appuntamenti fino a ${p.cancelDelay} prima per liberare la fascia oraria.`,
    ],
  },
};

const es: EmailStrings = {
  buttonFallback: "Si el botón no funciona, copia este enlace:",
  defaultFooter: "Recibes este email porque tienes una cuenta de FindBarber.",
  actionLine: (label, url) => `${label}: ${url}`,

  verificationSubject: "Confirma tu dirección de email",
  verificationTitle: "Te damos la bienvenida a FindBarber",
  verificationIntro:
    "Confirma tu dirección de email para activar tu cuenta y poder iniciar sesión.",
  verificationValidity: (hours) =>
    `Este enlace es válido durante ${hours} ${hours === 1 ? "hora" : "horas"} y solo se puede usar una vez.`,
  verificationAction: "Confirmar mi dirección",
  verificationFooter:
    "Si no has sido tú quien se ha registrado, ignora este email.",

  expressSubject: (barber) => `Confirma tu email para enviar tu solicitud a ${barber}`,
  expressTitle: "Último paso: confirma tu email",
  expressIntro: ({ barber, when, what }) =>
    `Tu solicitud con ${barber} para ${what}, el ${when}, está lista. Elige la contraseña de tu cuenta de FindBarber para enviarla: tu dirección de email se confirmará al mismo tiempo.`,
  expressDeadline: (minutes) =>
    `El horario queda reservado para ti durante ${minutes} minutos. Sin confirmación en ese plazo, la solicitud se cancela y el horario se libera.`,
  expressAction: "Elegir mi contraseña y enviar mi solicitud",
  expressFooter:
    "Si no has hecho esta solicitud, ignora este email: no se enviará ninguna reserva.",

  resetSubject: "Restablecimiento de tu contraseña",
  resetTitle: "Restablece tu contraseña",
  resetIntro:
    "Has solicitado restablecer la contraseña de tu cuenta de FindBarber.",
  resetValidity: (minutes) =>
    `Este enlace es válido durante ${minutes} minutos y solo se puede usar una vez. Después del cambio, se cerrarán tus demás sesiones.`,
  resetAction: "Elegir una nueva contraseña",
  resetFooter:
    "Si no has solicitado nada, ignora este email: tu contraseña no cambia.",

  greeting: (first) => (first ? `Hola, ${first}:` : "Hola:"),
  salonTime: (date) => `${date} (hora del salón)`,
  someClient: "Un cliente",
  viewAppointments: "Ver mis citas",
  cancelDelay: (hours) => `${hours} ${hours === 1 ? "hora" : "horas"}`,
  servicePlace: {
    SALON: "En el salón",
    AT_PROVIDER: "En casa del profesional",
    AT_CLIENT: "A domicilio",
  },

  bookingRequested: {
    subject: (p) => `Nueva solicitud de reserva — ${p.when}`,
    title: "Nueva solicitud de reserva",
    paragraphs: (p) => [
      `${p.client} quiere reservar: ${p.what}, el ${p.when}.`,
      "Confirma o rechaza la solicitud en un plazo de 24 horas; sin respuesta, caducará y el horario quedará libre.",
    ],
    action: "Responder a la solicitud",
  },
  bookingConfirmed: {
    subject: (p) => `Cita confirmada — ${p.when}`,
    title: "Tu cita está confirmada",
    paragraphs: (p) => [
      `${p.barber} ha confirmado tu cita: ${p.what}, el ${p.when}.`,
      `Puedes cancelarla desde tus citas hasta ${p.cancelDelay} antes.`,
    ],
  },
  bookingDeclined: {
    subject: () => "Tu solicitud de reserva ha sido rechazada",
    title: "Solicitud rechazada",
    paragraphs: (p) => [
      `${p.barber} no puede atenderte el ${p.when} (${p.what}).`,
      ...(p.reason ? [`Motivo indicado: «${p.reason}»`] : []),
      "El horario ha quedado libre: puedes elegir otro.",
    ],
    action: "Elegir otro horario",
  },
  bookingCancelledByClient: {
    subject: (p) => `Cita cancelada por el cliente — ${p.when}`,
    title: "Cita cancelada",
    paragraphs: (p) => [
      `${p.client} ha cancelado su cita: ${p.what}, el ${p.when}.`,
      "El horario vuelve a estar disponible.",
    ],
  },
  bookingCancelledByBarber: {
    subject: (p) => `Cita cancelada — ${p.when}`,
    title: "Tu cita ha sido cancelada",
    paragraphs: (p) => [
      `${p.barber} ha cancelado tu cita: ${p.what}, el ${p.when}.`,
      "Puedes reservar otro horario.",
    ],
    action: "Reservar otro horario",
  },
  bookingCancelledByAdmin: {
    subject: (p) => `Cita cancelada — ${p.when}`,
    title: "Cita cancelada por la administración",
    paragraphs: (p) => [
      `La cita ${p.what} del ${p.when} con ${p.barber} ha sido cancelada por el equipo de FindBarber.`,
    ],
  },
  bookingExpired: {
    subject: () => "Tu solicitud de reserva ha caducado",
    title: "Solicitud caducada",
    paragraphs: (p) => [
      `${p.barber} no ha respondido a tiempo a tu solicitud: ${p.what}, el ${p.when}.`,
      "La solicitud ha caducado y el horario ha quedado libre. Puedes elegir otro.",
    ],
    action: "Elegir otro horario",
  },
  bookingReminder: {
    subject: (p) => `Recordatorio: cita el ${p.when}`,
    title: "Recordatorio de tu cita",
    paragraphs: (p) => [
      `Te recordamos: ${p.what} con ${p.barber}, el ${p.when}.`,
      `¿Algún imprevisto? Cancela desde tus citas hasta ${p.cancelDelay} antes para liberar el horario.`,
    ],
  },
};

/**
 * Dictionnaires par langue. Les langues autres que le français sont partielles
 * par contrat : une clé absente retombe sur le texte français.
 */
export const EMAIL_STRINGS: { fr: EmailStrings } & Record<
  Exclude<Locale, "fr">,
  Partial<EmailStrings>
> = { fr, en, it, es };

/** Langue du destinataire ; valeur inconnue ou absente → français. */
export function resolveEmailLocale(value: string | null | undefined): Locale {
  return value && (LOCALES as readonly string[]).includes(value)
    ? (value as Locale)
    : DEFAULT_LOCALE;
}

export function emailStrings(locale: string | null | undefined): EmailStrings {
  const resolved = resolveEmailLocale(locale);
  if (resolved === "fr") return EMAIL_STRINGS.fr;
  return { ...EMAIL_STRINGS.fr, ...EMAIL_STRINGS[resolved] };
}
