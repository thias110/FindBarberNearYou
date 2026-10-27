// Réservation express (lot N6) : un visiteur crée son compte à la dernière
// étape du tunnel. Compte non vérifié + demande en attente de l'email (créneau
// bloqué 30 min, invisible du barber) ; le clic sur le lien transmet la
// demande ; sans clic, elle expire sans prévenir personne.
import { randomUUID } from "node:crypto";
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { and, eq } from "drizzle-orm";
import { createApp } from "../../server/src/app";
import { db } from "../../server/src/db/client";
import { migrateDb } from "../../server/src/db/migrate";
import {
  auditLogs,
  barberProfiles,
  bookings,
  emailVerificationTokens,
  notifications,
  passwordResetTokens,
  users,
} from "@findbarber/shared/schema";
import { LIMITS } from "@findbarber/shared/constants";
import {
  hashEmailToken,
  issueEmailVerificationToken,
} from "../../server/src/modules/auth/service";
import { sweepExpiredPendingBookings } from "../../server/src/modules/booking/expiry";
import { configurePaymentsForTests } from "../../server/src/lib/payments";
import { expressBookingEmail } from "../../server/src/lib/emailTemplates";
import {
  PASSWORD,
  createUser,
  futureDate,
  login,
  resetBookingTables,
  seedBarber,
  type SeededBarber,
} from "./booking-api-helpers";

const app = createApp();
const VISITOR = "visiteur@example.com";
const HOLD_MS = LIMITS.expressBookingHoldMinutes * 60_000;

beforeAll(async () => {
  await migrateDb();
});

beforeEach(async () => {
  await db.delete(auditLogs);
  await db.delete(emailVerificationTokens);
  await resetBookingTables();
});

afterEach(() => {
  configurePaymentsForTests(null);
});

function expressBody(barber: SeededBarber, overrides: Record<string, unknown> = {}) {
  return {
    barberId: barber.profileId,
    serviceId: barber.serviceId,
    date: futureDate(3),
    startMinute: 600,
    place: "SALON",
    email: VISITOR,
    password: "MotDePasse123!",
    name: "Visiteur Express",
    locale: "fr",
    ...overrides,
  };
}

async function userByEmail(email: string) {
  const [user] = await db.select().from(users).where(eq(users.email, email));
  return user;
}

async function bookingsOf(userId: string) {
  return db.select().from(bookings).where(eq(bookings.clientUserId, userId));
}

/** Simule le clic sur le lien : un jeton neuf, consommé par la vraie route. */
async function clickLink(userId: string) {
  const token = await issueEmailVerificationToken(userId);
  return request(app).post("/api/auth/verify-email").send({ token });
}

async function barberNotifications(barber: SeededBarber) {
  return db
    .select()
    .from(notifications)
    .where(eq(notifications.userId, barber.userId));
}

