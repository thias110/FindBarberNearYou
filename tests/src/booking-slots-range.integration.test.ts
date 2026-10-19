// Créneaux sur une plage de jours (lot N2, grille de la semaine) :
// `GET /api/barbers/:id/slots?from&days`. Vraie base PGlite, requêtes HTTP.
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import request from "supertest";
import { createApp } from "../../server/src/app";
import { db } from "../../server/src/db/client";
import { migrateDb } from "../../server/src/db/migrate";
import { barberProfiles, barberTimeOff } from "@findbarber/shared/schema";
import { weekdayFromCalendarDate } from "@findbarber/shared/dates";
import {
  createUser,
  futureDate,
  insertBooking,
  resetBookingTables,
  seedBarber,
  type SeededBarber,
} from "./booking-api-helpers";

const app = createApp();

beforeAll(async () => {
  await migrateDb();
});

beforeEach(async () => {
  await resetBookingTables();
});

interface Slot {
  startAt: string;
  endAt: string;
  startMinute: number;
}

function range(
  barber: SeededBarber,
  query: Record<string, string | number> = {},
  barberId = barber.profileId,
) {
  return request(app)
    .get(`/api/barbers/${barberId}/slots`)
    .query({ serviceId: barber.serviceId, place: "SALON", ...query });
}

function oneDay(barber: SeededBarber, date: string) {
  return request(app)
    .get(`/api/barbers/${barber.profileId}/slots`)
    .query({ serviceId: barber.serviceId, place: "SALON", date });
}

function addDays(date: string, n: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

describe("créneaux sur une plage (from/days)", () => {
  it("renvoie 7 jours dans l'ordre, les jours fermés avec slots vides", async () => {
    const from = futureDate(3);
    const openDays = [0, 2, 5];
    const barber = await seedBarber("range-a@example.com", {
      hours: openDays.map((i) => ({
        weekday: weekdayFromCalendarDate(addDays(from, i)),
        startMinute: 540,
        endMinute: 600,
      })),
    });

    const res = await range(barber, { from });
    expect(res.status).toBe(200);
    const days = res.body.days as { date: string; slots: Slot[] }[];
    expect(days.map((d) => d.date)).toEqual([0, 1, 2, 3, 4, 5, 6].map((i) => addDays(from, i)));
    days.forEach((d, i) => {
      if (openDays.includes(i)) {
        expect(d.slots.map((s) => s.startMinute)).toEqual([540, 570]);
      } else {
        expect(d.slots).toEqual([]);
      }
    });
  });

  it("respecte days (3 jours) et vaut 7 par défaut", async () => {
    const barber = await seedBarber("range-b@example.com");
    const from = futureDate(3);
    expect((await range(barber, { from, days: 3 })).body.days).toHaveLength(3);
    expect((await range(barber, { from })).body.days).toHaveLength(7);
  });

  it("donne les mêmes créneaux que la route d'un seul jour", async () => {
    const from = futureDate(2);
    const barber = await seedBarber("range-c@example.com", { durationMinutes: 45 });
    const res = await range(barber, { from });
    for (const day of res.body.days as { date: string; slots: Slot[] }[]) {
      const single = await oneDay(barber, day.date);
      expect(single.status).toBe(200);
      expect(day.slots).toEqual(single.body.slots);
      expect(day.slots.length).toBeGreaterThan(0);
    }
  });

  it("un créneau occupé est absent", async () => {
    const barber = await seedBarber("range-d@example.com");
    const clientId = await createUser("range-d-client@example.com", "CLIENT");
    const date = futureDate(3);
    await insertBooking({
      barber,
      clientUserId: clientId,
      startAt: new Date(`${date}T09:00:00Z`),
      status: "CONFIRMED",
    });
    const res = await range(barber, { from: date, days: 2 });
    const first = res.body.days[0].slots.map((s: Slot) => s.startMinute);
    expect(first).not.toContain(540);
    expect(first).toContain(570);
    expect(res.body.days[1].slots.map((s: Slot) => s.startMinute)).toContain(540);
  });

  it("une absence rend le jour vide", async () => {
    const barber = await seedBarber("range-e@example.com");
    const from = futureDate(3);
    await db.insert(barberTimeOff).values({
      id: "range-off-1",
      barberProfileId: barber.profileId,
      startDate: addDays(from, 1),
      endDate: addDays(from, 2),
      reason: null,
    });
    const days = (await range(barber, { from, days: 4 })).body.days as {
      slots: Slot[];
    }[];
    expect(days[0].slots.length).toBeGreaterThan(0);
    expect(days[1].slots).toEqual([]);
    expect(days[2].slots).toEqual([]);
    expect(days[3].slots.length).toBeGreaterThan(0);
  });

  it("les jours au-delà de l'horizon sont vides, sans erreur", async () => {
    const barber = await seedBarber("range-f@example.com");
    const near = await range(barber, { from: futureDate(58) });
    expect(near.status).toBe(200);
    expect(near.body.days[0].slots.length).toBeGreaterThan(0);
    expect(near.body.days[6].slots).toEqual([]);

    const far = await range(barber, { from: futureDate(200) });
    expect(far.status).toBe(200);
    expect(far.body.days).toHaveLength(7);
    for (const d of far.body.days as { slots: Slot[] }[]) {
      expect(d.slots).toEqual([]);
    }
  });

  it("refuse days hors 1..7, from invalide, date mêlée à from (400)", async () => {
    const barber = await seedBarber("range-g@example.com");
    const from = futureDate(3);
    for (const query of [
      { from, days: 8 },
      { from, days: 0 },
      { from, days: "abc" },
      { from: "2026-13-40" },
      { from: "demain" },
      { from, date: from },
    ]) {
      const res = await range(barber, query);
      expect(res.status, JSON.stringify(query)).toBe(400);
    }
  });

  it("fuseau manquant : 409 BARBER_TIMEZONE_MISSING", async () => {
    const barber = await seedBarber("range-h@example.com");
    await db
      .update(barberProfiles)
      .set({ timezone: null })
      .where(eq(barberProfiles.id, barber.profileId));
    const res = await range(barber, { from: futureDate(3) });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("BARBER_TIMEZONE_MISSING");
  });

  it("service d'un autre barber : 404 SERVICE_NOT_FOUND", async () => {
    const barber = await seedBarber("range-i@example.com");
    const other = await seedBarber("range-j@example.com");
    const res = await range(other, { from: futureDate(3) }, barber.profileId);
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("SERVICE_NOT_FOUND");
  });

  it("la route d'un seul jour reste inchangée ({ slots })", async () => {
    const barber = await seedBarber("range-k@example.com");
    const res = await oneDay(barber, futureDate(3));
    expect(res.status).toBe(200);
    expect(Object.keys(res.body)).toEqual(["slots"]);
    expect(res.body.slots[0]).toEqual({
      startAt: expect.any(String),
      endAt: expect.any(String),
      startMinute: 540,
    });
  });
});
