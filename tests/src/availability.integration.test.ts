// Disponibilité dans la recherche (lot N1) : champs exposés par GET /api/barbers,
// calcul en lot et cache invalidé par les écritures qui changent les créneaux.
import request from "supertest";
import { eq } from "drizzle-orm";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../server/src/app";
import { db } from "../../server/src/db/client";
import { migrateDb } from "../../server/src/db/migrate";
import { clearAvailabilityCache } from "../../server/src/modules/booking/availability";
import { barberProfiles } from "@findbarber/shared/schema";
import {
  createUser,
  insertBooking,
  login,
  resetBookingTables,
  seedBarber,
} from "./booking-api-helpers";

const app = createApp();
const DAY_MS = 86_400_000;

beforeAll(async () => {
  await migrateDb();
});

beforeEach(async () => {
  await resetBookingTables();
  clearAvailabilityCache();
});

async function searchItem(profileId: string) {
  const res = await request(app).get("/api/barbers");
  expect(res.status).toBe(200);
  return res.body.barbers.find((b: { id: string }) => b.id === profileId);
}

describe("disponibilité dans la recherche", () => {
  it("expose le prochain créneau libre (7 jours) et « libre aujourd'hui »", async () => {
    // Ouvert tous les jours 09:00-18:00 UTC : un créneau existe forcément.
    const barber = await seedBarber("avail@example.com");
    const item = await searchItem(barber.profileId);
    expect(typeof item.nextAvailableAt).toBe("string");
    const next = new Date(item.nextAvailableAt).getTime();
    expect(next).toBeGreaterThanOrEqual(Date.now() + 29 * 60_000);
    expect(next).toBeLessThan(Date.now() + 8 * DAY_MS);
    expect(typeof item.availableToday).toBe("boolean");
  });

  it("aucune disponibilité sans fuseau ou sans horaires", async () => {
    const noTz = await seedBarber("avail-notz@example.com");
    await db
      .update(barberProfiles)
      .set({ timezone: null })
      .where(eq(barberProfiles.id, noTz.profileId));
    const noHours = await seedBarber("avail-nohours@example.com", { hours: [] });

    for (const id of [noTz.profileId, noHours.profileId]) {
      const item = await searchItem(id);
      expect(item.nextAvailableAt).toBeNull();
      expect(item.availableToday).toBe(false);
    }
  });

  it("un créneau réservé n'est plus proposé", async () => {
    const barber = await seedBarber("avail-busy@example.com");
    const first = (await searchItem(barber.profileId)).nextAvailableAt as string;
    const clientId = await createUser("avail-client@example.com", "CLIENT");
    await insertBooking({
      barber,
      clientUserId: clientId,
      startAt: new Date(first),
      status: "CONFIRMED",
    });
    // Insertion directe (hors service) : on vide le cache comme le ferait la
    // création d'une réservation.
    clearAvailabilityCache();
    const next = (await searchItem(barber.profileId)).nextAvailableAt as string;
    expect(next).not.toBe(first);
    expect(new Date(next).getTime()).toBeGreaterThan(new Date(first).getTime());
  });

  it("le cache est invalidé quand le barber change ses horaires", async () => {
    const barber = await seedBarber("avail-hours@example.com");
    expect((await searchItem(barber.profileId)).nextAvailableAt).not.toBeNull();

    const session = await login(app, "avail-hours@example.com");
    await session.agent
      .put("/api/barber/working-hours")
      .set("X-CSRF-Token", session.csrf)
      .send({ intervals: [] })
      .expect(200);

    // Sans invalidation, le cache de 60 s renverrait encore l'ancien créneau.
    expect((await searchItem(barber.profileId)).nextAvailableAt).toBeNull();
  });

  it("le cache est invalidé par une absence couvrant toute la semaine", async () => {
    const barber = await seedBarber("avail-off@example.com");
    expect((await searchItem(barber.profileId)).nextAvailableAt).not.toBeNull();

    const session = await login(app, "avail-off@example.com");
    const today = new Date(Date.now() - DAY_MS).toISOString().slice(0, 10);
    const end = new Date(Date.now() + 9 * DAY_MS).toISOString().slice(0, 10);
    await session.agent
      .post("/api/barber/time-off")
      .set("X-CSRF-Token", session.csrf)
      .send({ startDate: today, endDate: end })
      .expect(201);

    const item = await searchItem(barber.profileId);
    expect(item.nextAvailableAt).toBeNull();
    expect(item.availableToday).toBe(false);
  });
});