describe("POST /api/bookings/express", () => {
  it("crée un compte non vérifié et une demande en attente de l'email", async () => {
    const barber = await seedBarber("express-barber@example.com");
    const before = Date.now();
    const res = await request(app)
      .post("/api/bookings/express")
      .send(expressBody(barber));

    expect(res.status).toBe(201);
    const expiresAt = new Date(res.body.expiresAt).getTime();
    expect(expiresAt).toBeGreaterThanOrEqual(before + HOLD_MS - 1000);
    expect(expiresAt).toBeLessThanOrEqual(Date.now() + HOLD_MS + 1000);
    // Aucune session ouverte : le compte n'est pas vérifié.
    expect(res.headers["set-cookie"]).toBeUndefined();

    const user = await userByEmail(VISITOR);
    expect(user).toBeDefined();
    expect(user!.role).toBe("CLIENT");
    expect(user!.name).toBe("Visiteur Express");
    expect(user!.emailVerifiedAt).toBeNull();

    const [booking] = await bookingsOf(user!.id);
    expect(booking!.status).toBe("PENDING");
    expect(booking!.emailConfirmExpiresAt?.getTime()).toBe(expiresAt);
    // Le barber n'est pas prévenu avant la confirmation de l'email.
    expect(await barberNotifications(barber)).toHaveLength(0);
  });

  it("n'ouvre pas de session et la connexion attend la vérification", async () => {
    const barber = await seedBarber("express-barber@example.com");
    await request(app).post("/api/bookings/express").send(expressBody(barber));
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: VISITOR, password: "MotDePasse123!" });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("EMAIL_NOT_VERIFIED");
  });

  it("bloque le créneau pour les autres clients pendant l'attente", async () => {
    const barber = await seedBarber("express-barber@example.com");
    await request(app).post("/api/bookings/express").send(expressBody(barber));

    await createUser("autre-client@example.com", "CLIENT");
    const other = await login(app, "autre-client@example.com");
    const res = await other.agent
      .post("/api/bookings")
      .set("X-CSRF-Token", other.csrf)
      .send({
        barberId: barber.profileId,
        serviceId: barber.serviceId,
        date: futureDate(3),
        startMinute: 600,
        place: "SALON",
      });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("SLOT_UNAVAILABLE");
  });

  it("cache la demande au barber (liste, détail, transition)", async () => {
    const barber = await seedBarber("express-barber@example.com");
    await request(app).post("/api/bookings/express").send(expressBody(barber));
    const user = await userByEmail(VISITOR);
    const [booking] = await bookingsOf(user!.id);

    const session = await login(app, "express-barber@example.com");
    const list = await session.agent.get("/api/bookings");
    expect(list.body.bookings).toEqual([]);
    expect((await session.agent.get(`/api/bookings/${booking!.id}`)).status).toBe(404);
    const confirm = await session.agent
      .post(`/api/bookings/${booking!.id}/confirm`)
      .set("X-CSRF-Token", session.csrf);
    expect(confirm.status).toBe(404);
  });

  it("demande de se connecter si l'email a déjà un compte (aucune fusion)", async () => {
    const barber = await seedBarber("express-barber@example.com");
    await createUser(VISITOR, "CLIENT");
    const res = await request(app).post("/api/bookings/express").send(expressBody(barber));

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("EMAIL_TAKEN");
    expect(await db.select().from(bookings)).toHaveLength(0);
  });

  it("ne crée rien si le créneau n'est plus libre (compte compris)", async () => {
    const barber = await seedBarber("express-barber@example.com");
    await request(app)
      .post("/api/bookings/express")
      .send(expressBody(barber, { email: "premier@example.com" }));
    const res = await request(app).post("/api/bookings/express").send(expressBody(barber));

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("SLOT_UNAVAILABLE");
    // Une seule transaction : le compte du second visiteur n'existe pas.
    expect(await userByEmail(VISITOR)).toBeUndefined();
  });

  it("est refusée chez un barber qui exige un paiement en ligne", async () => {
    configurePaymentsForTests({
      gateway: {
        createConnectedAccount: async () => ({ id: "acct_x" }),
        createOnboardingLink: async () => "https://connect.stripe.test",
        getAccount: async () => ({ chargesEnabled: true, detailsSubmitted: true }),
        createCheckoutSession: async (input) => ({
          id: `cs_${input.bookingId}`,
          url: "https://checkout.stripe.test",
        }),
        refund: async () => undefined,
      } as never,
      webhookSecret: "whsec_test",
    });
    const barber = await seedBarber("express-barber@example.com");
    await db
      .update(barberProfiles)
      .set({ stripeAccountId: "acct_x", stripeChargesEnabled: true, paymentMode: "FULL" })
      .where(eq(barberProfiles.id, barber.profileId));

    const res = await request(app).post("/api/bookings/express").send(expressBody(barber));
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("EXPRESS_BOOKING_PAYMENT_REQUIRED");
    expect(await userByEmail(VISITOR)).toBeUndefined();
  });

  it("piège à robots : répond comme un succès mais ne crée rien", async () => {
    const barber = await seedBarber("express-barber@example.com");
    const res = await request(app)
      .post("/api/bookings/express")
      .send(expressBody(barber, { website: "https://spam.example" }));

    expect(res.status).toBe(201);
    expect(typeof res.body.expiresAt).toBe("string");
    expect(await userByEmail(VISITOR)).toBeUndefined();
    expect(await db.select().from(bookings)).toHaveLength(0);
  });

  it("valide la saisie (nom, email, mot de passe, champs inconnus)", async () => {
    const barber = await seedBarber("express-barber@example.com");
    const bad = [
      { name: "" },
      { email: "pas-un-email" },
      { password: "court" },
      { role: "ADMIN" },
      { place: "AT_CLIENT" },
    ];
    for (const override of bad) {
      const res = await request(app)
        .post("/api/bookings/express")
        .send(expressBody(barber, override));
      expect(res.status, JSON.stringify(override)).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    }
    expect(await db.select().from(users).where(eq(users.email, VISITOR))).toHaveLength(0);
  });

  it("plafonne les demandes non confirmées chez un même barber", async () => {
    const barber = await seedBarber("express-barber@example.com");
    for (let i = 0; i < LIMITS.expressPendingMaxPerBarber; i += 1) {
      const ok = await request(app)
        .post("/api/bookings/express")
        .send(expressBody(barber, { email: `v${i}@example.com`, startMinute: 600 + i * 30 }));
      expect(ok.status).toBe(201);
    }
    const res = await request(app)
      .post("/api/bookings/express")
      .send(expressBody(barber, { email: "de-trop@example.com", startMinute: 780 }));
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("EXPRESS_BOOKING_TOO_MANY");
    expect(await userByEmail("de-trop@example.com")).toBeUndefined();
  });

  it("limite le débit avec le bucket de l'inscription (429)", async () => {
    const limited = createApp({ rateLimits: { register: { windowMs: 60_000, limit: 1 } } });
    const barber = await seedBarber("express-barber@example.com");
    const first = await request(limited)
      .post("/api/bookings/express")
      .send(expressBody(barber, { website: "robot" }));
    const second = await request(limited)
      .post("/api/bookings/express")
      .send(expressBody(barber, { website: "robot" }));
    expect(first.status).toBe(201);
    expect(second.status).toBe(429);
  });
});

