// Données personnelles (issue #14 : nLPD / RGPD) : export JSON, suppression du
// compte par anonymisation (historique et statistiques conservés), chiffrement
// au repos de l'adresse client et purge de rétention.
import { randomUUID } from "node:crypto";
import request from "supertest";
import { and, eq } from "drizzle-orm";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../server/src/app";
import { db } from "../../server/src/db/client";
import { migrateDb } from "../../server/src/db/migrate";
import { encryptField } from "../../server/src/lib/fieldCrypto";
import { purgeExpiredClientAddresses } from "../../server/src/modules/privacy/service";
import {
  auditLogs,
  barberPhotos,
  barberProfiles,
  barberServices,
  bookings,
  emailOutbox,
  notifications,
  passwordResetTokens,
  reviews,
  users,
} from "@findbarber/shared/schema";
import {
  createUser,
  hoursFromNow,
  insertBooking,
  login,
  PASSWORD,
  resetBookingTables,
  seedBarber,
} from "./booking-api-helpers";

const app = createApp();
const CLIENT_EMAIL = "privacy-client@example.com";
const BARBER_EMAIL = "privacy-barber@example.com";
const ADDRESS = "Chemin Privé 7, 1205 Genève";

beforeAll(async () => {
  await migrateDb();
});

beforeEach(async () => {
  await db.delete(auditLogs);
  await db.delete(emailOutbox);
  await resetBookingTables();
});

async function world() {
  const barber = await seedBarber(BARBER_EMAIL);
  const clientId = await createUser(CLIENT_EMAIL, "CLIENT");
  // Rendez-vous passé, à domicile, avec avis.
  const pastId = await insertBooking({
    barber,
    clientUserId: clientId,
    startAt: hoursFromNow(-72),
    status: "COMPLETED",
  });
  await db
    .update(bookings)
    .set({
      servicePlace: "AT_CLIENT",
      clientAddress: encryptField(ADDRESS),
      clientLatitude: 46.19,
      clientLongitude: 6.14,
    })
    .where(eq(bookings.id, pastId));
  const reviewId = randomUUID();
  await db.insert(reviews).values({
    id: reviewId,
    bookingId: pastId,
    rating: 5,
    comment: "Excellent, merci Karim !",
  });
  // Rendez-vous à venir.
  const upcomingId = await insertBooking({
    barber,
    clientUserId: clientId,
    startAt: hoursFromNow(72),
    status: "CONFIRMED",
  });
  return { barber, clientId, pastId, reviewId, upcomingId };
}

function deleteAccount(
  session: Awaited<ReturnType<typeof login>>,
  password: string,
) {
  return session.agent
    .delete("/api/users/me")
    .set("X-CSRF-Token", session.csrf)
    .send({ password });
}

describe("export des données (GET /api/users/me/export)", () => {
  it("client : compte, réservations (adresse déchiffrée), avis, sans secret", async () => {
    const { pastId } = await world();
    await db.insert(passwordResetTokens).values({
      id: randomUUID(),
      userId: (
        await db.select().from(users).where(eq(users.email, CLIENT_EMAIL))
      )[0].id,
      tokenHash: "f".repeat(64),
      expiresAt: hoursFromNow(1),
    });
    const client = await login(app, CLIENT_EMAIL);

    const res = await client.agent.get("/api/users/me/export");
    expect(res.status).toBe(200);
    expect(res.headers["content-disposition"]).toMatch(
      /^attachment; filename="findbarber-mes-donnees-\d{4}-\d{2}-\d{2}\.json"$/,
    );
    expect(res.headers["cache-control"]).toBe("no-store");
    expect(res.body.account).toMatchObject({
      email: CLIENT_EMAIL,
      role: "CLIENT",
    });
    const past = res.body.bookings.find((b: { id: string }) => b.id === pastId);
    expect(past.clientAddress).toBe(ADDRESS);
    expect(res.body.reviews[0]).toMatchObject({
      rating: 5,
      comment: "Excellent, merci Karim !",
    });
    expect(res.body.barber).toBeNull();

    const raw = JSON.stringify(res.body);
    for (const secret of [
      "passwordHash",
      "password_hash",
      "tokenHash",
      "token",
      "fff",
      "enc:v1:",
    ]) {
      expect(raw).not.toContain(secret);
    }
  });

  it("barber : vitrine et activité, sans l'identité ni l'adresse des clients", async () => {
    await world();
    const pro = await login(app, BARBER_EMAIL);
    const res = await pro.agent.get("/api/users/me/export");
    expect(res.status).toBe(200);
    expect(res.body.barber.profile.displayName).toBe("Barbier Test");
    expect(res.body.barber.services[0].name).toBe("Coupe classique");
    expect(res.body.barber.bookingsReceived).toHaveLength(2);
    const raw = JSON.stringify(res.body.barber.bookingsReceived);
    expect(raw).not.toContain(CLIENT_EMAIL);
    expect(raw).not.toContain("Chemin Privé");
    expect(raw).not.toContain("clientUserId");
  });

  it("exige une session", async () => {
    expect((await request(app).get("/api/users/me/export")).status).toBe(401);
  });
});

