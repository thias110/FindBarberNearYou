import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { beforeAll, beforeEach, afterEach, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../../server/src/app";
import { db } from "../../server/src/db/client";
import { migrateDb } from "../../server/src/db/migrate";
import {
  barberProfiles,
  barberServices,
  barberTimeOff,
  barberWorkingHours,
  bookings,
  users,
} from "@findbarber/shared/schema";
import { weekdayFromCalendarDate } from "@findbarber/shared/dates";
import { setGeocoder, type Geocoder } from "../../server/src/lib/geocoding";
import { AppError } from "../../server/src/lib/errors";

const app = createApp();
const PASSWORD = "password123";

const BARBER_COORDS = { latitude: 46.2044, longitude: 6.1432 };
const NEAR_CLIENT_COORDS = { latitude: 46.208, longitude: 6.148 }; // ≈ 0,5 km
const FAR_CLIENT_COORDS = { latitude: 47.3769, longitude: 8.5417 }; // ≈ 224 km

beforeAll(async () => {
  await migrateDb();
});

beforeEach(async () => {
  // Nettoyage dans l'ordre des clés étrangères.
  await db.delete(bookings);
  await db.delete(barberTimeOff);
  await db.delete(barberWorkingHours);
  await db.delete(barberServices);
  await db.delete(barberProfiles);
  await db.delete(users);
  setGeocoder(null);
});

afterEach(() => {
  setGeocoder(null);
});

function mockGeocoder(result = NEAR_CLIENT_COORDS): Geocoder {
  return { geocode: async () => result };
}

function failingGeocoder(error: AppError): Geocoder {
  return {
    geocode: async () => {
      throw error;
    },
  };
}

function profilePayload(overrides: Record<string, unknown> = {}) {
  return {
    displayName: "Barbier Test",
    description: "Coupes et barbes soignées",
    address: "Rue du Test 1",
    city: "Genève",
    postalCode: "1201",
    countryCode: "CH",
    latitude: BARBER_COORDS.latitude,
    longitude: BARBER_COORDS.longitude,
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

async function setupBookableBarber(
  email: string,
  date: string,
  overrides: Record<string, unknown> = {},
) {
  await register(email, "BARBER");
  const { agent, csrf } = await login(email);

  const profile = await agent
    .put("/api/barber/profile")
    .set("X-CSRF-Token", csrf)
    .send(profilePayload(overrides));
  expect(profile.status).toBe(200);
  const barberId = profile.body.profile.id as string;

  const service = await agent
    .post("/api/barber/services")
    .set("X-CSRF-Token", csrf)
    .send({
      name: "Coupe à domicile",
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
  agent: request.SuperAgentTest,
  csrf: string,
  payload: Record<string, unknown>,
) {
  return agent
    .post("/api/bookings")
    .set("X-CSRF-Token", csrf)
    .send(payload);
}

const AT_CLIENT_OVERRIDES = {
  places: ["AT_CLIENT"],
  address: null,
  travelRadiusKm: 10,
};

describe("AT_CLIENT booking — adresse et zone", () => {
  it("rejects AT_CLIENT without an address (validation)", async () => {
    const date = futureDate(7);
    const { barberId, serviceId } = await setupBookableBarber(
      "atclient-no-address@example.com",
      date,
      AT_CLIENT_OVERRIDES,
    );
    await register("atclient-no-address-client@example.com", "CLIENT");
    const client = await login("atclient-no-address-client@example.com");

    const res = await createBooking(client.agent, client.csrf, {
      barberId,
      serviceId,
      date,
      startMinute: 540,
      place: "AT_CLIENT",
    });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("creates an AT_CLIENT booking inside the radius and stores private details", async () => {
    setGeocoder(mockGeocoder(NEAR_CLIENT_COORDS));
    const date = futureDate(7);
    const { barberId, serviceId } = await setupBookableBarber(
      "atclient-ok@example.com",
      date,
      AT_CLIENT_OVERRIDES,
    );
    await register("atclient-ok-client@example.com", "CLIENT");
    const client = await login("atclient-ok-client@example.com");

    const res = await createBooking(client.agent, client.csrf, {
      barberId,
      serviceId,
      date,
      startMinute: 540,
      place: "AT_CLIENT",
      clientAddress: "Rue du Client 1, Genève",
    });
    expect(res.status).toBe(201);
    expect(res.body.booking.servicePlace).toBe("AT_CLIENT");
    // La réponse de création est publique : pas d'adresse.
    expect(res.body.booking).not.toHaveProperty("clientAddress");

    const [row] = await db.select().from(bookings);
    expect(row.clientAddress).toBe("Rue du Client 1, Genève");
    expect(row.clientLatitude).toBe(NEAR_CLIENT_COORDS.latitude);
    expect(row.clientLongitude).toBe(NEAR_CLIENT_COORDS.longitude);

    // Détail privé pour le propriétaire.
    const detail = await client.agent.get(`/api/bookings/${row.id}`);
    expect(detail.status).toBe(200);
    expect(detail.body.booking.clientAddress).toBe("Rue du Client 1, Genève");
    expect(detail.body.booking.clientLatitude).toBe(NEAR_CLIENT_COORDS.latitude);
    expect(detail.body.booking.clientLongitude).toBe(NEAR_CLIENT_COORDS.longitude);

    // La liste (même pour le propriétaire) n'expose pas l'adresse.
    const list = await client.agent.get("/api/bookings");
    expect(list.status).toBe(200);
    expect(list.body.bookings[0]).not.toHaveProperty("clientAddress");
    expect(list.body.bookings[0]).not.toHaveProperty("clientLatitude");
    expect(list.body.bookings[0]).not.toHaveProperty("clientLongitude");
  });

  it("rejects an address outside the travel radius with OUT_OF_SERVICE_AREA", async () => {
    setGeocoder(mockGeocoder(FAR_CLIENT_COORDS));
    const date = futureDate(7);
    const { barberId, serviceId } = await setupBookableBarber(
      "atclient-far@example.com",
      date,
      AT_CLIENT_OVERRIDES,
    );
    await register("atclient-far-client@example.com", "CLIENT");
    const client = await login("atclient-far-client@example.com");

    const res = await createBooking(client.agent, client.csrf, {
      barberId,
      serviceId,
      date,
      startMinute: 540,
      place: "AT_CLIENT",
      clientAddress: "Bahnhofstrasse 1, Zürich",
    });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("OUT_OF_SERVICE_AREA");
    expect(await db.select().from(bookings)).toHaveLength(0);
  });

  it("propagates GEOCODING_UNAVAILABLE", async () => {
    setGeocoder(
      failingGeocoder(
        new AppError(503, "GEOCODING_UNAVAILABLE", "Service indisponible."),
      ),
    );
    const date = futureDate(7);
    const { barberId, serviceId } = await setupBookableBarber(
      "atclient-geo-down@example.com",
      date,
      AT_CLIENT_OVERRIDES,
    );
    await register("atclient-geo-down-client@example.com", "CLIENT");
    const client = await login("atclient-geo-down-client@example.com");

    const res = await createBooking(client.agent, client.csrf, {
      barberId,
      serviceId,
      date,
      startMinute: 540,
      place: "AT_CLIENT",
      clientAddress: "Rue du Client 1",
    });
    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe("GEOCODING_UNAVAILABLE");
  });

  it("propagates ADDRESS_NOT_FOUND", async () => {
    setGeocoder(
      failingGeocoder(
        new AppError(404, "ADDRESS_NOT_FOUND", "Adresse introuvable."),
      ),
    );
    const date = futureDate(7);
    const { barberId, serviceId } = await setupBookableBarber(
      "atclient-not-found@example.com",
      date,
      AT_CLIENT_OVERRIDES,
    );
    await register("atclient-not-found-client@example.com", "CLIENT");
    const client = await login("atclient-not-found-client@example.com");

    const res = await createBooking(client.agent, client.csrf, {
      barberId,
      serviceId,
      date,
      startMinute: 540,
      place: "AT_CLIENT",
      clientAddress: "Adresse inexistante",
    });
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("ADDRESS_NOT_FOUND");
  });
});

describe("SALON / AT_PROVIDER — pas d'adresse client", () => {
  it("stores no client address for SALON", async () => {
    const date = futureDate(7);
    const { barberId, serviceId } = await setupBookableBarber(
      "salon-no-address@example.com",
      date,
    );
    await register("salon-no-address-client@example.com", "CLIENT");
    const client = await login("salon-no-address-client@example.com");

    const res = await createBooking(client.agent, client.csrf, {
      barberId,
      serviceId,
      date,
      startMinute: 540,
      place: "SALON",
    });
    expect(res.status).toBe(201);

    const [row] = await db.select().from(bookings);
    expect(row.clientAddress).toBeNull();
    expect(row.clientLatitude).toBeNull();
    expect(row.clientLongitude).toBeNull();
  });

  it("rejects a client address for SALON and AT_PROVIDER", async () => {
    const date = futureDate(7);
    const { barberId, serviceId } = await setupBookableBarber(
      "salon-forbid-address@example.com",
      date,
    );
    await register("salon-forbid-address-client@example.com", "CLIENT");
    const client = await login("salon-forbid-address-client@example.com");

    for (const place of ["SALON", "AT_PROVIDER"]) {
      const res = await createBooking(client.agent, client.csrf, {
        barberId,
        serviceId,
        date,
        startMinute: 540,
        place,
        clientAddress: "Rue du Client 1",
      });
      expect(res.status, place).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    }
    expect(await db.select().from(bookings)).toHaveLength(0);
  });
});

describe("private booking details access", () => {
  async function createAtClientBooking() {
    setGeocoder(mockGeocoder(NEAR_CLIENT_COORDS));
    const date = futureDate(7);
    const barber = await setupBookableBarber(
      "detail-barber@example.com",
      date,
      AT_CLIENT_OVERRIDES,
    );
    await register("detail-client@example.com", "CLIENT");
    const client = await login("detail-client@example.com");
    const created = await createBooking(client.agent, client.csrf, {
      barberId: barber.barberId,
      serviceId: barber.serviceId,
      date,
      startMinute: 540,
      place: "AT_CLIENT",
      clientAddress: "Rue du Client 1, Genève",
    });
    expect(created.status).toBe(201);
    return { bookingId: created.body.booking.id as string, barber, client };
  }

  async function createAdmin(email: string) {
    const passwordHash = await bcrypt.hash(PASSWORD, 12);
    await db.insert(users).values({
      id: randomUUID(),
      email,
      passwordHash,
      role: "ADMIN",
    });
    return login(email);
  }

  it("allows the owner client, the concerned barber and ADMIN", async () => {
    const { bookingId, barber, client } = await createAtClientBooking();
    const admin = await createAdmin("detail-admin@example.com");

    const asClient = await client.agent.get(`/api/bookings/${bookingId}`);
    expect(asClient.status).toBe(200);
    expect(asClient.body.booking.clientAddress).toBe("Rue du Client 1, Genève");

    const asBarber = await barber.agent.get(`/api/bookings/${bookingId}`);
    expect(asBarber.status).toBe(200);
    expect(asBarber.body.booking.clientAddress).toBe("Rue du Client 1, Genève");

    const asAdmin = await admin.agent.get(`/api/bookings/${bookingId}`);
    expect(asAdmin.status).toBe(200);
    expect(asAdmin.body.booking.clientAddress).toBe("Rue du Client 1, Genève");
  });

  it("returns 404 for another client and another barber", async () => {
    const { bookingId } = await createAtClientBooking();

    await register("detail-other-client@example.com", "CLIENT");
    const otherClient = await login("detail-other-client@example.com");
    const asOtherClient = await otherClient.agent.get(
      `/api/bookings/${bookingId}`,
    );
    expect(asOtherClient.status).toBe(404);

    const date = futureDate(7);
    const otherBarber = await setupBookableBarber(
      "detail-other-barber@example.com",
      date,
    );
    const asOtherBarber = await otherBarber.agent.get(
      `/api/bookings/${bookingId}`,
    );
    expect(asOtherBarber.status).toBe(404);
  });

  it("never exposes client address in public barber routes", async () => {
    const { bookingId, barber } = await createAtClientBooking();
    void bookingId;

    const profile = await request(app).get(`/api/barbers/${barber.barberId}`);
    expect(profile.status).toBe(200);
    expect(JSON.stringify(profile.body)).not.toContain("clientAddress");
    expect(JSON.stringify(profile.body)).not.toContain("clientLatitude");
    expect(JSON.stringify(profile.body)).not.toContain("Rue du Client 1");

    const search = await request(app).get("/api/barbers");
    expect(search.status).toBe(200);
    expect(JSON.stringify(search.body)).not.toContain("Rue du Client 1");
  });
});