describe("confirmation de l'email (clic sur le lien)", () => {
  it("transmet la demande au barber et le prévient", async () => {
    const barber = await seedBarber("express-barber@example.com");
    await request(app).post("/api/bookings/express").send(expressBody(barber));
    const user = await userByEmail(VISITOR);

    const res = await clickLink(user!.id);
    expect(res.status).toBe(200);
    expect(res.body.verified).toBe(true);
    expect(res.body.expressBooking).toEqual({
      status: "SENT",
      barberName: "Barbier Test",
      barberId: barber.profileId,
    });

    const [booking] = await bookingsOf(user!.id);
    expect(booking!.status).toBe("PENDING");
    expect(booking!.emailConfirmExpiresAt).toBeNull();
    const notes = await barberNotifications(barber);
    expect(notes.map((n) => n.type)).toEqual(["BOOKING_REQUESTED"]);

    // Le barber la voit maintenant, et le client peut se connecter.
    const session = await login(app, "express-barber@example.com");
    expect((await session.agent.get("/api/bookings")).body.bookings).toHaveLength(1);
    const clientLogin = await request(app)
      .post("/api/auth/login")
      .send({ email: VISITOR, password: "MotDePasse123!" });
    expect(clientLogin.status).toBe(200);
  });

  it("après le délai, la demande a expiré et le barber n'est pas prévenu", async () => {
    const barber = await seedBarber("express-barber@example.com");
    await request(app).post("/api/bookings/express").send(expressBody(barber));
    const user = await userByEmail(VISITOR);
    await db
      .update(bookings)
      .set({ emailConfirmExpiresAt: new Date(Date.now() - 1000) })
      .where(eq(bookings.clientUserId, user!.id));

    const res = await clickLink(user!.id);
    expect(res.status).toBe(200);
    expect(res.body.expressBooking).toMatchObject({ status: "EXPIRED" });
    expect(await barberNotifications(barber)).toHaveLength(0);

    // Le compte est bien vérifié pour autant.
    expect((await userByEmail(VISITOR))!.emailVerifiedAt).not.toBeNull();
  });

  it("deux liens cliqués : la demande part une fois, sans faux « délai dépassé »", async () => {
    const barber = await seedBarber("express-barber@example.com");
    await request(app).post("/api/bookings/express").send(expressBody(barber));
    const user = await userByEmail(VISITOR);
    const first = await issueEmailVerificationToken(user!.id);
    const second = await issueEmailVerificationToken(user!.id);

    const a = await request(app).post("/api/auth/verify-email").send({ token: first });
    const b = await request(app).post("/api/auth/verify-email").send({ token: second });
    expect(a.body.expressBooking).toMatchObject({ status: "SENT" });
    expect(b.status).toBe(200);
    expect(b.body.expressBooking).toBeNull();
    expect(await barberNotifications(barber)).toHaveLength(1);
  });

  it("la réinitialisation du mot de passe transmet aussi la demande", async () => {
    const barber = await seedBarber("express-barber@example.com");
    await request(app).post("/api/bookings/express").send(expressBody(barber));
    const user = await userByEmail(VISITOR);
    const token = `reset-${randomUUID()}`;
    await db.insert(passwordResetTokens).values({
      id: randomUUID(),
      userId: user!.id,
      tokenHash: hashEmailToken(token),
      expiresAt: new Date(Date.now() + 3_600_000),
    });

    const res = await request(app)
      .post("/api/auth/reset-password")
      .send({ token, password: "NouveauMotDePasse123!" });
    expect(res.status).toBeLessThan(300);
    const [booking] = await bookingsOf(user!.id);
    expect(booking!.emailConfirmExpiresAt).toBeNull();
    expect((await barberNotifications(barber)).map((n) => n.type)).toEqual([
      "BOOKING_REQUESTED",
    ]);
  });

  it("une inscription ordinaire ne renvoie aucune demande express", async () => {
    const userId = await createUser("ordinaire@example.com", "CLIENT");
    await db.update(users).set({ emailVerifiedAt: null }).where(eq(users.id, userId));
    const res = await clickLink(userId);
    expect(res.status).toBe(200);
    expect(res.body.expressBooking).toBeNull();
  });
});

