// Plafond des demandes en attente par client (audit de sécurité) : un seul
// compte ne peut pas bloquer l'agenda d'un barber en réservant tous ses
// créneaux, chaque demande PENDING gardant le créneau jusqu'à 24 h.
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { createApp } from "../../server/src/app";
import { db } from "../../server/src/db/client";
import { migrateDb } from "../../server/src/db/migrate";
import { bookings } from "@findbarber/shared/schema";
import { LIMITS } from "@findbarber/shared/constants";
import {
  createUser,
  futureDate,
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

function book(session: Session, barber: SeededBarber, startMinute: number, day = 3) {
  return session.agent
    .post("/api/bookings")
    .set("X-CSRF-Token", session.csrf)
    .send({
      barberId: barber.profileId,
      serviceId: barber.serviceId,
      date: futureDate(day),
      startMinute,
      place: "SALON",
    });
}

describe("plafond des demandes en attente par client", () => {
  it("refuse au-delà du plafond chez un même barber", async () => {
    const barber = await seedBarber("cap-barber@example.com");
    await createUser("cap-client@example.com", "CLIENT");
    const client = await login(app, "cap-client@example.com");

    for (let i = 0; i < LIMITS.clientPendingMaxPerBarber; i += 1) {
      expect((await book(client, barber, 600 + i * 30)).status).toBe(201);
    }
    const res = await book(client, barber, 780);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("TOO_MANY_PENDING_BOOKINGS");
  });

  it("refuse au-delà du plafond total, tous barbers confondus", async () => {
    await createUser("cap-client@example.com", "CLIENT");
    const client = await login(app, "cap-client@example.com");
    const barbers: SeededBarber[] = [];
    for (let i = 0; i <= LIMITS.clientPendingMaxTotal; i += 1) {
      barbers.push(await seedBarber(`cap-barber-${i}@example.com`));
    }

    for (let i = 0; i < LIMITS.clientPendingMaxTotal; i += 1) {
      expect((await book(client, barbers[i]!, 600)).status).toBe(201);
    }
    const res = await book(client, barbers[LIMITS.clientPendingMaxTotal]!, 600);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("TOO_MANY_PENDING_BOOKINGS");
  });

  it("une demande traitée ou échue libère une place", async () => {
    const barber = await seedBarber("cap-barber@example.com");
    const clientId = await createUser("cap-client@example.com", "CLIENT");
    const client = await login(app, "cap-client@example.com");
    for (let i = 0; i < LIMITS.clientPendingMaxPerBarber; i += 1) {
      expect((await book(client, barber, 600 + i * 30)).status).toBe(201);
    }

    const [first] = await db
      .select()
      .from(bookings)
      .where(eq(bookings.clientUserId, clientId));
    await db
      .update(bookings)
      .set({ status: "CONFIRMED" })
      .where(eq(bookings.id, first!.id));
    expect((await book(client, barber, 780)).status).toBe(201);

    // Une demande échue (non encore balayée) ne compte plus.
    await db
      .update(bookings)
      .set({ createdAt: new Date(Date.now() - (LIMITS.bookingPendingTtlHours + 1) * 3_600_000) })
      .where(eq(bookings.clientUserId, clientId));
    expect((await book(client, barber, 840)).status).toBe(201);
  });

  it("le plafond est propre à chaque client", async () => {
    const barber = await seedBarber("cap-barber@example.com");
    await createUser("cap-a@example.com", "CLIENT");
    await createUser("cap-b@example.com", "CLIENT");
    const a = await login(app, "cap-a@example.com");
    const b = await login(app, "cap-b@example.com");
    for (let i = 0; i < LIMITS.clientPendingMaxPerBarber; i += 1) {
      expect((await book(a, barber, 600 + i * 30)).status).toBe(201);
    }
    expect((await book(b, barber, 780)).status).toBe(201);
  });
});
