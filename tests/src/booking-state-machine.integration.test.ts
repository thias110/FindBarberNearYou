// Non-régression du bug « annulée → confirmée » (lot 4 rouvert, issue #4).
// Le bug : confirm/complete/cancel contrôlaient le statut puis exécutaient un
// UPDATE non gardé. Une transition concurrente validée entre les deux était
// écrasée. On reproduit l'entrelacement de façon DÉTERMINISTE : la transition
// concurrente est validée juste avant l'ouverture de la transaction d'écriture.
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { createApp } from "../../server/src/app";
import { db } from "../../server/src/db/client";
import { migrateDb } from "../../server/src/db/migrate";
import { bookings } from "@findbarber/shared/schema";
import type { BookingStatus } from "@findbarber/shared/constants";
import { moveBookingToPast } from "./booking-helpers";
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
  await resetBookingTables();
});

afterEach(() => {
  vi.restoreAllMocks();
});

/**
 * Au prochain `db.transaction`, applique d'abord `concurrent` (simulation d'une
 * requête concurrente validée entre le contrôle et l'écriture).
 */
function interleaveBeforeNextTransaction(concurrent: () => Promise<unknown>) {
  const original = db.transaction.bind(db);
  vi.spyOn(db, "transaction").mockImplementationOnce((async (
    ...args: Parameters<typeof db.transaction>
  ) => {
    await concurrent();
    return original(...args);
  }) as typeof db.transaction);
}

async function statusOf(id: string): Promise<BookingStatus> {
  const [row] = await db
    .select({ status: bookings.status })
    .from(bookings)
    .where(eq(bookings.id, id));
  return row.status;
}

async function setup() {
  const barber = await seedBarber("sm-barber@example.com");
  const clientId = await createUser("sm-client@example.com", "CLIENT");
  const barberSession = await login(app, "sm-barber@example.com");
  const clientSession = await login(app, "sm-client@example.com");
  return { barber, clientId, barberSession, clientSession };
}

describe("bug annulée → confirmée (TOCTOU)", () => {
  it("refuse de confirmer une réservation annulée entre le contrôle et l'écriture", async () => {
    const { barber, clientId, barberSession } = await setup();
    const id = await insertBooking({
      barber,
      clientUserId: clientId,
      startAt: hoursFromNow(48),
    });

    interleaveBeforeNextTransaction(() =>
      db
        .update(bookings)
        .set({ status: "CANCELLED", cancelledBy: "CLIENT", cancelledAt: new Date() })
        .where(eq(bookings.id, id)),
    );

    const res = await barberSession.agent
      .post(`/api/bookings/${id}/confirm`)
      .set("X-CSRF-Token", barberSession.csrf);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("INVALID_STATUS_TRANSITION");
    expect(await statusOf(id)).toBe("CANCELLED");
  });

  it("refuse de terminer une réservation annulée entre le contrôle et l'écriture", async () => {
    const { barber, clientId, barberSession } = await setup();
    const id = await insertBooking({
      barber,
      clientUserId: clientId,
      startAt: hoursFromNow(48),
      status: "CONFIRMED",
    });
    await moveBookingToPast(id);

    interleaveBeforeNextTransaction(() =>
      db
        .update(bookings)
        .set({ status: "CANCELLED", cancelledBy: "BARBER", cancelledAt: new Date() })
        .where(eq(bookings.id, id)),
    );

    const res = await barberSession.agent
      .post(`/api/bookings/${id}/complete`)
      .set("X-CSRF-Token", barberSession.csrf);
    expect(res.status).toBe(409);
    expect(await statusOf(id)).toBe("CANCELLED");
  });

  it("refuse d'annuler une réservation terminée entre le contrôle et l'écriture", async () => {
    const { barber, clientId, barberSession } = await setup();
    const id = await insertBooking({
      barber,
      clientUserId: clientId,
      startAt: hoursFromNow(48),
      status: "CONFIRMED",
    });

    interleaveBeforeNextTransaction(() =>
      db.update(bookings).set({ status: "COMPLETED" }).where(eq(bookings.id, id)),
    );

    const res = await barberSession.agent
      .post(`/api/bookings/${id}/cancel`)
      .set("X-CSRF-Token", barberSession.csrf);
    expect(res.status).toBe(409);
    expect(await statusOf(id)).toBe("COMPLETED");
  });

  it("confirm et cancel simultanés : jamais deux succès, état final cohérent", async () => {
    const { barber, clientId, barberSession, clientSession } = await setup();
    for (let i = 0; i < 15; i += 1) {
      const id = await insertBooking({
        barber,
        clientUserId: clientId,
        startAt: hoursFromNow(48 + i),
      });
      const [confirm, cancel] = await Promise.all([
        barberSession.agent
          .post(`/api/bookings/${id}/confirm`)
          .set("X-CSRF-Token", barberSession.csrf),
        clientSession.agent
          .post(`/api/bookings/${id}/cancel`)
          .set("X-CSRF-Token", clientSession.csrf),
      ]);
      const [row] = await db.select().from(bookings).where(eq(bookings.id, id));

      // Un confirm suivi d'un cancel est un enchaînement légitime (CONFIRMED →
      // CANCELLED). Ce qui est interdit : finir CONFIRMED après une annulation.
      if (row.status === "CONFIRMED") {
        expect(cancel.status).toBe(409);
        expect(row.cancelledBy).toBeNull();
      } else {
        expect(row.status).toBe("CANCELLED");
        expect(cancel.status).toBe(200);
      }
      expect([200, 409]).toContain(confirm.status);
    }
  });
});
