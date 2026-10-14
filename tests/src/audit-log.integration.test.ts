// Journal d'audit (issue #13) : chaque action sensible laisse une trace dans
// la même transaction, une action refusée n'en laisse aucune, et seul l'ADMIN
// peut lire le journal.
import { randomUUID } from "node:crypto";
import request from "supertest";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../server/src/app";
import { db } from "../../server/src/db/client";
import { migrateDb } from "../../server/src/db/migrate";
import { sweepExpiredPendingBookings } from "../../server/src/modules/booking/expiry";
import { auditLogs, reviews } from "@findbarber/shared/schema";
import {
  createUser,
  hoursFromNow,
  insertBooking,
  login,
  resetBookingTables,
  seedBarber,
} from "./booking-api-helpers";

const app = createApp();

beforeAll(async () => {
  await migrateDb();
});

beforeEach(async () => {
  await db.delete(auditLogs);
  await resetBookingTables();
});

async function entries() {
  return db.select().from(auditLogs);
}

async function setup() {
  const barber = await seedBarber("audit-barber@example.com");
  const clientId = await createUser("audit-client@example.com", "CLIENT");
  const adminId = await createUser("audit-admin@example.com", "ADMIN");
  return { barber, clientId, adminId };
}

describe("journal d'audit des réservations", () => {
  it("trace l'annulation par le client avec l'acteur et la transition", async () => {
    const { barber, clientId } = await setup();
    const id = await insertBooking({
      barber,
      clientUserId: clientId,
      startAt: hoursFromNow(48),
    });
    const client = await login(app, "audit-client@example.com");

    const res = await client.agent
      .post(`/api/bookings/${id}/cancel`)
      .set("X-CSRF-Token", client.csrf);
    expect(res.status).toBe(200);

    const rows = await entries();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      action: "BOOKING_CANCELLED",
      actorUserId: clientId,
      actorRole: "CLIENT",
      targetType: "BOOKING",
      targetId: id,
      metadata: { from: "PENDING", to: "CANCELLED" },
    });
  });

  it("trace le refus par le barber", async () => {
    const { barber, clientId } = await setup();
    const id = await insertBooking({
      barber,
      clientUserId: clientId,
      startAt: hoursFromNow(48),
    });
    const pro = await login(app, "audit-barber@example.com");

    const res = await pro.agent
      .post(`/api/bookings/${id}/decline`)
      .set("X-CSRF-Token", pro.csrf)
      .send({});
    expect(res.status).toBe(200);

    const [row] = await entries();
    expect(row).toMatchObject({
      action: "BOOKING_DECLINED",
      actorUserId: barber.userId,
      actorRole: "BARBER",
      targetId: id,
    });
  });

  it("n'écrit rien quand la transition est refusée", async () => {
    const { barber, clientId } = await setup();
    const id = await insertBooking({
      barber,
      clientUserId: clientId,
      startAt: hoursFromNow(48),
      status: "CANCELLED",
    });
    const pro = await login(app, "audit-barber@example.com");

    const res = await pro.agent
      .post(`/api/bookings/${id}/confirm`)
      .set("X-CSRF-Token", pro.csrf);
    expect(res.status).toBe(409);
    expect(await entries()).toHaveLength(0);
  });

  it("trace l'expiration comme une action système, sans acteur", async () => {
    const { barber, clientId } = await setup();
    const id = await insertBooking({
      barber,
      clientUserId: clientId,
      startAt: hoursFromNow(72),
      createdAt: hoursFromNow(-25),
    });

    expect(await sweepExpiredPendingBookings()).toBe(1);

    const [row] = await entries();
    expect(row).toMatchObject({
      action: "BOOKING_EXPIRED",
      actorUserId: null,
      actorRole: null,
      targetId: id,
    });
  });
});

