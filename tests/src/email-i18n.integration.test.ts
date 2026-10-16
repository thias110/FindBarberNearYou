// Emails transactionnels traduits (issue #36) : objet et contenu dans la
// langue du DESTINATAIRE (`users.locale`), jamais celle de l'auteur de
// l'action ; date formatée selon la langue, heure dans le fuseau du salon ;
// langue inconnue ou absente → français.
import request from "supertest";
import { eq } from "drizzle-orm";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { LOCALES, type Locale } from "@findbarber/shared/constants";
import { emailOutbox, users } from "@findbarber/shared/schema";
import { createApp } from "../../server/src/app";
import { db } from "../../server/src/db/client";
import { migrateDb } from "../../server/src/db/migrate";
import { dispatchEmailOutbox } from "../../server/src/modules/email/outbox";
import { clearSentEmails, sentEmails } from "../../server/src/lib/mailer";
import {
  EMAIL_STRINGS,
  emailStrings,
} from "../../server/src/lib/emailI18n";
import {
  bookingEmail,
  formatBookingDate,
  passwordResetEmail,
  verificationEmail,
  type BookingEmailContext,
} from "../../server/src/lib/emailTemplates";
import {
  createUser,
  futureDate,
  login,
  resetBookingTables,
  seedBarber,
} from "./booking-api-helpers";

const app = createApp();

beforeAll(async () => {
  await migrateDb();
});

beforeEach(async () => {
  await db.delete(emailOutbox);
  await resetBookingTables();
  clearSentEmails();
});

async function setLocale(userId: string, locale: Locale) {
  await db.update(users).set({ locale }).where(eq(users.id, userId));
}

function mailsTo(email: string) {
  return sentEmails().filter((mail) => mail.to === email);
}

// 3 novembre 2026, 09:00 UTC = 10:00 à Zurich, 18:00 à Tokyo.
const START = new Date("2026-11-03T09:00:00Z");

function ctx(overrides: Partial<BookingEmailContext> = {}): BookingEmailContext {
  return {
    to: "x@example.com",
    recipientName: "Alex Martin",
    barberName: "Barber <Test>",
    barberProfileId: "p1",
    clientName: "Sam",
    serviceName: "Coupe",
    servicePlace: "AT_CLIENT",
    startAt: START,
    timeZone: "Europe/Zurich",
    ...overrides,
  };
}

describe("dictionnaires", () => {
  it("chaque langue définit toutes les clés du français", () => {
    const keys = Object.keys(EMAIL_STRINGS.fr).sort();
    for (const locale of LOCALES) {
      expect(Object.keys(EMAIL_STRINGS[locale]).sort(), locale).toEqual(keys);
    }
  });

  it("une clé absente retombe sur le français", () => {
    const original = EMAIL_STRINGS.en.someClient;
    delete EMAIL_STRINGS.en.someClient;
    try {
      expect(emailStrings("en").someClient).toBe("Un client");
      expect(emailStrings("en").viewAppointments).toBe("View my appointments");
    } finally {
      EMAIL_STRINGS.en.someClient = original;
    }
  });
});