describe("suppression du compte (DELETE /api/users/me)", () => {
  it("refuse un mauvais mot de passe ou l'absence de CSRF, sans rien modifier", async () => {
    await world();
    const client = await login(app, CLIENT_EMAIL);
    const wrong = await deleteAccount(client, "pas-le-bon");
    expect(wrong.status).toBe(403);
    expect(wrong.body.error.code).toBe("INVALID_PASSWORD");
    const noCsrf = await client.agent
      .delete("/api/users/me")
      .send({ password: PASSWORD });
    expect(noCsrf.status).toBe(403);
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, CLIENT_EMAIL));
    expect(user.status).toBe("ACTIVE");
  });

  it("client : anonymise le compte et l'historique, annule l'à-venir, garde les stats", async () => {
    const { barber, clientId, pastId, reviewId, upcomingId } = await world();
    const client = await login(app, CLIENT_EMAIL);

    const res = await deleteAccount(client, PASSWORD);
    expect(res.status).toBe(204);

    // Compte : pierre tombale sans donnée identifiante.
    const [tomb] = await db.select().from(users).where(eq(users.id, clientId));
    expect(tomb).toMatchObject({
      status: "DELETED",
      name: null,
      avatarPath: null,
      emailVerifiedAt: null,
    });
    expect(tomb.email).toBe(`deleted-${clientId}@deleted.invalid`);
    expect(tomb.deletedAt).not.toBeNull();

    // Historique conservé (statistiques), données privées effacées.
    const [past] = await db
      .select()
      .from(bookings)
      .where(eq(bookings.id, pastId));
    expect(past).toMatchObject({
      status: "COMPLETED",
      clientAddress: null,
      clientLatitude: null,
      clientLongitude: null,
    });
    const [review] = await db
      .select()
      .from(reviews)
      .where(eq(reviews.id, reviewId));
    expect(review).toMatchObject({ rating: 5, comment: null });

    // À venir : annulé, barber prévenu (notification + email en file).
    const [upcoming] = await db
      .select()
      .from(bookings)
      .where(eq(bookings.id, upcomingId));
    expect(upcoming).toMatchObject({
      status: "CANCELLED",
      cancelledBy: "CLIENT",
    });
    const barberNotes = await db
      .select()
      .from(notifications)
      .where(
        and(
          eq(notifications.userId, barber.userId),
          eq(notifications.bookingId, upcomingId),
        ),
      );
    expect(barberNotes.map((n) => n.type)).toEqual([
      "BOOKING_CANCELLED_BY_CLIENT",
    ]);
    const [mail] = await db
      .select()
      .from(emailOutbox)
      .where(eq(emailOutbox.recipientUserId, barber.userId));
    expect(mail.kind).toBe("BOOKING_CANCELLED_BY_CLIENT");

    // Plus de session ni de connexion possible.
    expect((await client.agent.get("/api/auth/me")).status).toBe(401);
    expect(
      (
        await request(app)
          .post("/api/auth/login")
          .send({ email: CLIENT_EMAIL, password: PASSWORD })
      ).status,
    ).toBe(401);

    // Avis public : la note reste dans la moyenne, sans nom ni commentaire.
    const publicReviews = await request(app).get(
      `/api/barbers/${barber.profileId}/reviews`,
    );
    expect(publicReviews.body.summary).toMatchObject({
      totalReviews: 1,
      averageRating: 5,
    });
    expect(publicReviews.body.reviews[0]).toMatchObject({
      clientName: null,
      comment: null,
    });

    // Trace d'audit, sans donnée personnelle.
    const [entry] = await db
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.action, "USER_DELETED"));
    expect(entry).toMatchObject({ actorUserId: clientId, targetId: clientId });
    expect(JSON.stringify(entry)).not.toContain(CLIENT_EMAIL);

    // L'adresse email est libérée : on peut recréer un compte.
    const again = await request(app)
      .post("/api/auth/register")
      .send({ email: CLIENT_EMAIL, password: PASSWORD, role: "CLIENT" });
    expect(again.status).toBe(201);
  });

  it("barber : vitrine retirée et anonymisée, clients prévenus, réservations conservées", async () => {
    const { barber, clientId, upcomingId } = await world();
    await db.insert(barberPhotos).values({
      id: randomUUID(),
      barberProfileId: barber.profileId,
      imagePath: "gallery/does-not-exist.webp",
    });
    const pro = await login(app, BARBER_EMAIL);

    expect((await deleteAccount(pro, PASSWORD)).status).toBe(204);

    expect(
      (await request(app).get(`/api/barbers/${barber.profileId}`)).status,
    ).toBe(404);
    const search = await request(app).get("/api/barbers");
    expect(search.body.barbers).toHaveLength(0);

    const [profile] = await db
      .select()
      .from(barberProfiles)
      .where(eq(barberProfiles.id, barber.profileId));
    expect(profile).toMatchObject({
      displayName: "Professionnel supprimé",
      description: "",
      address: null,
      city: "",
    });
    expect(await db.select().from(barberPhotos)).toHaveLength(0);
    const services = await db.select().from(barberServices);
    expect(services.every((s) => !s.isActive)).toBe(true);

    const [upcoming] = await db
      .select()
      .from(bookings)
      .where(eq(bookings.id, upcomingId));
    expect(upcoming).toMatchObject({
      status: "CANCELLED",
      cancelledBy: "BARBER",
    });
    const clientNotes = await db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, clientId));
    expect(clientNotes.map((n) => n.type)).toContain(
      "BOOKING_CANCELLED_BY_BARBER",
    );
    expect(await db.select().from(bookings)).toHaveLength(2);
  });

  it("un administrateur ne peut pas se supprimer ni gérer un compte supprimé", async () => {
    const { clientId } = await world();
    await createUser("privacy-admin@example.com", "ADMIN");
    const admin = await login(app, "privacy-admin@example.com");
    const self = await deleteAccount(admin, PASSWORD);
    expect(self.status).toBe(403);
    expect(self.body.error.code).toBe("ADMIN_ACCOUNT_DELETION_FORBIDDEN");

    const client = await login(app, CLIENT_EMAIL);
    await deleteAccount(client, PASSWORD).expect(204);
    const suspend = await admin.agent
      .post(`/api/admin/users/${clientId}/suspend`)
      .set("X-CSRF-Token", admin.csrf);
    expect(suspend.status).toBe(409);
    expect(suspend.body.error.code).toBe("USER_DELETED");
    const reactivate = await admin.agent
      .post(`/api/admin/users/${clientId}/reactivate`)
      .set("X-CSRF-Token", admin.csrf);
    expect(reactivate.status).toBe(409);
  });
});

