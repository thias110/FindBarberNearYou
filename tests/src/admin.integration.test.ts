import { randomUUID } from "node:crypto";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { createApp } from "../../server/src/app";
import { db } from "../../server/src/db/client";
import { migrateDb } from "../../server/src/db/migrate";
import {
  barberProfiles,
  barberServices,
  barberTimeOff,
  barberWorkingHours,
  bookings,
  reviews,
  users,
} from "@findbarber/shared/schema";
import type { BookingStatus } from "@findbarber/shared/constants";
import { suspendUser } from "../../server/src/modules/admin/service";

const app = createApp();
const PASSWORD = "password123";

beforeAll(async () => {
  await migrateDb();
});

beforeEach(async () => {
  // Nettoyage dans l'ordre des clés étrangères (avis → réservations → …).
  await db.delete(reviews);
  await db.delete(bookings);
  await db.delete(barberTimeOff);
  await db.delete(barberWorkingHours);
  await db.delete(barberServices);
  await db.delete(barberProfiles);
  await db.delete(users);
});

async function createUser(
  email: string,
  role: "CLIENT" | "BARBER" | "ADMIN",
): Promise<{ id: string }> {
  const passwordHash = await bcrypt.hash(PASSWORD, 12);
  const [row] = await db
    .insert(users)
    .values({ id: randomUUID(), email, passwordHash, role, status: "ACTIVE" })
    .returning({ id: users.id });
  return row;
}

async function login(email: string) {
  const agent = request.agent(app);
  const res = await agent
    .post("/api/auth/login")
    .send({ email, password: PASSWORD });
  expect(res.status).toBe(200);
  return { agent, csrf: res.body.csrfToken as string };
}

async function seedBarber(email: string, timezone = "UTC") {
  const { id: userId } = await createUser(email, "BARBER");
  const profileId = randomUUID();
  await db.insert(barberProfiles).values({
    id: profileId,
    userId,
    displayName: "Barbier Admin",
    description: "Coupes soignées",
    city: "Genève",
    countryCode: "CH",
    latitude: 46.2044,
    longitude: 6.1432,
    currency: "CHF",
    timezone,
  });
  const serviceId = randomUUID();
  await db.insert(barberServices).values({
    id: serviceId,
    barberProfileId: profileId,
    name: "Coupe classique",
    description: null,
    durationMinutes: 30,
    priceMinor: 2500,
  });
  return { userId, profileId, serviceId };
}

async function insertBooking(input: {
  barberProfileId: string;
  serviceId: string;
  clientUserId: string;
  startAt: Date;
  status: BookingStatus;
  priceMinor?: number;
}): Promise<string> {
  const [row] = await db
    .insert(bookings)
    .values({
      id: randomUUID(),
      clientUserId: input.clientUserId,
      barberProfileId: input.barberProfileId,
      serviceId: input.serviceId,
      startAt: input.startAt,
      endAt: new Date(input.startAt.getTime() + 30 * 60_000),
      servicePlace: "SALON",
      status: input.status,
      barberDisplayName: "Barbier Admin",
      serviceName: "Coupe classique",
      serviceDescription: null,
      durationMinutes: 30,
      priceMinor: input.priceMinor ?? 2500,
      currency: "CHF",
    })
    .returning({ id: bookings.id });
  return row.id;
}

describe("GET /api/admin/* — accès admin only", () => {
  it("refuse CLIENT et BARBER (403) et non authentifié (401)", async () => {
    await createUser("client@example.com", "CLIENT");
    await createUser("barber@example.com", "BARBER");
    const client = await login("client@example.com");
    const barber = await login("barber@example.com");

    for (const { agent } of [client, barber]) {
      const res = await agent.get("/api/admin/metrics");
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe("FORBIDDEN");
    }

    const anon = await request(app).get("/api/admin/metrics");
    expect(anon.status).toBe(401);
  });
});