describe("expiration sans clic", () => {
  it("libère le créneau, passe en EXPIRED et ne notifie personne", async () => {
    const barber = await seedBarber("express-barber@example.com");
    await request(app).post("/api/bookings/express").send(expressBody(barber));
    const user = await userByEmail(VISITOR);

    const expired = await sweepExpiredPendingBookings(new Date(Date.now() + HOLD_MS + 1000));
    expect(expired).toBe(1);
    const [booking] = await bookingsOf(user!.id);
    expect(booking!.status).toBe("EXPIRED");
    expect(await db.select().from(notifications)).toHaveLength(0);

    // Toujours invisible pour le barber, même expirée.
    const session = await login(app, "express-barber@example.com");
    expect((await session.agent.get("/api/bookings")).body.bookings).toEqual([]);
  });

  it("le créneau redevient réservable dès l'échéance, avant même le balayage", async () => {
    const barber = await seedBarber("express-barber@example.com");
    await request(app).post("/api/bookings/express").send(expressBody(barber));
    await db
      .update(bookings)
      .set({ emailConfirmExpiresAt: new Date(Date.now() - 1000) })
      .where(and(eq(bookings.barberProfileId, barber.profileId)));

    await createUser("autre-client@example.com", "CLIENT");
    const other = await login(app, "autre-client@example.com");
    const res = await other.agent
      .post("/api/bookings")
      .set("X-CSRF-Token", other.csrf)
      .send({
        barberId: barber.profileId,
        serviceId: barber.serviceId,
        date: futureDate(3),
        startMinute: 600,
        place: "SALON",
      });
    expect(res.status).toBe(201);
  });
});

describe("annulations système", () => {
  it("la suppression du compte du barber ne prévient pas un visiteur non confirmé", async () => {
    const barber = await seedBarber("express-barber@example.com");
    await request(app).post("/api/bookings/express").send(expressBody(barber));
    const session = await login(app, "express-barber@example.com");
    const res = await session.agent
      .delete("/api/users/me")
      .set("X-CSRF-Token", session.csrf)
      .send({ password: PASSWORD });
    expect(res.status).toBe(204);

    const user = await userByEmail(VISITOR);
    const [booking] = await bookingsOf(user!.id);
    expect(booking!.status).toBe("CANCELLED");
    expect(
      await db.select().from(notifications).where(eq(notifications.userId, user!.id)),
    ).toHaveLength(0);
  });
});

describe("email combiné (vérification et récapitulatif)", () => {
  it("contient le lien de vérification, le barber, l'heure du salon et le délai", () => {
    const mail = expressBookingEmail("a@example.com", "jeton-brut", "fr", {
      barberName: "Barbier <Test>",
      serviceName: "Coupe classique",
      servicePlace: "SALON",
      startAt: new Date("2030-03-04T10:00:00Z"),
      timeZone: "Europe/Zurich",
      minutes: 30,
    });
    expect(mail.subject).toContain("Barbier <Test>");
    expect(mail.text).toContain("/verify-email?token=jeton-brut");
    expect(mail.text).toContain("Coupe classique");
    expect(mail.text).toContain("11:00");
    expect(mail.text).toContain("30 minutes");
    // Le HTML échappe le nom du barber.
    expect(mail.html).toContain("Barbier &lt;Test&gt;");
    expect(mail.html).not.toContain("Barbier <Test>");
  });

  it("existe dans les 4 langues", () => {
    const subjects = ["fr", "en", "it", "es"].map(
      (locale) =>
        expressBookingEmail("a@example.com", "t", locale, {
          barberName: "B",
          serviceName: "S",
          servicePlace: "SALON",
          startAt: new Date("2030-03-04T10:00:00Z"),
          timeZone: "UTC",
          minutes: 30,
        }).subject,
    );
    expect(new Set(subjects).size).toBe(4);
  });
});
