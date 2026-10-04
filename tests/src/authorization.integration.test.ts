// Matrice anti-IDOR : prouve qu'aucun utilisateur ne peut accéder à une
// ressource privée (réservation, détail, service, indisponibilité) par simple
// changement d'identifiant. Convention : 401 non authentifié, 403 refus global
// de rôle, 404 ressource privée inexistante OU non possédée.
import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
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
  reviews,
  users,
} from "@findbarber/shared/schema";
import { weekdayFromCalendarDate } from "@findbarber/shared/dates";
import { setGeocoder, type Geocoder } from "../../server/src/lib/geocoding";

const app = createApp();
const PASSWORD = "password123";
const NEAR_CLIENT_COORDS = { latitude: 46.208, longitude: 6.148 };

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
  setGeocoder(null);
});

afterEach(() => {
  setGeocoder(null);
});

function mockGeocoder(result = NEAR_CLIENT_COORDS): Geocoder {
  return { geocode: async () => result };
}

function profilePayload(overrides: Record<string, unknown> = {}) {
  return {
    displayName: "Barbier Test",
    description: "Coupes et barbes soignées",
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

async function createAdmin(email: string) {
  const passwordHash = await bcrypt.hash(PASSWORD, 12);
  await db.insert(users).values({
    id: randomUUID(),
    email,
    passwordHash,
    role: "ADMIN",
    status: "ACTIVE",
  });
  return login(email);
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
  overrides: Record<string, unknown> = {},
): Promise<BookableBarber> {
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
  extra: Record<string, unknown> = {},
): Promise<string> {
  const res = await client.agent
    .post("/api/bookings")
    .set("X-CSRF-Token", client.csrf)
    .send({ barberId, serviceId, date, startMinute: 540, place: "SALON", ...extra });
  expect(res.status).toBe(201);
  return res.body.booking.id as string;
}

describe("détail booking — anti-IDOR", () => {
  it("n'expose le détail privé qu'au propriétaire, au barber concerné et à ADMIN", async () => {
    const date = futureDate(7);
    const barberA = await setupBookableBarber("idor-detail-barber-a@example.com", date);
    await register("idor-detail-client-a@example.com", "CLIENT");
    const clientA = await login("idor-detail-client-a@example.com");
    const bookingId = await createBooking(
      clientA,
      barberA.barberId,
      barberA.serviceId,
      date,
    );

    await register("idor-detail-client-b@example.com", "CLIENT");
    const clientB = await login("idor-detail-client-b@example.com");
    const barberB = await setupBookableBarber("idor-detail-barber-b@example.com", date);
    const admin = await createAdmin("idor-detail-admin@example.com");

    const asOtherClient = await clientB.agent.get(`/api/bookings/${bookingId}`);
    expect(asOtherClient.status).toBe(404);
    expect(asOtherClient.body.error.code).toBe("BOOKING_NOT_FOUND");

    const asOtherBarber = await barberB.agent.get(`/api/bookings/${bookingId}`);
    expect(asOtherBarber.status).toBe(404);
    expect(asOtherBarber.body.error.code).toBe("BOOKING_NOT_FOUND");

    const asOwner = await clientA.agent.get(`/api/bookings/${bookingId}`);
    expect(asOwner.status).toBe(200);

    const asConcernedBarber = await barberA.agent.get(`/api/bookings/${bookingId}`);
    expect(asConcernedBarber.status).toBe(200);

    const asAdmin = await admin.agent.get(`/api/bookings/${bookingId}`);
    expect(asAdmin.status).toBe(200);
  });

  it("renvoie 401 sans authentification", async () => {
    const res = await request(app).get("/api/bookings/unknown-booking");
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHORIZED");
  });
});

describe("actions booking — anti-IDOR", () => {
  it("interdit au client B d'annuler la réservation du client A (404)", async () => {
    const date = futureDate(7);
    const barberA = await setupBookableBarber("idor-cancel-barber@example.com", date);
    await register("idor-cancel-client-a@example.com", "CLIENT");
    const clientA = await login("idor-cancel-client-a@example.com");
    const bookingId = await createBooking(clientA, barberA.barberId, barberA.serviceId, date);

    await register("idor-cancel-client-b@example.com", "CLIENT");
    const clientB = await login("idor-cancel-client-b@example.com");
    const res = await clientB.agent
      .post(`/api/bookings/${bookingId}/cancel`)
      .set("X-CSRF-Token", clientB.csrf);
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("BOOKING_NOT_FOUND");
  });

  it("interdit au barber B de confirmer ou terminer la réservation du barber A (404)", async () => {
    const date = futureDate(7);
    const barberA = await setupBookableBarber("idor-action-barber-a@example.com", date);
    await register("idor-action-client-a@example.com", "CLIENT");
    const clientA = await login("idor-action-client-a@example.com");
    const bookingId = await createBooking(clientA, barberA.barberId, barberA.serviceId, date);

    const barberB = await setupBookableBarber("idor-action-barber-b@example.com", date);
    const confirm = await barberB.agent
      .post(`/api/bookings/${bookingId}/confirm`)
      .set("X-CSRF-Token", barberB.csrf);
    expect(confirm.status).toBe(404);
    expect(confirm.body.error.code).toBe("BOOKING_NOT_FOUND");

    // Le propriétaire confirme, puis B tente de clôturer : toujours 404.
    const ownerConfirm = await barberA.agent
      .post(`/api/bookings/${bookingId}/confirm`)
      .set("X-CSRF-Token", barberA.csrf);
    expect(ownerConfirm.status).toBe(200);

    const complete = await barberB.agent
      .post(`/api/bookings/${bookingId}/complete`)
      .set("X-CSRF-Token", barberB.csrf);
    expect(complete.status).toBe(404);
    expect(complete.body.error.code).toBe("BOOKING_NOT_FOUND");
  });

  it("interdit au client B de déposer un avis sur la réservation du client A (404)", async () => {
    const date = futureDate(7);
    const barberA = await setupBookableBarber("idor-review-barber@example.com", date);
    await register("idor-review-client-a@example.com", "CLIENT");
    const clientA = await login("idor-review-client-a@example.com");
    const bookingId = await createBooking(clientA, barberA.barberId, barberA.serviceId, date);

    await barberA.agent
      .post(`/api/bookings/${bookingId}/confirm`)
      .set("X-CSRF-Token", barberA.csrf);
    await barberA.agent
      .post(`/api/bookings/${bookingId}/complete`)
      .set("X-CSRF-Token", barberA.csrf);

    await register("idor-review-client-b@example.com", "CLIENT");
    const clientB = await login("idor-review-client-b@example.com");
    const res = await clientB.agent
      .post(`/api/bookings/${bookingId}/review`)
      .set("X-CSRF-Token", clientB.csrf)
      .send({ rating: 1, comment: "Forcé" });
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("BOOKING_NOT_FOUND");
  });

  it("réserve les actions aux rôles attendus (403)", async () => {
    const date = futureDate(7);
    const barberA = await setupBookableBarber("idor-roles-barber@example.com", date);
    await register("idor-roles-client@example.com", "CLIENT");
    const client = await login("idor-roles-client@example.com");
    const bookingId = await createBooking(client, barberA.barberId, barberA.serviceId, date);
    const admin = await createAdmin("idor-roles-admin@example.com");

    const clientConfirm = await client.agent
      .post(`/api/bookings/${bookingId}/confirm`)
      .set("X-CSRF-Token", client.csrf);
    expect(clientConfirm.status).toBe(403);

    const clientComplete = await client.agent
      .post(`/api/bookings/${bookingId}/complete`)
      .set("X-CSRF-Token", client.csrf);
    expect(clientComplete.status).toBe(403);

    const barberReview = await barberA.agent
      .post(`/api/bookings/${bookingId}/review`)
      .set("X-CSRF-Token", barberA.csrf)
      .send({ rating: 5 });
    expect(barberReview.status).toBe(403);

    const adminComplete = await admin.agent
      .post(`/api/bookings/${bookingId}/complete`)
      .set("X-CSRF-Token", admin.csrf);
    expect(adminComplete.status).toBe(403);
  });

  it("renvoie 401 sans authentification sur les actions", async () => {
    const review = await request(app)
      .post("/api/bookings/unknown/review")
      .send({ rating: 5 });
    expect(review.status).toBe(401);

    const cancel = await request(app).post("/api/bookings/unknown/cancel");
    expect(cancel.status).toBe(401);
  });
});

describe("ressources barber privées — anti-IDOR", () => {
  it("interdit au barber B de modifier le service du barber A (404)", async () => {
    const date = futureDate(7);
    const barberA = await setupBookableBarber("idor-service-barber-a@example.com", date);
    const barberB = await setupBookableBarber("idor-service-barber-b@example.com", date);

    const res = await barberB.agent
      .patch(`/api/barber/services/${barberA.serviceId}`)
      .set("X-CSRF-Token", barberB.csrf)
      .send({ name: "Détournement" });
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("SERVICE_NOT_FOUND");
  });

  it("interdit au barber B de supprimer l'indisponibilité du barber A (404)", async () => {
    const date = futureDate(7);
    const barberA = await setupBookableBarber("idor-timeoff-barber-a@example.com", date);
    const barberB = await setupBookableBarber("idor-timeoff-barber-b@example.com", date);

    const created = await barberA.agent
      .post("/api/barber/time-off")
      .set("X-CSRF-Token", barberA.csrf)
      .send({ startDate: futureDate(10), endDate: futureDate(11) });
    expect(created.status).toBe(201);
    const timeOffId = created.body.timeOff.id as string;

    const res = await barberB.agent
      .delete(`/api/barber/time-off/${timeOffId}`)
      .set("X-CSRF-Token", barberB.csrf);
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("TIME_OFF_NOT_FOUND");
  });

  it("refuse un CLIENT sur les routes barber privées (403)", async () => {
    const date = futureDate(7);
    const barberA = await setupBookableBarber("idor-private-barber@example.com", date);
    await register("idor-private-client@example.com", "CLIENT");
    const client = await login("idor-private-client@example.com");

    const res = await client.agent
      .patch(`/api/barber/services/${barberA.serviceId}`)
      .set("X-CSRF-Token", client.csrf)
      .send({ name: "Interdit" });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("FORBIDDEN");
  });
});

describe("adresse privée AT_CLIENT — anti-IDOR", () => {
  async function setupAtClientBooking() {
    setGeocoder(mockGeocoder());
    const date = futureDate(7);
    const barber = await setupBookableBarber("idor-address-barber@example.com", date, {
      places: ["AT_CLIENT"],
      travelRadiusKm: 10,
    });
    await register("idor-address-client-a@example.com", "CLIENT");
    const clientA = await login("idor-address-client-a@example.com");
    const address = "Rue du Client 1, Genève";
    const bookingId = await createBooking(
      clientA,
      barber.barberId,
      barber.serviceId,
      date,
      { place: "AT_CLIENT", clientAddress: address },
    );
    return { barber, clientA, bookingId, address };
  }

  it("expose l'adresse au propriétaire, au barber concerné et à ADMIN", async () => {
    const { barber, clientA, bookingId, address } = await setupAtClientBooking();
    const admin = await createAdmin("idor-address-admin@example.com");

    const asOwner = await clientA.agent.get(`/api/bookings/${bookingId}`);
    expect(asOwner.status).toBe(200);
    expect(asOwner.body.booking.clientAddress).toBe(address);

    const asBarber = await barber.agent.get(`/api/bookings/${bookingId}`);
    expect(asBarber.status).toBe(200);
    expect(asBarber.body.booking.clientAddress).toBe(address);

    const asAdmin = await admin.agent.get(`/api/bookings/${bookingId}`);
    expect(asAdmin.status).toBe(200);
    expect(asAdmin.body.booking.clientAddress).toBe(address);
  });

  it("cache l'adresse à un autre client et dans toutes les routes publiques", async () => {
    const { barber, bookingId, address } = await setupAtClientBooking();
    await register("idor-address-client-b@example.com", "CLIENT");
    const clientB = await login("idor-address-client-b@example.com");

    const asOtherClient = await clientB.agent.get(`/api/bookings/${bookingId}`);
    expect(asOtherClient.status).toBe(404);
    expect(JSON.stringify(asOtherClient.body)).not.toContain(address);

    const profile = await request(app).get(`/api/barbers/${barber.barberId}`);
    expect(profile.status).toBe(200);
    expect(JSON.stringify(profile.body)).not.toContain(address);
    expect(JSON.stringify(profile.body)).not.toContain("clientAddress");

    const reviewsRes = await request(app).get(
      `/api/barbers/${barber.barberId}/reviews`,
    );
    expect(reviewsRes.status).toBe(200);
    expect(JSON.stringify(reviewsRes.body)).not.toContain(address);

    const search = await request(app).get("/api/barbers");
    expect(search.status).toBe(200);
    expect(JSON.stringify(search.body)).not.toContain(address);
    expect(JSON.stringify(search.body)).not.toContain("clientAddress");
  });
});
