// Concurrence RÉELLE sur PostgreSQL (lot 4 rouvert). PGlite n'a qu'une
// connexion et sérialise tout : seul un vrai serveur prouve que le verrou
// `FOR UPDATE` et la contrainte `bookings_no_overlap` tiennent sous requêtes
// simultanées (pool node-postgres, plusieurs connexions).
//
// Ignoré sauf si TEST_DATABASE_URL est défini. Garde-fou : le nom de la base
// doit se terminer par `_test` (la suite vide les tables). Exemple :
//   TEST_DATABASE_URL=postgresql://postgres@127.0.0.1:55432/findbarber_test \
//     npx vitest run tests/src/booking-concurrency.pg.test.ts
import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import request from "supertest";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  barberProfilePlaces,
  barberProfiles,
  barberServices,
  barberTimeOff,
  barberWorkingHours,
  bookings,
  notifications,
  reviews,
  users,
} from "@findbarber/shared/schema";
import type { Weekday } from "@findbarber/shared/constants";

const PG_URL = process.env.TEST_DATABASE_URL;
const PASSWORD = "password123";

function assertTestDatabase(url: string): void {
  const name = new URL(url).pathname.replace(/^\//, "");
  if (!name.endsWith("_test")) {
    throw new Error(
      `TEST_DATABASE_URL doit viser une base dédiée aux tests (nom en *_test), reçu « ${name} ».`,
    );
  }
}

describe.skipIf(!PG_URL)("concurrence sur PostgreSQL réel", () => {
  // Chargés APRÈS avoir forcé le pilote postgres (le client est un singleton).
  let app: import("express").Express;
  let db: typeof import("../../server/src/db/client").db;
  let closeDb: () => Promise<void>;
  const hash = bcrypt.hashSync(PASSWORD, 4);

  beforeAll(async () => {
    assertTestDatabase(PG_URL as string);
    process.env.DB_DRIVER = "postgres";
    process.env.DATABASE_URL = PG_URL;
    const client = await import("../../server/src/db/client");
    expect(client.driverKind).toBe("postgres");
    db = client.db;
    closeDb = client.closeDb;
    const { migrateDb } = await import("../../server/src/db/migrate");
    await migrateDb();
    const { createApp } = await import("../../server/src/app");
    app = createApp();
  });

  afterAll(async () => {
    await closeDb?.();
  });

  beforeEach(async () => {
    await db.delete(notifications);
    await db.delete(reviews);
    await db.delete(bookings);
    await db.delete(barberTimeOff);
    await db.delete(barberWorkingHours);
    await db.delete(barberProfilePlaces);
    await db.delete(barberServices);
    await db.delete(barberProfiles);
    await db.delete(users);
  });

  async function createUser(email: string, role: "CLIENT" | "BARBER") {
    const id = randomUUID();
    await db.insert(users).values({
      id,
      email,
      passwordHash: hash,
      role,
      status: "ACTIVE",
      emailVerifiedAt: new Date(),
    });
    return id;
  }

  async function login(email: string) {
    const agent = request.agent(app);
    const res = await agent.post("/api/auth/login").send({ email, password: PASSWORD });
    expect(res.status).toBe(200);
    return { agent, csrf: res.body.csrfToken as string };
  }

  async function seedBarber() {
    const userId = await createUser("pg-barber@example.com", "BARBER");
    const profileId = randomUUID();
    const serviceId = randomUUID();
    await db.insert(barberProfiles).values({
      id: profileId,
      approvedAt: new Date(),
      userId,
      displayName: "Barbier PG",
      description: "desc",
      address: "Rue 1",
      city: "Genève",
      countryCode: "CH",
      latitude: 46.2,
      longitude: 6.14,
      currency: "CHF",
      timezone: "Europe/Zurich",
    });
    await db.insert(barberProfilePlaces).values({ barberProfileId: profileId, place: "SALON" });
    await db.insert(barberServices).values({
      id: serviceId,
      barberProfileId: profileId,
      name: "Coupe",
      description: null,
      durationMinutes: 30,
      priceMinor: 2500,
    });
    await db.insert(barberWorkingHours).values(
      ([1, 2, 3, 4, 5, 6, 7] as Weekday[]).map((weekday) => ({
        id: randomUUID(),
        barberProfileId: profileId,
        weekday,
        startMinute: 540,
        endMinute: 1080,
      })),
    );
    return { userId, profileId, serviceId };
  }

  function futureDate(days: number) {
    const d = new Date();
    d.setUTCHours(0, 0, 0, 0);
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().slice(0, 10);
  }

  it("dix réservations simultanées sur le même créneau : une seule réussit", async () => {
    const barber = await seedBarber();
    const sessions = [];
    for (let i = 0; i < 10; i += 1) {
      await createUser(`pg-c${i}@example.com`, "CLIENT");
      sessions.push(await login(`pg-c${i}@example.com`));
    }
    const date = futureDate(7);

    const results = await Promise.all(
      sessions.map((s) =>
        s.agent
          .post("/api/bookings")
          .set("X-CSRF-Token", s.csrf)
          .send({
            barberId: barber.profileId,
            serviceId: barber.serviceId,
            date,
            startMinute: 600,
            place: "SALON",
          }),
      ),
    );
    const statuses = results.map((r) => r.status);
    expect(statuses.filter((s) => s === 201)).toHaveLength(1);
    expect(statuses.filter((s) => s === 409)).toHaveLength(9);
    const rows = await db
      .select()
      .from(bookings)
      .where(eq(bookings.barberProfileId, barber.profileId));
    expect(rows).toHaveLength(1);
  });

  it("sans le verrou applicatif, la contrainte d'exclusion refuse les insertions simultanées qui se chevauchent", async () => {
    const barber = await seedBarber();
    const clientId = await createUser("pg-raw@example.com", "CLIENT");
    const start = new Date(Date.now() + 72 * 3_600_000);

    const attempts = await Promise.allSettled(
      Array.from({ length: 8 }, (_, i) =>
        db.transaction(async (tx) => {
          await tx.insert(bookings).values({
            id: randomUUID(),
            clientUserId: clientId,
            barberProfileId: barber.profileId,
            serviceId: barber.serviceId,
            startAt: new Date(start.getTime() + i * 60_000),
            endAt: new Date(start.getTime() + (30 + i) * 60_000),
            servicePlace: "SALON",
            status: i % 2 === 0 ? "PENDING" : "CONFIRMED",
            barberDisplayName: "Barbier PG",
            serviceName: "Coupe",
            serviceDescription: null,
            durationMinutes: 30,
            priceMinor: 2500,
            currency: "CHF",
          });
        }),
      ),
    );
    expect(attempts.filter((a) => a.status === "fulfilled")).toHaveLength(1);
    for (const failure of attempts.filter((a) => a.status === "rejected")) {
      const reason = (failure as PromiseRejectedResult).reason as { cause?: { code?: string } };
      expect(reason.cause?.code).toBe("23P01");
    }
  });

  it("confirm et cancel simultanés : jamais annulée puis confirmée", async () => {
    const barber = await seedBarber();
    const clientId = await createUser("pg-client@example.com", "CLIENT");
    const barberSession = await login("pg-barber@example.com");
    const clientSession = await login("pg-client@example.com");

    for (let i = 0; i < 20; i += 1) {
      const id = randomUUID();
      const startAt = new Date(Date.now() + (48 + i) * 3_600_000);
      await db.insert(bookings).values({
        id,
        clientUserId: clientId,
        barberProfileId: barber.profileId,
        serviceId: barber.serviceId,
        startAt,
        endAt: new Date(startAt.getTime() + 30 * 60_000),
        servicePlace: "SALON",
        status: "PENDING",
        barberDisplayName: "Barbier PG",
        serviceName: "Coupe",
        serviceDescription: null,
        durationMinutes: 30,
        priceMinor: 2500,
        currency: "CHF",
      });
      const [confirm, cancel] = await Promise.all([
        barberSession.agent.post(`/api/bookings/${id}/confirm`).set("X-CSRF-Token", barberSession.csrf),
        clientSession.agent.post(`/api/bookings/${id}/cancel`).set("X-CSRF-Token", clientSession.csrf),
      ]);
      const [row] = await db.select().from(bookings).where(eq(bookings.id, id));
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
