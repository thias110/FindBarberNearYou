// Itinéraire après confirmation (lot N3, choix du propriétaire) : l'adresse
// exacte du barber n'est communiquée qu'au CLIENT propriétaire d'une
// réservation CONFIRMED, au salon ou chez le professionnel, et uniquement par
// le détail de la réservation. Jamais dans les listes ni sur la fiche publique.
import request from "supertest";
import { eq } from "drizzle-orm";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../server/src/app";
import { db } from "../../server/src/db/client";
import { migrateDb } from "../../server/src/db/migrate";
import { bookings } from "@findbarber/shared/schema";
import {
  createUser,
  hoursFromNow,
  insertBooking,
  login,
  resetBookingTables,
  seedBarber,
} from "./booking-api-helpers";

const app = createApp();
const SALON_ADDRESS = "Rue du Test 1";

beforeAll(async () => {
  await migrateDb();
});

beforeEach(async () => {
  await resetBookingTables();
});

async function setup(status: "PENDING" | "CONFIRMED" | "COMPLETED" | "CANCELLED") {
  const barber = await seedBarber("dir-barber@example.com");
  const clientId = await createUser("dir-client@example.com", "CLIENT");
  const bookingId = await insertBooking({
    barber,
    clientUserId: clientId,
    startAt: hoursFromNow(48),
    status,
  });
  const client = await login(app, "dir-client@example.com");
  return { barber, bookingId, client };
}

describe("adresse du barber dans le détail de réservation", () => {
  it("est donnée au client d'une réservation confirmée au salon", async () => {
    const { bookingId, client } = await setup("CONFIRMED");
    const res = await client.agent.get(`/api/bookings/${bookingId}`);
    expect(res.status).toBe(200);
    expect(res.body.booking.barberAddress).toBe(SALON_ADDRESS);
  });

  it("est aussi donnée pour un rendez-vous chez le professionnel", async () => {
    const { bookingId, client } = await setup("CONFIRMED");
    await db
      .update(bookings)
      .set({ servicePlace: "AT_PROVIDER" })
      .where(eq(bookings.id, bookingId));
    const res = await client.agent.get(`/api/bookings/${bookingId}`);
    expect(res.body.booking.barberAddress).toBe(SALON_ADDRESS);
  });

  it.each(["PENDING", "COMPLETED", "CANCELLED"] as const)(
    "reste privée tant que la réservation n'est pas confirmée (%s)",
    async (status) => {
      const { bookingId, client } = await setup(status);
      const res = await client.agent.get(`/api/bookings/${bookingId}`);
      expect(res.status).toBe(200);
      expect(res.body.booking.barberAddress).toBeNull();
    },
  );

  it("reste privée pour un rendez-vous à domicile (le barber se déplace)", async () => {
    const { bookingId, client } = await setup("CONFIRMED");
    await db
      .update(bookings)
      .set({ servicePlace: "AT_CLIENT" })
      .where(eq(bookings.id, bookingId));
    const res = await client.agent.get(`/api/bookings/${bookingId}`);
    expect(res.body.booking.barberAddress).toBeNull();
  });

  it("n'est donnée ni au barber ni à l'admin, ni à un autre client", async () => {
    const { bookingId } = await setup("CONFIRMED");
    await createUser("dir-admin@example.com", "ADMIN");
    await createUser("dir-other@example.com", "CLIENT");
    const barber = await login(app, "dir-barber@example.com");
    const admin = await login(app, "dir-admin@example.com");
    const other = await login(app, "dir-other@example.com");

    const asBarber = await barber.agent.get(`/api/bookings/${bookingId}`);
    expect(asBarber.status).toBe(200);
    expect(asBarber.body.booking.barberAddress).toBeNull();
    const asAdmin = await admin.agent.get(`/api/bookings/${bookingId}`);
    expect(asAdmin.body.booking.barberAddress).toBeNull();
    const asOther = await other.agent.get(`/api/bookings/${bookingId}`);
    expect(asOther.status).toBe(404);
    expect(JSON.stringify(asOther.body)).not.toContain(SALON_ADDRESS);
  });

  it("n'apparaît ni dans la liste des réservations ni sur la fiche publique", async () => {
    const { barber, client } = await setup("CONFIRMED");
    const list = await client.agent.get("/api/bookings");
    expect(list.status).toBe(200);
    expect(JSON.stringify(list.body)).not.toContain(SALON_ADDRESS);
    const publicProfile = await request(app).get(`/api/barbers/${barber.profileId}`);
    expect(JSON.stringify(publicProfile.body)).not.toContain(SALON_ADDRESS);
  });
});
