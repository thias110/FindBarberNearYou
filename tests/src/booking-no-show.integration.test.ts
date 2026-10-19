// Absence du client (lot N8) : le barber propriétaire marque un rendez-vous
// CONFIRMED comme « absence », seulement après son début et dans les 48 h.
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import { createApp } from "../../server/src/app";
import { db } from "../../server/src/db/client";
import { migrateDb } from "../../server/src/db/migrate";
import {
  auditLogs,
  bookings,
  notifications,
  reviews,
} from "@findbarber/shared/schema";
import {
  createUser,
  hoursFromNow,
  insertBooking,
  login,
  resetBookingTables,
  seedBarber,
} from "./booking-api-helpers";

const app = createApp();

beforeAll(async () => {
  await migrateDb();
});

beforeEach(async () => {
  await db.delete(auditLogs);
  await resetBookingTables();
});

async function setup() {
  const barber = await seedBarber("ns-barber@example.com");
  const clientId = await createUser("ns-client@example.com", "CLIENT");
  const barberSession = await login(app, "ns-barber@example.com");
  const clientSession = await login(app, "ns-client@example.com");
  return { barber, clientId, barberSession, clientSession };
}

async function rowOf(id: string) {
  const [row] = await db.select().from(bookings).where(eq(bookings.id, id));
  return row;
}

