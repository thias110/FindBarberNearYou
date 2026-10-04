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
import { weekdayFromCalendarDate } from "@findbarber/shared/dates";

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

function profilePayload(overrides: Record<string, unknown> = {}) {
  return {
    displayName: "Barbier Avis",
    description: "Coupes soignées",
    address: "Rue du Test 1",
    city: "Genève",
    postalCode: "1201",
    countryCode: "CH",
    latitude: 46.2044,
    longitude: 6.1432,
    currency: "CHF",
    places: ["SALON"],
    timezone: "UTC",
    ...overrides,
  };
}

async function register(email: string, role: "CLIENT" | "BARBER") {
  const res = await request(app)
    .post("/api/auth/register")
    .send({ email, password: PASSWORD, role });
  expect(res.status).toBe(201);
  return res.body.user as { id: string; email: string };
}

async function login(email: string) {
  const agent = request.agent(app);
  const res = await agent
    .post("/api/auth/login")
    .send({ email, password: PASSWORD });
  expect(res.status).toBe(200);
  return { agent, csrf: res.body.csrfToken as string };
}

function futureDate(daysFromNow: number): string {
  const date = new Date();
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() + daysFromNow);
  return date.toISOString().slice(0, 10);
}

interface BookableBarber {
  agent: request.SuperAgentTest;
  csrf: string;
  barberId: string;
  serviceId: string;
}

async function setupBookableBarber(
  email: string,
  date: string,
): Promise<BookableBarber> {
  await register(email, "BARBER");
  const { agent, csrf } = await login(email);

  const profile = await agent
    .put("/api/barber/profile")
    .set("X-CSRF-Token", csrf)
    .send(profilePayload());
  expect(profile.status).toBe(200);
  const barberId = profile.body.profile.id as string;

  const service = await agent
    .post("/api/barber/services")
    .set("X-CSRF-Token", csrf)
    .send({
      name: "Coupe classique",
      description: "Coupe + finitions",
      durationMinutes: 30,
      priceMinor: 2500,
    });
  expect(service.status).toBe(201);
  const serviceId = service.body.service.id as string;

  const weekday = weekdayFromCalendarDate(date);
  const hours = await agent
    .put("/api/barber/working-hours")
    .set("X-CSRF-Token", csrf)
    .send({ intervals: [{ weekday, startMinute: 540, endMinute: 1080 }] });
  expect(hours.status).toBe(200);

  return { agent, csrf, barberId, serviceId };
}

async function createBooking(
  client: { agent: request.SuperAgentTest; csrf: string },
  barberId: string,
  serviceId: string,
  date: string,
): Promise<string> {
  const res = await client.agent
    .post("/api/bookings")
    .set("X-CSRF-Token", client.csrf)
    .send({ barberId, serviceId, date, startMinute: 540, place: "SALON" });
  expect(res.status).toBe(201);
  return res.body.booking.id as string;
}

describe("POST /api/bookings/:bookingId/complete", () => {
  it("lets the owner barber complete a CONFIRMED booking", async () => {
    const date = futureDate(7);
    const { agent, csrf, barberId, serviceId } = await setupBookableBarber(
      "complete@example.com",
      date,
    );
    await register("complete-client@example.com", "CLIENT");
    const client = await login("complete-client@example.com");
    const id = await createBooking(client, barberId, serviceId, date);

    await agent
      .post(`/api/bookings/${id}/confirm`)
      .set("X-CSRF-Token", csrf);

    const res = await agent
      .post(`/api/bookings/${id}/complete`)
      .set("X-CSRF-Token", csrf);
    expect(res.status).toBe(200);
    expect(res.body.booking.status).toBe("COMPLETED");
    expect(res.body.booking.hasReview).toBe(false);
  });

  it("rejects completing a non-CONFIRMED booking", async () => {
    const date = futureDate(7);
    const { agent, csrf, barberId, serviceId } = await setupBookableBarber(
      "complete-pending@example.com",
      date,
    );
    await register("complete-pending-client@example.com", "CLIENT");
    const client = await login("complete-pending-client@example.com");
    const id = await createBooking(client, barberId, serviceId, date);

    const res = await agent
      .post(`/api/bookings/${id}/complete`)
      .set("X-CSRF-Token", csrf);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("INVALID_STATUS_TRANSITION");
  });

  it("denies a CLIENT and an ADMIN", async () => {
    const date = futureDate(7);
    const { agent, csrf, barberId, serviceId } = await setupBookableBarber(
      "complete-roles@example.com",
      date,
    );
    await register("complete-roles-client@example.com", "CLIENT");
    const client = await login("complete-roles-client@example.com");
    const id = await createBooking(client, barberId, serviceId, date);

    await agent
      .post(`/api/bookings/${id}/confirm`)
      .set("X-CSRF-Token", csrf);

    const clientRes = await client.agent
      .post(`/api/bookings/${id}/complete`)
      .set("X-CSRF-Token", client.csrf);
    expect(clientRes.status).toBe(403);

    const passwordHash = await bcrypt.hash(PASSWORD, 12);
    await db.insert(users).values({
      id: "admin-complete",
      email: "admin-complete@example.com",
      passwordHash,
      role: "ADMIN",
      status: "ACTIVE",
    });
    const admin = await login("admin-complete@example.com");
    const adminRes = await admin.agent
      .post(`/api/bookings/${id}/complete`)
      .set("X-CSRF-Token", admin.csrf);
    expect(adminRes.status).toBe(403);
  });

  it("returns 404 for another barber's booking", async () => {
    const date = futureDate(7);
    const owner = await setupBookableBarber("complete-owner@example.com", date);
    await register("complete-owner-client@example.com", "CLIENT");
    const client = await login("complete-owner-client@example.com");
    const id = await createBooking(
      client,
      owner.barberId,
      owner.serviceId,
      date,
    );
    await owner.agent
      .post(`/api/bookings/${id}/confirm`)
      .set("X-CSRF-Token", owner.csrf);

    const other = await setupBookableBarber("complete-other@example.com", date);
    const res = await other.agent
      .post(`/api/bookings/${id}/complete`)
      .set("X-CSRF-Token", other.csrf);
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("BOOKING_NOT_FOUND");
  });
});

