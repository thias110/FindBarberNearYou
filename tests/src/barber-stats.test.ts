import { describe, expect, it } from "vitest";
import {
  computeBarberStats,
  type StatsBookingRow,
} from "@findbarber/shared/stats";

const TZ = "Europe/Zurich";

function booking(overrides: Partial<StatsBookingRow> = {}): StatsBookingRow {
  return {
    startAt: new Date("2026-02-03T10:00:00.000Z"),
    status: "COMPLETED",
    priceMinor: 3000,
    serviceName: "Coupe classique",
    clientUserId: "client-1",
    cancelledBy: null,
    createdAt: new Date("2026-02-01T08:00:00.000Z"),
    ...overrides,
  };
}

function run(
  bookings: StatsBookingRow[],
  firstBookingByClient: ReadonlyMap<string, Date> = new Map(),
) {
  return computeBarberStats({
    timezone: TZ,
    currency: "CHF",
    fromDate: "2026-02-01",
    toDate: "2026-02-28",
    bookings,
    firstBookingByClient,
    rating: { averageRating: 4.5, totalReviews: 2 },
  });
}

describe("computeBarberStats — totaux et taux", () => {
  it("compte les revenus COMPLETED uniquement", () => {
    const stats = run([
      booking({ status: "PENDING", priceMinor: 1000 }),
      booking({ status: "CONFIRMED", priceMinor: 2000 }),
      booking({ status: "COMPLETED", priceMinor: 3000 }),
      booking({ status: "COMPLETED", priceMinor: 4000 }),
      booking({ status: "CANCELLED", priceMinor: 5000, cancelledBy: "CLIENT" }),
      booking({ status: "CANCELLED", priceMinor: 6000, cancelledBy: "BARBER" }),
      booking({ status: "NO_SHOW", priceMinor: 7000 }),
    ]);

    expect(stats.totals.bookings).toBe(7);
    expect(stats.totals.completed).toBe(2);
    expect(stats.totals.cancelled).toBe(2);
    expect(stats.totals.refused).toBe(1);
    expect(stats.totals.revenueMinor).toBe(7000);
  });

  it("calcule les taux en fractions 0..1, et 0 sans réservation", () => {
    const stats = run([
      booking({ status: "CANCELLED", cancelledBy: "BARBER" }),
      booking({ status: "COMPLETED" }),
    ]);
    expect(stats.rates.cancellationRate).toBe(0.5);
    expect(stats.rates.refusalRate).toBe(0.5);

    const empty = run([]);
    expect(empty.rates.cancellationRate).toBe(0);
    expect(empty.rates.refusalRate).toBe(0);
  });

  it("exclut les annulées des jours et heures chargés, pas du total", () => {
    const stats = run([
      booking({ status: "COMPLETED" }),
      booking({ status: "CANCELLED", cancelledBy: "CLIENT" }),
    ]);
    const charged = stats.busiestWeekdays.reduce((sum, b) => sum + b.count, 0);
    const chargedHours = stats.busiestHours.reduce((sum, b) => sum + b.count, 0);
    expect(stats.totals.bookings).toBe(2);
    expect(charged).toBe(1);
    expect(chargedHours).toBe(1);
  });
});

describe("computeBarberStats — bucket local (fuseau)", () => {
  it("filtre par jour local et non par jour UTC", () => {
    const stats = run([
      // 23:30 UTC = 00:30 le lendemain à Zurich (CET, UTC+1) → inclus.
      booking({ startAt: new Date("2026-01-31T23:30:00.000Z") }),
      // 23:30 UTC le 28/02 = 00:30 le 01/03 local → exclu.
      booking({ startAt: new Date("2026-02-28T23:30:00.000Z") }),
    ]);
    expect(stats.totals.bookings).toBe(1);
  });

  it("classe dans le bon jour de semaine et la bonne heure locale", () => {
    // Mardi 2026-02-03, 11:00 à Zurich (10:00 UTC).
    const stats = run([booking({ startAt: new Date("2026-02-03T10:00:00.000Z") })]);
    expect(stats.busiestWeekdays.find((b) => b.key === "2")?.count).toBe(1);
    expect(stats.busiestHours.find((b) => b.key === "11")?.count).toBe(1);
  });

  it("renvoie des buckets complets et ordonnés, même vides", () => {
    const stats = run([]);
    expect(stats.appointmentsByMonth).toEqual([
      { key: "2026-02", label: "février 2026", count: 0 },
    ]);
    expect(stats.busiestWeekdays).toHaveLength(7);
    expect(stats.busiestHours).toHaveLength(24);
    expect(stats.revenueByMonth).toEqual([
      { key: "2026-02", label: "février 2026", revenueMinor: 0 },
    ]);
  });
});

describe("computeBarberStats — services, clients, note", () => {
  it("classe les services par volume, annulées incluses, revenus COMPLETED", () => {
    const stats = run([
      booking({ serviceName: "Coupe", status: "COMPLETED", priceMinor: 100 }),
      booking({ serviceName: "Coupe", status: "CANCELLED", priceMinor: 100, cancelledBy: "CLIENT" }),
      booking({ serviceName: "Barbe", status: "COMPLETED", priceMinor: 200 }),
    ]);
    expect(stats.topServices).toEqual([
      { serviceName: "Coupe", count: 2, revenueMinor: 100 },
      { serviceName: "Barbe", count: 1, revenueMinor: 200 },
    ]);
  });

  it("distingue nouveaux clients et clients réguliers (compteurs seuls)", () => {
    const first = new Map<string, Date>([
      ["client-new", new Date("2026-02-05T10:00:00.000Z")],
      ["client-old", new Date("2026-01-10T10:00:00.000Z")],
    ]);
    const stats = run(
      [
        booking({ clientUserId: "client-new" }),
        booking({ clientUserId: "client-old" }),
      ],
      first,
    );
    expect(stats.clients.newClients).toBe(1);
    expect(stats.clients.returningClients).toBe(1);
  });

  it("restitue la note globale sans la recalculer", () => {
    const stats = run([]);
    expect(stats.rating).toEqual({ averageRating: 4.5, totalReviews: 2 });
  });
});