describe("gabarits par langue", () => {
  it("date formatée selon la langue, dans le fuseau du salon", () => {
    expect(formatBookingDate(START, "Europe/Zurich", "fr")).toBe(
      "mardi 3 novembre 2026 à 10:00",
    );
    expect(formatBookingDate(START, "Europe/Zurich", "en")).toBe(
      "Tuesday, 3 November 2026 at 10:00",
    );
    expect(formatBookingDate(START, "Europe/Zurich", "it")).toContain(
      "martedì 3 novembre 2026",
    );
    expect(formatBookingDate(START, "Europe/Zurich", "es")).toContain(
      "martes, 3 de noviembre de 2026",
    );
    expect(formatBookingDate(START, "Asia/Tokyo", "en")).toContain("18:00");
  });

  it.each([
    ["en", "Appointment confirmed", "Tuesday, 3 November 2026 at 10:00 (salon time)", "At the client's home", "Hello Alex,"],
    ["it", "Appuntamento confermato", "martedì 3 novembre 2026", "A domicilio del cliente", "Ciao Alex,"],
    ["es", "Cita confirmada", "martes, 3 de noviembre de 2026", "A domicilio", "Hola, Alex:"],
    ["fr", "Rendez-vous confirmé", "mardi 3 novembre 2026 à 10:00 (heure du salon)", "Chez le client", "Bonjour Alex,"],
  ] as const)(
    "réservation en %s : objet, date, lieu et salutation traduits",
    (locale, subject, date, place, hello) => {
      const mail = bookingEmail("BOOKING_CONFIRMED", ctx({ locale }), false);
      expect(mail.subject).toContain(subject);
      expect(mail.subject).toContain(date);
      expect(mail.text).toContain(place);
      expect(mail.text).toContain(hello);
      expect(mail.text).toContain("10:00");
      expect(mail.html).toContain(`<html lang="${locale}">`);
      // Échappement conservé dans toutes les langues.
      expect(mail.html).toContain("Barber &lt;Test&gt;");
      expect(mail.html).not.toContain("Barber <Test>");
    },
  );

  it("motif de refus traduit et échappé", () => {
    const mail = bookingEmail(
      "BOOKING_DECLINED",
      ctx({ locale: "it", declineReason: "  <b>Chiuso</b> " }),
      false,
    );
    expect(mail.subject).toBe(
      "La tua richiesta di prenotazione è stata rifiutata",
    );
    expect(mail.text).toContain("Motivo indicato: «<b>Chiuso</b>»");
    expect(mail.html).toContain("&lt;b&gt;Chiuso&lt;/b&gt;");
    expect(mail.html).toContain("/barbers/p1");
  });

  it("langue inconnue ou absente → français", () => {
    for (const locale of [undefined, null, "de", ""]) {
      const mail = bookingEmail("BOOKING_REMINDER", ctx({ locale }), false);
      expect(mail.subject).toContain("Rappel : rendez-vous le mardi");
      expect(mail.html).toContain('<html lang="fr">');
    }
    expect(verificationEmail("a@example.com", "t", "xx").subject).toBe(
      "Confirmez votre adresse email",
    );
    expect(passwordResetEmail("a@example.com", "t").subject).toBe(
      "Réinitialisation de votre mot de passe",
    );
  });

  it("vérification et réinitialisation traduites", () => {
    expect(verificationEmail("a@example.com", "t", "es").subject).toBe(
      "Confirma tu dirección de email",
    );
    const reset = passwordResetEmail("a@example.com", "t", "en");
    expect(reset.subject).toBe("Reset your password");
    expect(reset.text).toContain("Choose a new password: http");
    expect(reset.html).toContain("If the button doesn&#39;t work");
  });
});

describe("langue du destinataire de bout en bout", () => {
  it("client EN qui réserve chez un barber IT : le barber reçoit en IT, le client en EN", async () => {
    const barber = await seedBarber("i18n-barber@example.com", {
      timezone: "Europe/Zurich",
    });
    await setLocale(barber.userId, "it");
    const clientId = await createUser("i18n-client@example.com", "CLIENT");
    await setLocale(clientId, "en");

    const client = await login(app, "i18n-client@example.com");
    const created = await client.agent
      .post("/api/bookings")
      .set("X-CSRF-Token", client.csrf)
      .send({
        barberId: barber.profileId,
        serviceId: barber.serviceId,
        date: futureDate(3),
        startMinute: 600,
        place: "SALON",
      });
    expect(created.status).toBe(201);
    await dispatchEmailOutbox();

    const [toBarber] = mailsTo("i18n-barber@example.com");
    expect(toBarber.subject).toContain("Nuova richiesta di prenotazione");
    expect(toBarber.text).toContain("In salone");
    expect(toBarber.text).toContain("alle ore 10:00 (ora del salone)");

    const pro = await login(app, "i18n-barber@example.com");
    await pro.agent
      .post(`/api/bookings/${created.body.booking.id}/confirm`)
      .set("X-CSRF-Token", pro.csrf)
      .expect(200);
    await dispatchEmailOutbox();

    const [toClient] = mailsTo("i18n-client@example.com");
    expect(toClient.subject).toContain("Appointment confirmed");
    expect(toClient.text).toContain("In the salon");
    expect(toClient.text).toContain("at 10:00 (salon time)");
  });

  it("inscription : l'email de vérification part dans la langue choisie", async () => {
    await request(app)
      .post("/api/auth/register")
      .send({
        email: "i18n-signup@example.com",
        password: "MotDePasseSolide42!",
        role: "CLIENT",
        locale: "es",
      })
      .expect(201);
    const [mail] = mailsTo("i18n-signup@example.com");
    expect(mail.subject).toBe("Confirma tu dirección de email");
    expect(mail.text).toContain("/verify-email?token=");
  });

  it("mot de passe oublié : email dans la langue du compte", async () => {
    const userId = await createUser("i18n-reset@example.com", "CLIENT");
    await setLocale(userId, "it");
    await request(app)
      .post("/api/auth/forgot-password")
      .send({ email: "i18n-reset@example.com" })
      .expect(202);
    const [mail] = mailsTo("i18n-reset@example.com");
    expect(mail.subject).toBe("Reimpostazione della password");
    expect(mail.text).toContain("Scegli una nuova password: http");
  });
});