describe("POST /api/bookings/:bookingId/review", () => {
  it("lets the owner client review a COMPLETED booking", async () => {
    const date = futureDate(7);
    const { barberId, serviceId } = await setupBookableBarber(
      "review@example.com",
      date,
    );
    await register("review-client@example.com", "CLIENT");
    const client = await login("review-client@example.com");
    const id = await createBooking(client, barberId, serviceId, date);
    await db
      .update(bookings)
      .set({ status: "COMPLETED" })
      .where(eq(bookings.id, id));

    const res = await client.agent
      .post(`/api/bookings/${id}/review`)
      .set("X-CSRF-Token", client.csrf)
      .send({ rating: 5, comment: "  Super coupe !  " });
    expect(res.status).toBe(201);
    expect(res.body.review).toEqual({
      id: expect.any(String),
      rating: 5,
      comment: "Super coupe !",
      createdAt: expect.any(String),
      clientName: null,
    });

    const [row] = await db
      .select()
      .from(reviews)
      .where(eq(reviews.bookingId, id));
    expect(row.rating).toBe(5);
    expect(row.comment).toBe("Super coupe !");
  });

  it("rejects invalid ratings", async () => {
    const date = futureDate(7);
    const { barberId, serviceId } = await setupBookableBarber(
      "review-rating@example.com",
      date,
    );
    await register("review-rating-client@example.com", "CLIENT");
    const client = await login("review-rating-client@example.com");
    const id = await createBooking(client, barberId, serviceId, date);
    await db
      .update(bookings)
      .set({ status: "COMPLETED" })
      .where(eq(bookings.id, id));

    for (const rating of [0, 6, 2.5]) {
      const res = await client.agent
        .post(`/api/bookings/${id}/review`)
        .set("X-CSRF-Token", client.csrf)
        .send({ rating });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    }
  });

  it("rejects an overlong comment and unknown fields", async () => {
    const date = futureDate(7);
    const { barberId, serviceId } = await setupBookableBarber(
      "review-comment@example.com",
      date,
    );
    await register("review-comment-client@example.com", "CLIENT");
    const client = await login("review-comment-client@example.com");
    const id = await createBooking(client, barberId, serviceId, date);
    await db
      .update(bookings)
      .set({ status: "COMPLETED" })
      .where(eq(bookings.id, id));

    const tooLong = await client.agent
      .post(`/api/bookings/${id}/review`)
      .set("X-CSRF-Token", client.csrf)
      .send({ rating: 5, comment: "a".repeat(1001) });
    expect(tooLong.status).toBe(400);
    expect(tooLong.body.error.code).toBe("VALIDATION_ERROR");

    const unknown = await client.agent
      .post(`/api/bookings/${id}/review`)
      .set("X-CSRF-Token", client.csrf)
      .send({ rating: 5, barberId: barberId });
    expect(unknown.status).toBe(400);
    expect(unknown.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("rejects a review for a booking that is not COMPLETED", async () => {
    const date = futureDate(7);
    const { barberId, serviceId } = await setupBookableBarber(
      "review-not-completed@example.com",
      date,
    );
    await register("review-not-completed-client@example.com", "CLIENT");
    const client = await login("review-not-completed-client@example.com");
    const id = await createBooking(client, barberId, serviceId, date);

    const res = await client.agent
      .post(`/api/bookings/${id}/review`)
      .set("X-CSRF-Token", client.csrf)
      .send({ rating: 5 });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("BOOKING_NOT_COMPLETED");
  });

  it("returns 404 for another client and 403 for a BARBER", async () => {
    const date = futureDate(7);
    const { barberId, serviceId } = await setupBookableBarber(
      "review-roles@example.com",
      date,
    );
    await register("review-roles-client@example.com", "CLIENT");
    const client = await login("review-roles-client@example.com");
    const id = await createBooking(client, barberId, serviceId, date);
    await db
      .update(bookings)
      .set({ status: "COMPLETED" })
      .where(eq(bookings.id, id));

    await register("review-roles-other@example.com", "CLIENT");
    const otherClient = await login("review-roles-other@example.com");
    const other = await otherClient.agent
      .post(`/api/bookings/${id}/review`)
      .set("X-CSRF-Token", otherClient.csrf)
      .send({ rating: 5 });
    expect(other.status).toBe(404);

    const barber = await login("review-roles@example.com");
    const barberRes = await barber.agent
      .post(`/api/bookings/${id}/review`)
      .set("X-CSRF-Token", barber.csrf)
      .send({ rating: 5 });
    expect(barberRes.status).toBe(403);
  });

  it("enforces a single review per booking (DB unique constraint)", async () => {
    const date = futureDate(7);
    const { barberId, serviceId } = await setupBookableBarber(
      "review-duplicate@example.com",
      date,
    );
    await register("review-duplicate-client@example.com", "CLIENT");
    const client = await login("review-duplicate-client@example.com");
    const id = await createBooking(client, barberId, serviceId, date);
    await db
      .update(bookings)
      .set({ status: "COMPLETED" })
      .where(eq(bookings.id, id));

    const first = await client.agent
      .post(`/api/bookings/${id}/review`)
      .set("X-CSRF-Token", client.csrf)
      .send({ rating: 5 });
    expect(first.status).toBe(201);

    const second = await client.agent
      .post(`/api/bookings/${id}/review`)
      .set("X-CSRF-Token", client.csrf)
      .send({ rating: 4 });
    expect(second.status).toBe(409);
    expect(second.body.error.code).toBe("REVIEW_ALREADY_EXISTS");
  });
});

describe("GET /api/barbers/:barberId/reviews", () => {
  it("exposes only the public whitelist with summary and pagination", async () => {
    const date = futureDate(7);
    const { barberId, serviceId } = await setupBookableBarber(
      "public-reviews@example.com",
      date,
    );

    async function seedReview(email: string, rating: number, comment: string) {
      await register(email, "CLIENT");
      const client = await login(email);
      const id = await createBooking(client, barberId, serviceId, date);
      await db
        .update(bookings)
        .set({ status: "COMPLETED" })
        .where(eq(bookings.id, id));
      const res = await client.agent
        .post(`/api/bookings/${id}/review`)
        .set("X-CSRF-Token", client.csrf)
        .send({ rating, comment });
      expect(res.status).toBe(201);
    }

    await seedReview("public-a@example.com", 5, "Excellent !");
    await seedReview("public-b@example.com", 4, "Très bien.");

    const res = await request(app).get(`/api/barbers/${barberId}/reviews`);
    expect(res.status).toBe(200);
    expect(res.body.summary).toEqual({ averageRating: 4.5, totalReviews: 2 });
    expect(res.body.pagination).toEqual({
      page: 1,
      pageSize: 5,
      total: 2,
      totalPages: 1,
    });
    expect(res.body.reviews).toHaveLength(2);
    for (const review of res.body.reviews) {
      expect(Object.keys(review).sort()).toEqual([
        "clientName",
        "comment",
        "createdAt",
        "id",
        "rating",
      ]);
      expect(review).not.toHaveProperty("clientAddress");
      expect(review).not.toHaveProperty("bookingId");
      expect(review).not.toHaveProperty("email");
      expect(review).not.toHaveProperty("clientUserId");
    }
  });

  it("returns an empty summary for a barber without reviews", async () => {
    const date = futureDate(7);
    const { barberId } = await setupBookableBarber("empty-reviews@example.com", date);

    const res = await request(app).get(`/api/barbers/${barberId}/reviews`);
    expect(res.status).toBe(200);
    expect(res.body.summary).toEqual({ averageRating: null, totalReviews: 0 });
    expect(res.body.reviews).toEqual([]);
    expect(res.body.pagination.total).toBe(0);
    expect(res.body.pagination.totalPages).toBe(0);
  });

  it("returns 404 for an unknown barber", async () => {
    const res = await request(app).get("/api/barbers/missing/reviews");
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("BARBER_PROFILE_NOT_FOUND");
  });
});