describe("journal d'audit de l'administration", () => {
  it("trace la suspension d'un barber et chaque annulation induite", async () => {
    const { barber, clientId } = await setup();
    const bookingId = await insertBooking({
      barber,
      clientUserId: clientId,
      startAt: hoursFromNow(48),
      status: "CONFIRMED",
    });
    const admin = await login(app, "audit-admin@example.com");

    const res = await admin.agent
      .post(`/api/admin/users/${barber.userId}/suspend`)
      .set("X-CSRF-Token", admin.csrf);
    expect(res.status).toBe(200);

    const rows = await entries();
    expect(rows.map((r) => r.action).sort()).toEqual([
      "BOOKING_CANCELLED",
      "USER_SUSPENDED",
    ]);
    expect(rows.find((r) => r.action === "USER_SUSPENDED")).toMatchObject({
      actorRole: "ADMIN",
      targetType: "USER",
      targetId: barber.userId,
      metadata: { role: "BARBER", cancelledBookings: 1 },
    });
    expect(rows.find((r) => r.action === "BOOKING_CANCELLED")).toMatchObject({
      targetId: bookingId,
      metadata: { reason: "BARBER_SUSPENDED" },
    });
  });

  it("trace la réactivation et le masquage d'un avis", async () => {
    const { barber, clientId } = await setup();
    const bookingId = await insertBooking({
      barber,
      clientUserId: clientId,
      startAt: hoursFromNow(-48),
      status: "COMPLETED",
    });
    const reviewId = randomUUID();
    await db.insert(reviews).values({ id: reviewId, bookingId, rating: 2 });
    const admin = await login(app, "audit-admin@example.com");

    await admin.agent
      .post(`/api/admin/users/${clientId}/suspend`)
      .set("X-CSRF-Token", admin.csrf)
      .expect(200);
    await admin.agent
      .post(`/api/admin/users/${clientId}/reactivate`)
      .set("X-CSRF-Token", admin.csrf)
      .expect(200);
    await admin.agent
      .post(`/api/admin/reviews/${reviewId}/hide`)
      .set("X-CSRF-Token", admin.csrf)
      .expect(200);

    const actions = (await entries()).map((r) => r.action).sort();
    expect(actions).toEqual([
      "REVIEW_HIDDEN",
      "USER_REACTIVATED",
      "USER_SUSPENDED",
    ]);
    const [hidden] = (await entries()).filter(
      (r) => r.action === "REVIEW_HIDDEN",
    );
    expect(hidden).toMatchObject({
      targetType: "REVIEW",
      targetId: reviewId,
      metadata: { bookingId, rating: 2 },
    });
  });

  it("ne stocke aucune donnée personnelle dans les métadonnées", async () => {
    const { barber, clientId } = await setup();
    await insertBooking({
      barber,
      clientUserId: clientId,
      startAt: hoursFromNow(48),
    });
    const admin = await login(app, "audit-admin@example.com");
    await admin.agent
      .post(`/api/admin/users/${barber.userId}/suspend`)
      .set("X-CSRF-Token", admin.csrf)
      .expect(200);

    const serialized = JSON.stringify(await entries());
    expect(serialized).not.toContain("@example.com");
    expect(serialized).not.toContain("Rue du Test");
  });
});

describe("GET /api/admin/audit-logs", () => {
  it("renvoie le journal paginé à l'ADMIN, avec l'email de l'acteur", async () => {
    const { barber, clientId } = await setup();
    const id = await insertBooking({
      barber,
      clientUserId: clientId,
      startAt: hoursFromNow(48),
    });
    const client = await login(app, "audit-client@example.com");
    await client.agent
      .post(`/api/bookings/${id}/cancel`)
      .set("X-CSRF-Token", client.csrf)
      .expect(200);
    const admin = await login(app, "audit-admin@example.com");

    const res = await admin.agent.get("/api/admin/audit-logs");
    expect(res.status).toBe(200);
    expect(res.body.pagination).toMatchObject({ page: 1, total: 1 });
    expect(res.body.entries[0]).toMatchObject({
      action: "BOOKING_CANCELLED",
      actorEmail: "audit-client@example.com",
      actorRole: "CLIENT",
      targetId: id,
    });

    await admin.agent
      .post(`/api/admin/users/${clientId}/suspend`)
      .set("X-CSRF-Token", admin.csrf)
      .expect(200);
    const suspended = await admin.agent.get(
      "/api/admin/audit-logs?action=USER_SUSPENDED",
    );
    expect(suspended.body.entries[0]).toMatchObject({
      targetType: "USER",
      targetEmail: "audit-client@example.com",
    });

    const filtered = await admin.agent.get(
      "/api/admin/audit-logs?action=REVIEW_HIDDEN",
    );
    expect(filtered.status).toBe(200);
    expect(filtered.body.entries).toHaveLength(0);

    const invalid = await admin.agent.get("/api/admin/audit-logs?action=NOPE");
    expect(invalid.status).toBe(400);
  });

  it("refuse les non-ADMIN (403) et les anonymes (401)", async () => {
    await setup();
    const client = await login(app, "audit-client@example.com");
    expect((await client.agent.get("/api/admin/audit-logs")).status).toBe(403);
    const pro = await login(app, "audit-barber@example.com");
    expect((await pro.agent.get("/api/admin/audit-logs")).status).toBe(403);
    expect((await request(app).get("/api/admin/audit-logs")).status).toBe(401);
  });
});
