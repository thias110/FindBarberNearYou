// Emails transactionnels (issue #9) : mise en file dans la transaction de la
// réservation, envoi après commit par le répartiteur (transport mémoire, aucun
// envoi réel), nouvelles tentatives après une panne SMTP, rappel J-1 unique.
import { eq } from "drizzle-orm";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../server/src/app";
import { db } from "../../server/src/db/client";
import { migrateDb } from "../../server/src/db/migrate";
import { sweepExpiredPendingBookings } from "../../server/src/modules/booking/expiry";
import {
  dispatchEmailOutbox,
  enqueueDueReminders,
  purgeEmailOutbox,
} from "../../server/src/modules/email/outbox";
import {
  clearSentEmails,
  sentEmails,
  simulateMailFailures,
} from "../../server/src/lib/mailer";
import { bookingEmail } from "../../server/src/lib/emailTemplates";
import { emailOutbox, users } from "@findbarber/shared/schema";
import {
  createUser,
  futureDate,
  hoursFromNow,
  insertBooking,
  login,
  resetBookingTables,
  seedBarber,
  type SeededBarber,
  type Session,
} from "./booking-api-helpers";

const app = createApp();

const BARBER_EMAIL = "mail-barber@example.com";
const CLIENT_EMAIL = "mail-client@example.com";

beforeAll(async () => {
  await migrateDb();
});

beforeEach(async () => {
  await db.delete(emailOutbox);
  await resetBookingTables();
  clearSentEmails();
});

async function world() {
  const barber = await seedBarber(BARBER_EMAIL, { timezone: "Europe/Zurich" });
  const clientId = await createUser(CLIENT_EMAIL, "CLIENT");
  return { barber, clientId };
}

function book(
  session: Session,
  barber: SeededBarber,
  date: string,
  startMinute: number,
) {
  return session.agent
    .post("/api/bookings")
    .set("X-CSRF-Token", session.csrf)
    .send({
      barberId: barber.profileId,
      serviceId: barber.serviceId,
      date,
      startMinute,
      place: "SALON",
    });
}

function mailsTo(email: string) {
  return sentEmails().filter((mail) => mail.to === email);
}

describe("emails de réservation", () => {
  it("nouvelle demande → barber, confirmation → client, heure du salon", async () => {
    const { barber } = await world();
    const client = await login(app, CLIENT_EMAIL);
    const created = await book(client, barber, futureDate(3), 600); // 10:00 Zurich
    expect(created.status).toBe(201);

    // Rien n'est envoyé pendant la requête : la ligne attend dans la file.
    expect(sentEmails()).toHaveLength(0);
    expect(await dispatchEmailOutbox()).toEqual({ sent: 1, failed: 0 });

    const [request] = mailsTo(BARBER_EMAIL);
    expect(request.subject).toContain("Nouvelle demande de réservation");
    expect(request.text).toContain("Coupe classique");
    expect(request.text).toContain("10:00");
    expect(request.html).toContain("/pro/bookings");

    const pro = await login(app, BARBER_EMAIL);
    await pro.agent
      .post(`/api/bookings/${created.body.booking.id}/confirm`)
      .set("X-CSRF-Token", pro.csrf)
      .expect(200);
    await dispatchEmailOutbox();

    const [confirmed] = mailsTo(CLIENT_EMAIL);
    expect(confirmed.subject).toContain("Rendez-vous confirmé");
    expect(confirmed.text).toContain("10:00");
    expect(confirmed.text).toContain("/appointments");
  });

  it("refus avec motif : le motif est transmis et échappé en HTML", async () => {
    const { barber } = await world();
    const client = await login(app, CLIENT_EMAIL);
    const created = await book(client, barber, futureDate(3), 660);
    const pro = await login(app, BARBER_EMAIL);
    await pro.agent
      .post(`/api/bookings/${created.body.booking.id}/decline`)
      .set("X-CSRF-Token", pro.csrf)
      .send({ reason: "Absent <b>ce jour</b>" })
      .expect(200);
    await dispatchEmailOutbox();

    const [declined] = mailsTo(CLIENT_EMAIL);
    expect(declined.subject).toContain("refusée");
    expect(declined.text).toContain("Absent <b>ce jour</b>");
    expect(declined.html).toContain("Absent &lt;b&gt;ce jour&lt;/b&gt;");
    expect(declined.html).not.toContain("<b>ce jour</b>");
  });

  it("annulation : par le client → barber ; par l'admin → les deux", async () => {
    const { barber, clientId } = await world();
    await createUser("mail-admin@example.com", "ADMIN");
    const first = await insertBooking({
      barber,
      clientUserId: clientId,
      startAt: hoursFromNow(72),
    });
    const second = await insertBooking({
      barber,
      clientUserId: clientId,
      startAt: hoursFromNow(96),
      status: "CONFIRMED",
    });

    const client = await login(app, CLIENT_EMAIL);
    await client.agent
      .post(`/api/bookings/${first}/cancel`)
      .set("X-CSRF-Token", client.csrf)
      .expect(200);
    const admin = await login(app, "mail-admin@example.com");
    await admin.agent
      .post(`/api/admin/bookings/${second}/cancel`)
      .set("X-CSRF-Token", admin.csrf)
      .expect(200);
    await dispatchEmailOutbox();

    expect(mailsTo(BARBER_EMAIL).map((m) => m.subject)).toEqual([
      expect.stringContaining("annulé par le client"),
      expect.stringContaining("Rendez-vous annulé"),
    ]);
    expect(mailsTo(CLIENT_EMAIL).map((m) => m.subject)).toEqual([
      expect.stringContaining("Rendez-vous annulé"),
    ]);
    expect(mailsTo(CLIENT_EMAIL)[0].text).toContain("équipe FindBarber");
  });

  it("expiration : email au client seulement", async () => {
    const { barber, clientId } = await world();
    await insertBooking({
      barber,
      clientUserId: clientId,
      startAt: hoursFromNow(72),
      createdAt: hoursFromNow(-25),
    });
    expect(await sweepExpiredPendingBookings()).toBe(1);
    await dispatchEmailOutbox();

    expect(mailsTo(CLIENT_EMAIL)).toHaveLength(1);
    expect(mailsTo(CLIENT_EMAIL)[0].subject).toContain("a expiré");
    expect(mailsTo(BARBER_EMAIL)).toHaveLength(0);
  });

  it("aucun email vers un compte suspendu", async () => {
    const { barber, clientId } = await world();
    const id = await insertBooking({
      barber,
      clientUserId: clientId,
      startAt: hoursFromNow(72),
    });
    await db
      .update(users)
      .set({ status: "SUSPENDED" })
      .where(eq(users.id, clientId));
    const pro = await login(app, BARBER_EMAIL);
    await pro.agent
      .post(`/api/bookings/${id}/confirm`)
      .set("X-CSRF-Token", pro.csrf)
      .expect(200);
    await dispatchEmailOutbox();
    expect(sentEmails()).toHaveLength(0);
  });
});