describe("GET /api/admin/users", () => {
  it("liste les users paginés et filtrés par rôle", async () => {
    await createUser("admin@example.com", "ADMIN");
    await createUser("c1@example.com", "CLIENT");
    await createUser("c2@example.com", "CLIENT");
    await createUser("b1@example.com", "BARBER");
    const { agent } = await login("admin@example.com");

    const page1 = await agent.get("/api/admin/users?page=1&pageSize=2");
    expect(page1.status).toBe(200);
    expect(page1.body.users).toHaveLength(2);
    expect(page1.body.pagination.total).toBe(4);

    const clients = await agent.get(
      "/api/admin/users?role=CLIENT&page=1&pageSize=10",
    );
    expect(clients.status).toBe(200);
    expect(clients.body.users).toHaveLength(2);
    expect(
      clients.body.users.every((u: { role: string }) => u.role === "CLIENT"),
    ).toBe(true);

    const invalid = await agent.get("/api/admin/users?role=SUPERADMIN");
    expect(invalid.status).toBe(400);
    expect(invalid.body.error.code).toBe("VALIDATION_ERROR");
  });
});

describe("POST /api/admin/users/:id/suspend et /reactivate", () => {
  it("suspend puis réactive un utilisateur", async () => {
    await createUser("admin@example.com", "ADMIN");
    const target = await createUser("target@example.com", "CLIENT");
    const { agent, csrf } = await login("admin@example.com");

    const suspended = await agent
      .post(`/api/admin/users/${target.id}/suspend`)
      .set("X-CSRF-Token", csrf);
    expect(suspended.status).toBe(200);
    expect(suspended.body.user.status).toBe("SUSPENDED");

    const reactivated = await agent
      .post(`/api/admin/users/${target.id}/reactivate`)
      .set("X-CSRF-Token", csrf);
    expect(reactivated.status).toBe(200);
    expect(reactivated.body.user.status).toBe("ACTIVE");
  });

  it("interdit l'auto-suspension", async () => {
    const admin = await createUser("admin@example.com", "ADMIN");
    const { agent, csrf } = await login("admin@example.com");

    const res = await agent
      .post(`/api/admin/users/${admin.id}/suspend`)
      .set("X-CSRF-Token", csrf);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("SELF_SUSPENSION_FORBIDDEN");
  });

  it("interdit de suspendre le dernier ADMIN actif (service)", async () => {
    const admin = await createUser("solo@example.com", "ADMIN");
    await expect(
      suspendUser("non-admin-actor-id", admin.id),
    ).rejects.toMatchObject({ code: "LAST_ACTIVE_ADMIN_FORBIDDEN" });
  });

  it("annule les réservations futures PENDING/CONFIRMED d'un barber suspendu", async () => {
    await createUser("admin@example.com", "ADMIN");
    const barber = await seedBarber("barber@example.com", "UTC");
    const client = await createUser("client@example.com", "CLIENT");

    const future = new Date(Date.now() + 24 * 3_600_000);
    const past = new Date(Date.now() - 24 * 3_600_000);

    await insertBooking({
      barberProfileId: barber.profileId,
      serviceId: barber.serviceId,
      clientUserId: client.id,
      startAt: future,
      status: "PENDING",
    });
    await insertBooking({
      barberProfileId: barber.profileId,
      serviceId: barber.serviceId,
      clientUserId: client.id,
      startAt: future,
      status: "CONFIRMED",
    });
    await insertBooking({
      barberProfileId: barber.profileId,
      serviceId: barber.serviceId,
      clientUserId: client.id,
      startAt: future,
      status: "COMPLETED",
    });
    await insertBooking({
      barberProfileId: barber.profileId,
      serviceId: barber.serviceId,
      clientUserId: client.id,
      startAt: past,
      status: "CONFIRMED",
    });

    const { agent, csrf } = await login("admin@example.com");
    const res = await agent
      .post(`/api/admin/users/${barber.userId}/suspend`)
      .set("X-CSRF-Token", csrf);
    expect(res.status).toBe(200);
    expect(res.body.user.status).toBe("SUSPENDED");

    const rows = await db
      .select()
      .from(bookings)
      .where(eq(bookings.barberProfileId, barber.profileId));

    const cancelled = rows.filter((row) => row.status === "CANCELLED");
    expect(cancelled).toHaveLength(2);
    for (const row of cancelled) {
      expect(row.cancelledBy).toBe("ADMIN");
      expect(row.startAt.getTime()).toBeGreaterThanOrEqual(future.getTime() - 1000);
    }
    // La réservation future COMPLETED et la passée CONFIRMED restent intactes.
    expect(rows.some((row) => row.status === "COMPLETED")).toBe(true);
    expect(
      rows.some(
        (row) => row.status === "CONFIRMED" && row.startAt.getTime() < future.getTime(),
      ),
    ).toBe(true);
  });
});

