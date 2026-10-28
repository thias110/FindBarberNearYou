// Moteur de réservation, lot 4 rouvert : refus, expiration 24 h, actions
// ADMIN, droits par rôle, concurrence, hors horaires et changements d'heure.
// Vraie base PGlite en mémoire, requêtes HTTP réelles (supertest).
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { and, eq } from "drizzle-orm";
import request from "supertest";
import { createApp } from "../../server/src/app";
import { db } from "../../server/src/db/client";
import { migrateDb } from "../../server/src/db/migrate";
import { sweepExpiredPendingBookings } from "../../server/src/modules/booking/expiry";
import {
  barberTimeOff,
  bookings,
  notifications,
} from "@findbarber/shared/schema";
import { weekdayFromCalendarDate } from "@findbarber/shared/dates";
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

beforeAll(async () => {
  await migrateDb();
});

beforeEach(async () => {
  await resetBookingTables();
});

afterEach(() => {
  vi.useRealTimers();
});

async function rowOf(id: string) {
  const [row] = await db.select().from(bookings).where(eq(bookings.id, id));
  return row;
}

async function notificationTypesFor(userId: string, bookingId: string) {
  const rows = await db
    .select({ type: notifications.type })
    .from(notifications)
    .where(and(eq(notifications.userId, userId), eq(notifications.bookingId, bookingId)));
  return rows.map((row) => row.type).sort();
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

// Route publique des créneaux : aucune session nécessaire.
function slots(barber: SeededBarber, date: string) {
  return request(app)
    .get(`/api/barbers/${barber.profileId}/slots`)
    .query({ serviceId: barber.serviceId, date, place: "SALON" });
}

interface World {
  barber: SeededBarber;
  clientId: string;
  barberSession: Session;
  clientSession: Session;
}

async function world(options: Parameters<typeof seedBarber>[1] = {}): Promise<World> {
  const barber = await seedBarber("eng-barber@example.com", options);
  const clientId = await createUser("eng-client@example.com", "CLIENT");
  return {
    barber,
    clientId,
    barberSession: await login(app, "eng-barber@example.com"),
    clientSession: await login(app, "eng-client@example.com"),
  };
}

// --- 1. Refus par le barber -------------------------------------------------

describe("refus d'une demande (DECLINED)", () => {
  it("le barber refuse avec motif : statut, motif, créneau libéré, client notifié", async () => {
    const w = await world();
    const date = futureDate(7);
    const created = await book(w.clientSession, w.barber, date, 540);
    expect(created.status).toBe(201);
    const id = created.body.booking.id as string;

    const declined = await w.barberSession.agent
      .post(`/api/bookings/${id}/decline`)
      .set("X-CSRF-Token", w.barberSession.csrf)
      .send({ reason: "Indisponible ce jour-là" });
    expect(declined.status).toBe(200);
    expect(declined.body.booking.status).toBe("DECLINED");
    expect(declined.body.booking.declineReason).toBe("Indisponible ce jour-là");
    expect(declined.body.booking.declinedAt).toBeTruthy();

    // Le client voit le refus et le motif.
    const list = await w.clientSession.agent.get("/api/bookings");
    const mine = list.body.bookings.find((b: { id: string }) => b.id === id);
    expect(mine.status).toBe("DECLINED");
    expect(mine.declineReason).toBe("Indisponible ce jour-là");
    expect(await notificationTypesFor(w.clientId, id)).toEqual(["BOOKING_DECLINED"]);

    // Créneau libéré : un autre client peut le réserver.
    await createUser("eng-other@example.com", "CLIENT");
    const other = await login(app, "eng-other@example.com");
    expect((await book(other, w.barber, date, 540)).status).toBe(201);
  });

  it("refus sans motif ; refus impossible deux fois ou sur une réservation confirmée", async () => {
    const w = await world();
    const pendingId = await insertBooking({
      barber: w.barber,
      clientUserId: w.clientId,
      startAt: hoursFromNow(48),
    });
    const ok = await w.barberSession.agent
      .post(`/api/bookings/${pendingId}/decline`)
      .set("X-CSRF-Token", w.barberSession.csrf);
    expect(ok.status).toBe(200);
    expect(ok.body.booking.declineReason).toBeNull();

    const again = await w.barberSession.agent
      .post(`/api/bookings/${pendingId}/decline`)
      .set("X-CSRF-Token", w.barberSession.csrf);
    expect(again.status).toBe(409);
    expect(again.body.error.code).toBe("INVALID_STATUS_TRANSITION");

    // Statut terminal : ni confirmation ni annulation après un refus.
    const confirm = await w.barberSession.agent
      .post(`/api/bookings/${pendingId}/confirm`)
      .set("X-CSRF-Token", w.barberSession.csrf);
    expect(confirm.status).toBe(409);

    const confirmedId = await insertBooking({
      barber: w.barber,
      clientUserId: w.clientId,
      startAt: hoursFromNow(72),
      status: "CONFIRMED",
    });
    const onConfirmed = await w.barberSession.agent
      .post(`/api/bookings/${confirmedId}/decline`)
      .set("X-CSRF-Token", w.barberSession.csrf);
    expect(onConfirmed.status).toBe(409);
    expect((await rowOf(confirmedId)).status).toBe("CONFIRMED");
  });

  it("droits : CLIENT 403, autre barber 404, sans CSRF 403, motif trop long ou champ inconnu 400", async () => {
    const w = await world();
    const id = await insertBooking({
      barber: w.barber,
      clientUserId: w.clientId,
      startAt: hoursFromNow(48),
    });

    const asClient = await w.clientSession.agent
      .post(`/api/bookings/${id}/decline`)
      .set("X-CSRF-Token", w.clientSession.csrf);
    expect(asClient.status).toBe(403);

    await seedBarber("eng-rival@example.com");
    const rival = await login(app, "eng-rival@example.com");
    const asRival = await rival.agent
      .post(`/api/bookings/${id}/decline`)
      .set("X-CSRF-Token", rival.csrf);
    expect(asRival.status).toBe(404);
    expect(asRival.body.error.code).toBe("BOOKING_NOT_FOUND");

    const noCsrf = await w.barberSession.agent.post(`/api/bookings/${id}/decline`);
    expect(noCsrf.status).toBe(403);

    const tooLong = await w.barberSession.agent
      .post(`/api/bookings/${id}/decline`)
      .set("X-CSRF-Token", w.barberSession.csrf)
      .send({ reason: "x".repeat(501) });
    expect(tooLong.status).toBe(400);

    const unknown = await w.barberSession.agent
      .post(`/api/bookings/${id}/decline`)
      .set("X-CSRF-Token", w.barberSession.csrf)
      .send({ reason: "ok", status: "CONFIRMED" });
    expect(unknown.status).toBe(400);

    expect((await rowOf(id)).status).toBe("PENDING");
  });
});

// --- 2. Expiration après 24 h -----------------------------------------------

describe("expiration des demandes PENDING", () => {
  it("une demande de plus de 24 h libère le créneau, ne peut plus être confirmée, s'affiche EXPIRED", async () => {
    const w = await world();
    const date = futureDate(7);
    const created = await book(w.clientSession, w.barber, date, 540);
    const id = created.body.booking.id as string;
    expect(created.body.booking.expiresAt).toBeTruthy();

    // Créée il y a 24 h + 1 min (pas encore balayée).
    await db
      .update(bookings)
      .set({ createdAt: new Date(Date.now() - (24 * 60 + 1) * 60_000) })
      .where(eq(bookings.id, id));

    const slotRes = await slots(w.barber, date);
    expect(slotRes.body.slots.map((s: { startMinute: number }) => s.startMinute)).toContain(540);

    const confirm = await w.barberSession.agent
      .post(`/api/bookings/${id}/confirm`)
      .set("X-CSRF-Token", w.barberSession.csrf);
    expect(confirm.status).toBe(409);
    expect(confirm.body.error.code).toBe("BOOKING_EXPIRED");

    const decline = await w.barberSession.agent
      .post(`/api/bookings/${id}/decline`)
      .set("X-CSRF-Token", w.barberSession.csrf);
    expect(decline.status).toBe(409);

    const list = await w.clientSession.agent.get("/api/bookings");
    expect(list.body.bookings[0].status).toBe("EXPIRED");

    // Le créneau se réserve à nouveau : la demande échue est persistée EXPIRED
    // sous verrou avant l'insertion (pas de conflit avec la contrainte).
    await createUser("eng-other@example.com", "CLIENT");
    const other = await login(app, "eng-other@example.com");
    expect((await book(other, w.barber, date, 540)).status).toBe(201);
    expect((await rowOf(id)).status).toBe("EXPIRED");
  });

  it("à 23 h 59 la demande bloque encore le créneau et reste confirmable", async () => {
    const w = await world();
    const date = futureDate(7);
    const created = await book(w.clientSession, w.barber, date, 540);
    const id = created.body.booking.id as string;
    await db
      .update(bookings)
      .set({ createdAt: new Date(Date.now() - (24 * 60 - 1) * 60_000) })
      .where(eq(bookings.id, id));

    const slotRes = await slots(w.barber, date);
    expect(slotRes.body.slots.map((s: { startMinute: number }) => s.startMinute)).not.toContain(540);

    const confirm = await w.barberSession.agent
      .post(`/api/bookings/${id}/confirm`)
      .set("X-CSRF-Token", w.barberSession.csrf);
    expect(confirm.status).toBe(200);
  });

  it("le balayage persiste EXPIRED, notifie client et barber, et est idempotent", async () => {
    const w = await world();
    const stale = await insertBooking({
      barber: w.barber,
      clientUserId: w.clientId,
      startAt: hoursFromNow(72),
      createdAt: hoursFromNow(-25),
    });
    // Rendez-vous déjà commencé : expire même avant 24 h.
    const started = await insertBooking({
      barber: w.barber,
      clientUserId: w.clientId,
      startAt: hoursFromNow(-1),
      createdAt: hoursFromNow(-2),
    });
    const fresh = await insertBooking({
      barber: w.barber,
      clientUserId: w.clientId,
      startAt: hoursFromNow(96),
    });
    const confirmed = await insertBooking({
      barber: w.barber,
      clientUserId: w.clientId,
      startAt: hoursFromNow(120),
      createdAt: hoursFromNow(-48),
      status: "CONFIRMED",
    });

    expect(await sweepExpiredPendingBookings()).toBe(2);
    expect((await rowOf(stale)).status).toBe("EXPIRED");
    expect((await rowOf(started)).status).toBe("EXPIRED");
    expect((await rowOf(fresh)).status).toBe("PENDING");
    expect((await rowOf(confirmed)).status).toBe("CONFIRMED");
    expect(await notificationTypesFor(w.clientId, stale)).toEqual(["BOOKING_EXPIRED"]);
    expect(await notificationTypesFor(w.barber.userId, stale)).toEqual(["BOOKING_EXPIRED"]);

    expect(await sweepExpiredPendingBookings()).toBe(0);
  });
});

// --- 4. Actions ADMIN ---------------------------------------------------------

describe("annulation par l'ADMIN", () => {
  it("annule une PENDING et une CONFIRMED sans délai, notifie client et barber", async () => {
    const w = await world();
    await createUser("eng-admin@example.com", "ADMIN");
    const admin = await login(app, "eng-admin@example.com");

    // CONFIRMED dans 30 min : le délai client de 2 h ne s'applique pas à l'ADMIN.
    const soon = await insertBooking({
      barber: w.barber,
      clientUserId: w.clientId,
      startAt: new Date(Date.now() + 30 * 60_000),
      status: "CONFIRMED",
    });
    const pending = await insertBooking({
      barber: w.barber,
      clientUserId: w.clientId,
      startAt: hoursFromNow(48),
    });

    for (const id of [soon, pending]) {
      const res = await admin.agent
        .post(`/api/admin/bookings/${id}/cancel`)
        .set("X-CSRF-Token", admin.csrf);
      expect(res.status).toBe(200);
      expect(res.body.booking.status).toBe("CANCELLED");
      expect(res.body.booking.cancelledBy).toBe("ADMIN");
      expect(await notificationTypesFor(w.clientId, id)).toEqual(["BOOKING_CANCELLED_BY_ADMIN"]);
      expect(await notificationTypesFor(w.barber.userId, id)).toEqual(["BOOKING_CANCELLED_BY_ADMIN"]);
    }

    // Statut terminal : 409.
    const again = await admin.agent
      .post(`/api/admin/bookings/${soon}/cancel`)
      .set("X-CSRF-Token", admin.csrf);
    expect(again.status).toBe(409);

    const unknown = await admin.agent
      .post(`/api/admin/bookings/does-not-exist/cancel`)
      .set("X-CSRF-Token", admin.csrf);
    expect(unknown.status).toBe(404);
  });

  it("route ADMIN interdite au CLIENT et au BARBER (403), CSRF requis", async () => {
    const w = await world();
    await createUser("eng-admin@example.com", "ADMIN");
    const admin = await login(app, "eng-admin@example.com");
    const id = await insertBooking({
      barber: w.barber,
      clientUserId: w.clientId,
      startAt: hoursFromNow(48),
    });

    for (const session of [w.clientSession, w.barberSession]) {
      const res = await session.agent
        .post(`/api/admin/bookings/${id}/cancel`)
        .set("X-CSRF-Token", session.csrf);
      expect(res.status).toBe(403);
    }
    const noCsrf = await admin.agent.post(`/api/admin/bookings/${id}/cancel`);
    expect(noCsrf.status).toBe(403);

    // L'ADMIN ne confirme ni ne refuse (D3 : annulation seulement).
    const confirm = await admin.agent
      .post(`/api/bookings/${id}/confirm`)
      .set("X-CSRF-Token", admin.csrf);
    expect(confirm.status).toBe(403);
    const decline = await admin.agent
      .post(`/api/bookings/${id}/decline`)
      .set("X-CSRF-Token", admin.csrf);
    expect(decline.status).toBe(403);

    expect((await rowOf(id)).status).toBe("PENDING");
  });
});

// --- Droits par rôle sur les transitions existantes ------------------------------

describe("droits par rôle", () => {
  it("le CLIENT ne peut ni confirmer ni terminer ; il n'annule que les siennes", async () => {
    const w = await world();
    const id = await insertBooking({
      barber: w.barber,
      clientUserId: w.clientId,
      startAt: hoursFromNow(48),
    });
    for (const action of ["confirm", "complete", "decline"]) {
      const res = await w.clientSession.agent
        .post(`/api/bookings/${id}/${action}`)
        .set("X-CSRF-Token", w.clientSession.csrf);
      expect(res.status).toBe(403);
    }

    await createUser("eng-intruder@example.com", "CLIENT");
    const intruder = await login(app, "eng-intruder@example.com");
    const res = await intruder.agent
      .post(`/api/bookings/${id}/cancel`)
      .set("X-CSRF-Token", intruder.csrf);
    expect(res.status).toBe(404);
    expect((await rowOf(id)).status).toBe("PENDING");
  });
});

// --- 5. Concurrence --------------------------------------------------------------

describe("concurrence sur un même créneau", () => {
  it("cinq réservations simultanées : exactement une réussit", async () => {
    const barber = await seedBarber("eng-barber@example.com");
    const date = futureDate(7);
    const sessions: Session[] = [];
    for (let i = 0; i < 5; i += 1) {
      await createUser(`eng-c${i}@example.com`, "CLIENT");
      sessions.push(await login(app, `eng-c${i}@example.com`));
    }

    const results = await Promise.all(
      sessions.map((session) => book(session, barber, date, 540)),
    );
    const statuses = results.map((r) => r.status).sort();
    expect(statuses).toEqual([201, 409, 409, 409, 409]);
    for (const r of results.filter((r) => r.status === 409)) {
      expect(r.body.error.code).toBe("SLOT_UNAVAILABLE");
    }
    const active = await db
      .select()
      .from(bookings)
      .where(eq(bookings.barberProfileId, barber.profileId));
    expect(active).toHaveLength(1);
  });

  it("la contrainte d'exclusion refuse un chevauchement actif même hors API", async () => {
    const w = await world();
    const start = hoursFromNow(48);
    await insertBooking({ barber: w.barber, clientUserId: w.clientId, startAt: start });
    await expect(
      insertBooking({
        barber: w.barber,
        clientUserId: w.clientId,
        startAt: new Date(start.getTime() + 15 * 60_000),
        status: "CONFIRMED",
      }),
    ).rejects.toThrow();
    // Une réservation terminale ne bloque pas.
    await expect(
      insertBooking({
        barber: w.barber,
        clientUserId: w.clientId,
        startAt: start,
        status: "CANCELLED",
      }),
    ).resolves.toBeTruthy();
  });
});

// --- 5. Hors horaires ------------------------------------------------------------

describe("créneau hors horaires (API)", () => {
  async function bookingWorld() {
    const date = futureDate(7);
    const weekday = weekdayFromCalendarDate(date);
    const w = await world({
      durationMinutes: 60,
      hours: [{ weekday, startMinute: 540, endMinute: 720 }], // 09:00–12:00
    });
    return { w, date };
  }

  it("refuse avant l'ouverture, après la fermeture, et une durée qui dépasse la fin de plage", async () => {
    const { w, date } = await bookingWorld();
    for (const minute of [480, 720, 690, 545]) {
      // 08:00, 12:00, 11:30 (+60 min dépasse 12:00), 09:05 (hors grille)
      const res = await book(w.clientSession, w.barber, date, minute);
      expect(res.status, `minute ${minute}`).toBe(409);
      expect(res.body.error.code).toBe("SLOT_UNAVAILABLE");
    }
    expect((await book(w.clientSession, w.barber, date, 660)).status).toBe(201); // 11:00–12:00
  });

  it("refuse un jour fermé et un jour d'indisponibilité", async () => {
    const { w, date } = await bookingWorld();
    const closed = futureDate(8); // autre jour de semaine, aucune plage
    expect((await book(w.clientSession, w.barber, closed, 540)).status).toBe(409);

    await db.insert(barberTimeOff).values({
      id: "time-off-1",
      barberProfileId: w.barber.profileId,
      startDate: date,
      endDate: date,
      reason: null,
    });
    const res = await book(w.clientSession, w.barber, date, 540);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("SLOT_UNAVAILABLE");
  });
});

// --- 5. Changements d'heure (Europe/Zurich) -----------------------------------------

describe("changements d'heure Europe/Zurich (API)", () => {
  // Seule l'horloge `Date` est simulée : la base et les timers restent réels.
  function freezeAt(iso: string) {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(iso));
  }

  it("heure d'été (28/03/2027) : instants UTC exacts, créneau dépassant la plage refusé", async () => {
    freezeAt("2027-03-20T12:00:00Z");
    const w = await world({
      timezone: "Europe/Zurich",
      durationMinutes: 60,
      hours: [
        { weekday: 7, startMinute: 30, endMinute: 180 }, // 00:30–03:00
        { weekday: 7, startMinute: 540, endMinute: 660 }, // 09:00–11:00
      ],
    });

    const slotRes = await slots(w.barber, "2027-03-28");
    expect(slotRes.status).toBe(200);
    expect(
      slotRes.body.slots.map((s: { startMinute: number; startAt: string }) => [s.startMinute, s.startAt]),
    ).toEqual([
      [30, "2027-03-27T23:30:00.000Z"], // 00:30 CET (+1)
      [540, "2027-03-28T07:00:00.000Z"], // 09:00 CEST (+2)
      [600, "2027-03-28T08:00:00.000Z"],
    ]);

    // 01:30 + 60 min finirait à 03:30 réelles : refusé côté serveur.
    const overflow = await book(w.clientSession, w.barber, "2027-03-28", 90);
    expect(overflow.status).toBe(409);

    const ok = await book(w.clientSession, w.barber, "2027-03-28", 540);
    expect(ok.status).toBe(201);
    expect(ok.body.booking.startAt).toBe("2027-03-28T07:00:00.000Z");
    expect(ok.body.booking.endAt).toBe("2027-03-28T08:00:00.000Z");

    // La semaine précédente (heure d'hiver), 09:00 = 08:00Z.
    const before = await book(w.clientSession, w.barber, "2027-03-21", 540);
    expect(before.body.booking.startAt).toBe("2027-03-21T08:00:00.000Z");
  });

  it("heure d'hiver (25/10/2026) : heure répétée sans double réservation", async () => {
    freezeAt("2026-10-20T12:00:00Z");
    const w = await world({
      timezone: "Europe/Zurich",
      durationMinutes: 60,
      hours: [
        { weekday: 7, startMinute: 60, endMinute: 240 }, // 01:00–04:00
        { weekday: 7, startMinute: 540, endMinute: 600 }, // 09:00–10:00
      ],
    });

    const created = [];
    for (const minute of [60, 120, 180, 540]) {
      const res = await book(w.clientSession, w.barber, "2026-10-25", minute);
      expect(res.status, `minute ${minute}`).toBe(201);
      created.push(res.body.booking as { startAt: string; endAt: string });
      // Confirmée : le créneau reste occupé, sans compter dans le plafond
      // des demandes en attente du client.
      await db
        .update(bookings)
        .set({ status: "CONFIRMED" })
        .where(eq(bookings.id, res.body.booking.id));
    }
    expect(created.map((b) => b.startAt)).toEqual([
      "2026-10-24T23:00:00.000Z", // 01:00 CEST
      // 02:00 ambiguë : résolue sur la 2e occurrence (CET), comportement
      // existant de `zonedTimeToUtc` ; l'heure 02:00–03:00 CEST n'est pas proposée.
      "2026-10-25T01:00:00.000Z",
      "2026-10-25T02:00:00.000Z", // 03:00 CET
      "2026-10-25T08:00:00.000Z", // 09:00 CET (+1)
    ]);
    for (let i = 1; i < created.length; i += 1) {
      expect(Date.parse(created[i].startAt)).toBeGreaterThanOrEqual(
        Date.parse(created[i - 1].endAt),
      );
    }
    // Le même créneau ne se réserve pas deux fois.
    expect((await book(w.clientSession, w.barber, "2026-10-25", 120)).status).toBe(409);
  });
});