describe("POST /api/bookings/:id/no-show", () => {
  it("marque l'absence dans la fenêtre (barber propriétaire)", async () => {
    const { barber, clientId, barberSession } = await setup();
    const id = await insertBooking({
      barber,
      clientUserId: clientId,
      startAt: hoursFromNow(-1),
      status: "CONFIRMED",
    });
    const res = await barberSession.agent
      .post(`/api/bookings/${id}/no-show`)
      .set("X-CSRF-Token", barberSession.csrf);
    expect(res.status).toBe(200);
    expect(res.body.booking.status).toBe("NO_SHOW");
    expect((await rowOf(id)).status).toBe("NO_SHOW");
  });

  it("refuse avant le début du rendez-vous (NO_SHOW_WINDOW)", async () => {
    const { barber, clientId, barberSession } = await setup();
    const id = await insertBooking({
      barber,
      clientUserId: clientId,
      startAt: hoursFromNow(2),
      status: "CONFIRMED",
    });
    const res = await barberSession.agent
      .post(`/api/bookings/${id}/no-show`)
      .set("X-CSRF-Token", barberSession.csrf);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("NO_SHOW_WINDOW");
    expect((await rowOf(id)).status).toBe("CONFIRMED");
  });

  it("refuse au-delà de 48 h après le début (NO_SHOW_WINDOW)", async () => {
    const { barber, clientId, barberSession } = await setup();
    const id = await insertBooking({
      barber,
      clientUserId: clientId,
      startAt: hoursFromNow(-49),
      status: "CONFIRMED",
    });
    const res = await barberSession.agent
      .post(`/api/bookings/${id}/no-show`)
      .set("X-CSRF-Token", barberSession.csrf);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("NO_SHOW_WINDOW");
    expect((await rowOf(id)).status).toBe("CONFIRMED");
  });

  it("répond 404 à un autre barber", async () => {
    const { barber, clientId } = await setup();
    await seedBarber("ns-other@example.com");
    const other = await login(app, "ns-other@example.com");
    const id = await insertBooking({
      barber,
      clientUserId: clientId,
      startAt: hoursFromNow(-1),
      status: "CONFIRMED",
    });
    const res = await other.agent
      .post(`/api/bookings/${id}/no-show`)
      .set("X-CSRF-Token", other.csrf);
    expect(res.status).toBe(404);
    expect((await rowOf(id)).status).toBe("CONFIRMED");
  });

  it("répond 403 à un client", async () => {
    const { barber, clientId, clientSession } = await setup();
    const id = await insertBooking({
      barber,
      clientUserId: clientId,
      startAt: hoursFromNow(-1),
      status: "CONFIRMED",
    });
    const res = await clientSession.agent
      .post(`/api/bookings/${id}/no-show`)
      .set("X-CSRF-Token", clientSession.csrf);
    expect(res.status).toBe(403);
    expect((await rowOf(id)).status).toBe("CONFIRMED");
  });

  it("refuse sans jeton CSRF", async () => {
    const { barber, clientId, barberSession } = await setup();
    const id = await insertBooking({
      barber,
      clientUserId: clientId,
      startAt: hoursFromNow(-1),
      status: "CONFIRMED",
    });
    const res = await barberSession.agent.post(`/api/bookings/${id}/no-show`);
    expect(res.status).toBe(403);
    expect((await rowOf(id)).status).toBe("CONFIRMED");
  });

  it.each(["PENDING", "CANCELLED", "COMPLETED"] as const)(
    "refuse une réservation %s (transition interdite)",
    async (status) => {
      const { barber, clientId, barberSession } = await setup();
      const id = await insertBooking({
        barber,
        clientUserId: clientId,
        // Une demande PENDING dont le début est passé est « expirée » : on la
        // garde à venir pour tester la transition elle-même.
        startAt: hoursFromNow(status === "PENDING" ? 5 : -1),
        status,
      });
      const res = await barberSession.agent
        .post(`/api/bookings/${id}/no-show`)
        .set("X-CSRF-Token", barberSession.csrf);
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe("INVALID_STATUS_TRANSITION");
      expect((await rowOf(id)).status).toBe(status);
    },
  );

  it("refuse un second appel (409)", async () => {
    const { barber, clientId, barberSession } = await setup();
    const id = await insertBooking({
      barber,
      clientUserId: clientId,
      startAt: hoursFromNow(-1),
      status: "CONFIRMED",
    });
    const call = () =>
      barberSession.agent
        .post(`/api/bookings/${id}/no-show`)
        .set("X-CSRF-Token", barberSession.csrf);
    expect((await call()).status).toBe(200);
    const second = await call();
    expect(second.status).toBe(409);
    expect(second.body.error.code).toBe("INVALID_STATUS_TRANSITION");
  });

  it("écrit l'audit BOOKING_NO_SHOW", async () => {
    const { barber, clientId, barberSession } = await setup();
    const id = await insertBooking({
      barber,
      clientUserId: clientId,
      startAt: hoursFromNow(-1),
      status: "CONFIRMED",
    });
    await barberSession.agent
      .post(`/api/bookings/${id}/no-show`)
      .set("X-CSRF-Token", barberSession.csrf);
    const rows = await db
      .select()
      .from(auditLogs)
      .where(and(eq(auditLogs.targetId, id), eq(auditLogs.action, "BOOKING_NO_SHOW")));
    expect(rows).toHaveLength(1);
    expect(rows[0].actorUserId).toBe(barber.userId);
    expect(rows[0].actorRole).toBe("BARBER");
    expect(rows[0].metadata).toEqual({ from: "CONFIRMED", to: "NO_SHOW" });
  });

  it("notifie le client", async () => {
    const { barber, clientId, barberSession } = await setup();
    const id = await insertBooking({
      barber,
      clientUserId: clientId,
      startAt: hoursFromNow(-1),
      status: "CONFIRMED",
    });
    await barberSession.agent
      .post(`/api/bookings/${id}/no-show`)
      .set("X-CSRF-Token", barberSession.csrf);
    const rows = await db
      .select()
      .from(notifications)
      .where(eq(notifications.bookingId, id));
    expect(rows).toHaveLength(1);
    expect(rows[0].type).toBe("BOOKING_NO_SHOW");
    expect(rows[0].userId).toBe(clientId);
  });

  it("laisse le paiement inchangé (aucune décision d'argent)", async () => {
    const { barber, clientId, barberSession } = await setup();
    const id = await insertBooking({
      barber,
      clientUserId: clientId,
      startAt: hoursFromNow(-1),
      status: "CONFIRMED",
    });
    await db
      .update(bookings)
      .set({ paymentStatus: "PAID", amountDueMinor: 1250 })
      .where(eq(bookings.id, id));
    const res = await barberSession.agent
      .post(`/api/bookings/${id}/no-show`)
      .set("X-CSRF-Token", barberSession.csrf);
    expect(res.status).toBe(200);
    const row = await rowOf(id);
    expect(row.paymentStatus).toBe("PAID");
    expect(row.amountDueMinor).toBe(1250);
    expect(row.refundedAt).toBeNull();
  });

  it("n'autorise aucun avis sur une absence", async () => {
    const { barber, clientId, barberSession, clientSession } = await setup();
    const id = await insertBooking({
      barber,
      clientUserId: clientId,
      startAt: hoursFromNow(-1),
      status: "CONFIRMED",
    });
    await barberSession.agent
      .post(`/api/bookings/${id}/no-show`)
      .set("X-CSRF-Token", barberSession.csrf);
    const res = await clientSession.agent
      .post(`/api/bookings/${id}/review`)
      .set("X-CSRF-Token", clientSession.csrf)
      .send({ rating: 5, comment: "Super" });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("BOOKING_NOT_COMPLETED");
    expect(await db.select().from(reviews)).toHaveLength(0);
  });
});