describe("robustesse de l'envoi", () => {
  it("une panne SMTP ne casse pas la réservation et l'email est retenté", async () => {
    const { barber } = await world();
    simulateMailFailures(1);
    const client = await login(app, CLIENT_EMAIL);
    expect((await book(client, barber, futureDate(4), 600)).status).toBe(201);

    const now = new Date();
    expect(await dispatchEmailOutbox(now)).toEqual({ sent: 0, failed: 1 });
    const [row] = await db.select().from(emailOutbox);
    expect(row).toMatchObject({ status: "PENDING", attempts: 1 });
    expect(row.lastError).toContain("Simulated SMTP failure");
    expect(row.nextAttemptAt.getTime()).toBeGreaterThan(now.getTime());

    // Pas avant le délai de nouvelle tentative…
    expect(await dispatchEmailOutbox(now)).toEqual({ sent: 0, failed: 0 });
    // … puis envoyé.
    expect(
      await dispatchEmailOutbox(new Date(now.getTime() + 2 * 60_000)),
    ).toEqual({ sent: 1, failed: 0 });
    expect(mailsTo(BARBER_EMAIL)).toHaveLength(1);
  });

  it("abandonne après 6 échecs (FAILED) et purge les emails envoyés après 7 jours", async () => {
    const { barber } = await world();
    const client = await login(app, CLIENT_EMAIL);
    await book(client, barber, futureDate(4), 660);

    simulateMailFailures(6);
    let at = Date.now();
    for (let i = 0; i < 6; i += 1) {
      await dispatchEmailOutbox(new Date(at));
      at += 7 * 3_600_000;
    }
    const [failed] = await db.select().from(emailOutbox);
    expect(failed).toMatchObject({ status: "FAILED", attempts: 6 });

    await db
      .update(emailOutbox)
      .set({ status: "SENT", sentAt: new Date(Date.now() - 8 * 86_400_000) });
    await purgeEmailOutbox();
    expect(await db.select().from(emailOutbox)).toHaveLength(0);
  });
});

describe("rappel J-1", () => {
  it("un seul rappel, uniquement pour les rendez-vous confirmés dans moins de 24 h", async () => {
    const { barber, clientId } = await world();
    const soon = await insertBooking({
      barber,
      clientUserId: clientId,
      startAt: hoursFromNow(20),
      status: "CONFIRMED",
    });
    await insertBooking({
      barber,
      clientUserId: clientId,
      startAt: hoursFromNow(30),
      status: "CONFIRMED",
    });
    await insertBooking({
      barber,
      clientUserId: clientId,
      startAt: hoursFromNow(0.5),
      status: "CONFIRMED",
    });
    await insertBooking({
      barber,
      clientUserId: clientId,
      startAt: hoursFromNow(22),
      status: "PENDING",
    });

    expect(await enqueueDueReminders()).toBe(1);
    expect(await enqueueDueReminders()).toBe(0);
    await dispatchEmailOutbox();

    const reminders = mailsTo(CLIENT_EMAIL);
    expect(reminders).toHaveLength(1);
    expect(reminders[0].subject).toContain("Rappel");
    const [row] = await db.select().from(emailOutbox);
    expect(row.bookingId).toBe(soon);
  });
});

describe("gabarits", () => {
  it("échappe les données variables dans le HTML", () => {
    const mail = bookingEmail(
      "BOOKING_REQUESTED",
      {
        to: "x@example.com",
        recipientName: "<img src=x onerror=alert(1)>",
        barberName: "Barber",
        barberProfileId: "p1",
        clientName: "<script>alert(1)</script>",
        serviceName: "Coupe",
        placeLabel: "En salon",
        startAt: new Date("2026-11-03T09:00:00Z"),
        timeZone: "Europe/Zurich",
      },
      true,
    );
    expect(mail.html).not.toContain("<script>");
    expect(mail.html).not.toContain("<img src=x");
    expect(mail.html).toContain("&lt;script&gt;");
    expect(mail.text).toContain("10:00");
  });
});