describe("rétention de l'adresse client", () => {
  it("efface adresse et position 30 jours après la fin du rendez-vous", async () => {
    const barber = await seedBarber(BARBER_EMAIL);
    const clientId = await createUser(CLIENT_EMAIL, "CLIENT");
    const old = await insertBooking({
      barber,
      clientUserId: clientId,
      startAt: hoursFromNow(-24 * 31),
      status: "COMPLETED",
    });
    const recent = await insertBooking({
      barber,
      clientUserId: clientId,
      startAt: hoursFromNow(-24 * 10),
      status: "COMPLETED",
    });
    for (const id of [old, recent]) {
      await db
        .update(bookings)
        .set({
          servicePlace: "AT_CLIENT",
          clientAddress: encryptField(ADDRESS),
          clientLatitude: 46.2,
          clientLongitude: 6.1,
        })
        .where(eq(bookings.id, id));
    }

    expect(await purgeExpiredClientAddresses()).toBe(1);
    const [purged] = await db
      .select()
      .from(bookings)
      .where(eq(bookings.id, old));
    expect(purged).toMatchObject({
      clientAddress: null,
      clientLatitude: null,
      clientLongitude: null,
      status: "COMPLETED",
    });
    const [kept] = await db
      .select()
      .from(bookings)
      .where(eq(bookings.id, recent));
    expect(kept.clientAddress).toMatch(/^enc:v1:/);
    expect(await purgeExpiredClientAddresses()).toBe(0);
  });
});