describe("GET /api/admin/reviews et masquage", () => {
  it("masque un avis, l'exclut des lectures publiques mais pas de l'admin", async () => {
    await createUser("admin@example.com", "ADMIN");
    const barber = await seedBarber("barber@example.com", "UTC");
    const client = await createUser("client@example.com", "CLIENT");

    const bookingId = await insertBooking({
      barberProfileId: barber.profileId,
      serviceId: barber.serviceId,
      clientUserId: client.id,
      startAt: new Date(Date.now() - 24 * 3_600_000),
      status: "COMPLETED",
    });
    const [review] = await db
      .insert(reviews)
      .values({ id: randomUUID(), bookingId, rating: 5, comment: "Super" })
      .returning({ id: reviews.id });
    expect(review).toBeDefined();

    const { agent, csrf } = await login("admin@example.com");
    const hidden = await agent
      .post(`/api/admin/reviews/${review.id}/hide`)
      .set("X-CSRF-Token", csrf);
    expect(hidden.status).toBe(200);
    expect(hidden.body.review.hiddenAt).not.toBeNull();

    // Lecture publique : avis masqué exclu de la liste et du résumé.
    const publicRes = await request(app).get(
      `/api/barbers/${barber.profileId}/reviews`,
    );
    expect(publicRes.status).toBe(200);
    expect(publicRes.body.reviews).toHaveLength(0);
    expect(publicRes.body.summary.totalReviews).toBe(0);
    expect(publicRes.body.summary.averageRating).toBeNull();

    // Lecture admin : l'avis reste visible avec hiddenAt renseigné.
    const adminRes = await agent.get("/api/admin/reviews?page=1&pageSize=10");
    expect(adminRes.status).toBe(200);
    expect(adminRes.body.reviews).toHaveLength(1);
    expect(adminRes.body.reviews[0].hiddenAt).not.toBeNull();
  });
});

describe("GET /api/admin/barbers/:id/stats", () => {
  it("retourne les stats d'un barber ciblé, isolées par profil", async () => {
    await createUser("admin@example.com", "ADMIN");
    const barberA = await seedBarber("a@example.com", "UTC");
    const barberB = await seedBarber("b@example.com", "UTC");
    const client = await createUser("client@example.com", "CLIENT");
    const now = new Date();

    await insertBooking({
      barberProfileId: barberA.profileId,
      serviceId: barberA.serviceId,
      clientUserId: client.id,
      startAt: now,
      status: "COMPLETED",
      priceMinor: 3000,
    });
    await insertBooking({
      barberProfileId: barberB.profileId,
      serviceId: barberB.serviceId,
      clientUserId: client.id,
      startAt: now,
      status: "COMPLETED",
      priceMinor: 1000,
    });

    const { agent } = await login("admin@example.com");
    const res = await agent.get(
      `/api/admin/barbers/${barberA.profileId}/stats?range=30d`,
    );
    expect(res.status).toBe(200);
    expect(res.body.totals.bookings).toBe(1);
    expect(res.body.totals.revenueMinor).toBe(3000);

    const missing = await agent.get(
      `/api/admin/barbers/${randomUUID()}/stats?range=30d`,
    );
    expect(missing.status).toBe(404);
    expect(missing.body.error.code).toBe("BARBER_PROFILE_NOT_FOUND");
  });
});
