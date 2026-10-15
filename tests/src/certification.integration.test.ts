// Badge « Certifié » (issue #41) : attribution et retrait réservés à l'ADMIN,
// visibles sur le profil public et dans la recherche, jamais modifiables par le
// barber (même par appel API direct), tracés au journal d'audit.
import { randomUUID } from "node:crypto";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { createApp } from "../../server/src/app";
import { db } from "../../server/src/db/client";
import { migrateDb } from "../../server/src/db/migrate";
import { auditLogs, barberProfiles, users } from "@findbarber/shared/schema";

const app = createApp();
const PASSWORD = "password123";

beforeAll(async () => {
  await migrateDb();
});

beforeEach(async () => {
  await db.delete(auditLogs);
  await db.delete(barberProfiles);
  await db.delete(users);
});

async function createUser(
  email: string,
  role: "CLIENT" | "BARBER" | "ADMIN",
): Promise<string> {
  const [row] = await db
    .insert(users)
    .values({
      id: randomUUID(),
      email,
      passwordHash: await bcrypt.hash(PASSWORD, 4),
      role,
      status: "ACTIVE",
      emailVerifiedAt: new Date(),
    })
    .returning({ id: users.id });
  return row.id;
}

async function login(email: string) {
  const agent = request.agent(app);
  const res = await agent.post("/api/auth/login").send({ email, password: PASSWORD });
  expect(res.status).toBe(200);
  return { agent, csrf: res.body.csrfToken as string };
}

async function seedBarber(email: string): Promise<string> {
  const userId = await createUser(email, "BARBER");
  const profileId = randomUUID();
  await db.insert(barberProfiles).values({
    id: profileId,
    approvedAt: new Date(),
    userId,
    displayName: "Barbier Certifiable",
    description: "Coupes soignées",
    address: "Rue 1",
    city: "Genève",
    countryCode: "CH",
    latitude: 46.2044,
    longitude: 6.1432,
    currency: "CHF",
  });
  return profileId;
}

async function certifiedAt(profileId: string): Promise<Date | null> {
  const [row] = await db
    .select({ certifiedAt: barberProfiles.certifiedAt })
    .from(barberProfiles)
    .where(eq(barberProfiles.id, profileId));
  return row.certifiedAt;
}

async function publicState(profileId: string) {
  const profile = await request(app).get(`/api/barbers/${profileId}`);
  expect(profile.status).toBe(200);
  const search = await request(app).get("/api/barbers");
  expect(search.status).toBe(200);
  const item = search.body.barbers.find((b: { id: string }) => b.id === profileId);
  return { profile: profile.body.profile.certified, search: item.certified };
}

describe("badge « Certifié » (issue #41)", () => {
  it("lets an ADMIN grant then remove the badge, visible on the public profile and in search", async () => {
    const profileId = await seedBarber("barber@example.com");
    await createUser("admin@example.com", "ADMIN");
    const admin = await login("admin@example.com");

    expect(await publicState(profileId)).toEqual({ profile: false, search: false });

    const granted = await admin.agent
      .post(`/api/admin/barbers/${profileId}/certify`)
      .set("X-CSRF-Token", admin.csrf);
    expect(granted.status).toBe(200);
    expect(granted.body.user.barberProfileId).toBe(profileId);
    expect(granted.body.user.certifiedAt).toEqual(expect.any(String));
    expect(await publicState(profileId)).toEqual({ profile: true, search: true });

    const list = await admin.agent.get("/api/admin/users?role=BARBER");
    expect(list.body.users[0].certifiedAt).toEqual(granted.body.user.certifiedAt);

    const removed = await admin.agent
      .post(`/api/admin/barbers/${profileId}/uncertify`)
      .set("X-CSRF-Token", admin.csrf);
    expect(removed.status).toBe(200);
    expect(removed.body.user.certifiedAt).toBeNull();
    expect(await publicState(profileId)).toEqual({ profile: false, search: false });

    const logs = await db.select().from(auditLogs);
    expect(logs.map((log) => log.action).sort()).toEqual([
      "BARBER_CERTIFIED",
      "BARBER_UNCERTIFIED",
    ]);
    expect(logs.every((log) => log.targetType === "BARBER_PROFILE")).toBe(true);
    expect(logs.every((log) => log.targetId === profileId)).toBe(true);
  });

  it("is idempotent: granting twice keeps the original date and audits once", async () => {
    const profileId = await seedBarber("idem@example.com");
    await createUser("admin@example.com", "ADMIN");
    const admin = await login("admin@example.com");

    const first = await admin.agent
      .post(`/api/admin/barbers/${profileId}/certify`)
      .set("X-CSRF-Token", admin.csrf);
    const second = await admin.agent
      .post(`/api/admin/barbers/${profileId}/certify`)
      .set("X-CSRF-Token", admin.csrf);
    expect(second.status).toBe(200);
    expect(second.body.user.certifiedAt).toBe(first.body.user.certifiedAt);
    expect(await db.select().from(auditLogs)).toHaveLength(1);
  });

  it("returns 404 for an unknown profile", async () => {
    await createUser("admin@example.com", "ADMIN");
    const admin = await login("admin@example.com");
    const res = await admin.agent
      .post(`/api/admin/barbers/${randomUUID()}/certify`)
      .set("X-CSRF-Token", admin.csrf);
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("BARBER_PROFILE_NOT_FOUND");
  });

  it("refuses a BARBER certifying themself via the admin route", async () => {
    const profileId = await seedBarber("self@example.com");
    const barber = await login("self@example.com");
    const res = await barber.agent
      .post(`/api/admin/barbers/${profileId}/certify`)
      .set("X-CSRF-Token", barber.csrf);
    expect(res.status).toBe(403);
    expect(await certifiedAt(profileId)).toBeNull();
  });

  it("ignores the badge on PUT /api/barber/profile (field refused)", async () => {
    const profileId = await seedBarber("put@example.com");
    const barber = await login("put@example.com");
    for (const field of ["certified", "certifiedAt"]) {
      const res = await barber.agent
        .put("/api/barber/profile")
        .set("X-CSRF-Token", barber.csrf)
        .send({
          displayName: "Barbier",
          description: "Desc",
          address: "Rue 1",
          city: "Genève",
          countryCode: "CH",
          latitude: 46.2,
          longitude: 6.14,
          places: ["SALON"],
          [field]: field === "certified" ? true : new Date().toISOString(),
        });
      expect(res.status).toBe(400);
    }
    expect(await certifiedAt(profileId)).toBeNull();
  });

  it("refuses a CLIENT and an anonymous visitor", async () => {
    const profileId = await seedBarber("target@example.com");
    await createUser("client@example.com", "CLIENT");
    const client = await login("client@example.com");

    const asClient = await client.agent
      .post(`/api/admin/barbers/${profileId}/certify`)
      .set("X-CSRF-Token", client.csrf);
    expect(asClient.status).toBe(403);

    const anonymous = await request(app).post(`/api/admin/barbers/${profileId}/certify`);
    expect(anonymous.status).toBe(401);
    expect(await certifiedAt(profileId)).toBeNull();
  });
});
