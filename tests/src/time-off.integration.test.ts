import { randomUUID } from "node:crypto";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { eq } from "drizzle-orm";
import { createApp } from "../../server/src/app";
import { db } from "../../server/src/db/client";
import { migrateDb } from "../../server/src/db/migrate";
import {
  barberProfiles,
  barberServices,
  barberTimeOff,
  barberWorkingHours,
  users,
} from "@findbarber/shared/schema";

const app = createApp();
const PASSWORD = "password123";

beforeAll(async () => {
  await migrateDb();
});

beforeEach(async () => {
  // Nettoyage dans l'ordre des clés étrangères
  // (indisponibilités → horaires → services → profils → users).
  await db.delete(barberTimeOff);
  await db.delete(barberWorkingHours);
  await db.delete(barberServices);
  await db.delete(barberProfiles);
  await db.delete(users);
});

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
    ...overrides,
  };
}

async function registerBarber(email: string) {
  const res = await request(app)
    .post("/api/auth/register")
    .send({ email, password: PASSWORD, role: "BARBER" });
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

async function createProfile(
  agent: request.SuperAgentTest,
  csrf: string,
  overrides: Record<string, unknown> = {},
) {
  return agent
    .put("/api/barber/profile")
    .set("X-CSRF-Token", csrf)
    .send(profilePayload(overrides));
}

async function setupBarber(
  email: string,
  overrides: Record<string, unknown> = {},
) {
  await registerBarber(email);
  const { agent, csrf } = await login(email);
  const profile = await createProfile(agent, csrf, overrides);
  expect(profile.status).toBe(200);
  return { agent, csrf };
}

// Petit utilitaire de test : décalage de jours sans dépendre du fuseau local.
function addDays(iso: string, days: number): string {
  const [year, month, day] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

describe("time off persistence", () => {
  it("creates a single day and a period, then lists them sorted", async () => {
    const { agent, csrf } = await setupBarber("persist-timeoff@example.com");

    const single = await agent
      .post("/api/barber/time-off")
      .set("X-CSRF-Token", csrf)
      .send({ startDate: "2026-08-01", endDate: "2026-08-05", reason: "Vacances" });
    expect(single.status).toBe(201);
    expect(single.body.timeOff).toMatchObject({
      startDate: "2026-08-01",
      endDate: "2026-08-05",
      reason: "Vacances",
    });

    await agent
      .post("/api/barber/time-off")
      .set("X-CSRF-Token", csrf)
      .send({ startDate: "2026-06-01", endDate: "2026-06-01" });
    await agent
      .post("/api/barber/time-off")
      .set("X-CSRF-Token", csrf)
      .send({ startDate: "2026-06-03", endDate: "2026-06-04", reason: "  " });

    const got = await agent.get("/api/barber/time-off");
    expect(got.status).toBe(200);
    expect(
      got.body.timeOff.map((item: { startDate: string }) => item.startDate),
    ).toEqual(["2026-06-01", "2026-06-03", "2026-08-01"]);
    expect(got.body.timeOff[1].reason).toBeNull();
  });

  it("persists the exact calendar strings (no timezone shift)", async () => {
    const { agent, csrf } = await setupBarber("exact-timeoff@example.com");
    await agent
      .post("/api/barber/time-off")
      .set("X-CSRF-Token", csrf)
      .send({ startDate: "2026-01-01", endDate: "2026-01-01" });

    const rows = await db.select().from(barberTimeOff);
    expect(rows).toHaveLength(1);
    expect(rows[0].startDate).toBe("2026-01-01");
    expect(rows[0].endDate).toBe("2026-01-01");
  });

  it("deletes one period (204) and keeps the others", async () => {
    const { agent, csrf } = await setupBarber("delete-timeoff@example.com");
    const first = await agent
      .post("/api/barber/time-off")
      .set("X-CSRF-Token", csrf)
      .send({ startDate: "2026-06-01", endDate: "2026-06-01" });
    await agent
      .post("/api/barber/time-off")
      .set("X-CSRF-Token", csrf)
      .send({ startDate: "2026-07-01", endDate: "2026-07-02" });

    const deleted = await agent
      .delete(`/api/barber/time-off/${first.body.timeOff.id}`)
      .set("X-CSRF-Token", csrf);
    expect(deleted.status).toBe(204);
    expect(deleted.text).toBe("");

    const got = await agent.get("/api/barber/time-off");
    expect(got.body.timeOff).toHaveLength(1);
    expect(got.body.timeOff[0].startDate).toBe("2026-07-01");
    expect(await db.select().from(barberTimeOff)).toHaveLength(1);
  });

  it("cascades the deletion of the profile", async () => {
    const user = await registerBarber("cascade-timeoff@example.com");
    const { agent, csrf } = await login("cascade-timeoff@example.com");
    await createProfile(agent, csrf);
    await agent
      .post("/api/barber/time-off")
      .set("X-CSRF-Token", csrf)
      .send({ startDate: "2026-06-01", endDate: "2026-06-02" });
    expect(await db.select().from(barberTimeOff)).toHaveLength(1);

    await db.delete(barberProfiles).where(eq(barberProfiles.userId, user.id));
    expect(await db.select().from(barberTimeOff)).toHaveLength(0);
  });
});

describe("time off overlaps", () => {
  it("rejects duplicate, nested and touching periods with 409", async () => {
    const { agent, csrf } = await setupBarber("overlap-timeoff@example.com");
    const created = await agent
      .post("/api/barber/time-off")
      .set("X-CSRF-Token", csrf)
      .send({ startDate: "2026-06-01", endDate: "2026-06-10" });
    expect(created.status).toBe(201);

    for (const input of [
      { startDate: "2026-06-01", endDate: "2026-06-10" }, // doublon exact
      { startDate: "2026-06-05", endDate: "2026-06-15" }, // chevauchement
      { startDate: "2026-05-20", endDate: "2026-06-01" }, // partage la borne
      { startDate: "2026-06-03", endDate: "2026-06-04" }, // imbriqué
    ]) {
      const res = await agent
        .post("/api/barber/time-off")
        .set("X-CSRF-Token", csrf)
        .send(input);
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe("TIME_OFF_OVERLAP");
    }

    expect(await db.select().from(barberTimeOff)).toHaveLength(1);
  });

  it("accepts adjacent periods without a common day", async () => {
    const { agent, csrf } = await setupBarber("adjacent-timeoff@example.com");
    const first = await agent
      .post("/api/barber/time-off")
      .set("X-CSRF-Token", csrf)
      .send({ startDate: "2026-06-01", endDate: "2026-06-02" });
    expect(first.status).toBe(201);
    const second = await agent
      .post("/api/barber/time-off")
      .set("X-CSRF-Token", csrf)
      .send({ startDate: "2026-06-03", endDate: "2026-06-04" });
    expect(second.status).toBe(201);
    const withGap = await agent
      .post("/api/barber/time-off")
      .set("X-CSRF-Token", csrf)
      .send({ startDate: "2026-06-10", endDate: "2026-06-11" });
    expect(withGap.status).toBe(201);
    expect(await db.select().from(barberTimeOff)).toHaveLength(3);
  });
});

describe("time off cap", () => {
  it("rejects a 201st period with 409 TIME_OFF_LIMIT_REACHED", async () => {
    const { agent, csrf } = await setupBarber("cap-timeoff@example.com");
    const profileRes = await agent.get("/api/barber/profile");
    const profileId = profileRes.body.profile.id as string;

    // 200 journées consécutives non chevauchantes (amorçage direct en base,
    // seule la 201e passe par l'API pour exercer le plafond du service).
    const rows = Array.from({ length: 200 }, (_, index) => {
      const day = addDays("2026-01-01", index);
      return {
        id: randomUUID(),
        barberProfileId: profileId,
        startDate: day,
        endDate: day,
        reason: null,
      };
    });
    await db.insert(barberTimeOff).values(rows);
    expect(await db.select().from(barberTimeOff)).toHaveLength(200);

    const overflow = await agent
      .post("/api/barber/time-off")
      .set("X-CSRF-Token", csrf)
      .send({ startDate: "2027-01-01", endDate: "2027-01-01" });
    expect(overflow.status).toBe(409);
    expect(overflow.body.error.code).toBe("TIME_OFF_LIMIT_REACHED");
    expect(await db.select().from(barberTimeOff)).toHaveLength(200);
  });
});

describe("time off validation (API)", () => {
  it("rejects invalid payloads with 400 VALIDATION_ERROR", async () => {
    const { agent, csrf } = await setupBarber("invalid-timeoff@example.com");

    const cases: unknown[] = [
      {},
      { startDate: "2026-02-30", endDate: "2026-03-01" },
      { startDate: "2026-06-10", endDate: "2026-06-09" },
      { startDate: "2026-01-01", endDate: "2026-01-01", userId: "evil" },
      { startDate: "2026-01-01", endDate: "2027-01-02" }, // 367 jours
      { startDate: "2026-01-01", endDate: "2026-01-01", reason: "a".repeat(501) },
      { startDate: "not-a-date", endDate: "2026-01-01" },
      { startDate: "0000-01-01", endDate: "0000-01-02" },
    ];

    for (const body of cases) {
      const res = await agent
        .post("/api/barber/time-off")
        .set("X-CSRF-Token", csrf)
        .send(body as object);
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    }

    expect(await db.select().from(barberTimeOff)).toHaveLength(0);
  });

  it("accepts a 366-day period at the boundary", async () => {
    const { agent, csrf } = await setupBarber("boundary-timeoff@example.com");
    const res = await agent
      .post("/api/barber/time-off")
      .set("X-CSRF-Token", csrf)
      .send({ startDate: "2026-01-01", endDate: "2027-01-01" });
    expect(res.status).toBe(201);
  });

  it("rejects year 0000 with 400 and inserts nothing (no 500)", async () => {
    const { agent, csrf } = await setupBarber("year-zero-timeoff@example.com");

    const res = await agent
      .post("/api/barber/time-off")
      .set("X-CSRF-Token", csrf)
      .send({ startDate: "0000-01-01", endDate: "0000-01-02" });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(await db.select().from(barberTimeOff)).toHaveLength(0);
  });

  it("accepts an early year (0099) end to end", async () => {
    const { agent, csrf } = await setupBarber("early-year-timeoff@example.com");

    const res = await agent
      .post("/api/barber/time-off")
      .set("X-CSRF-Token", csrf)
      .send({ startDate: "0099-01-01", endDate: "0099-01-31" });

    expect(res.status).toBe(201);
    expect(res.body.timeOff.startDate).toBe("0099-01-01");
    expect(res.body.timeOff.endDate).toBe("0099-01-31");
  });
});

describe("time off access control", () => {
  it("returns 401 without authentication and 403 for a CLIENT", async () => {
    expect((await request(app).get("/api/barber/time-off")).status).toBe(401);
    expect((await request(app).post("/api/barber/time-off")).status).toBe(401);
    expect(
      (await request(app).delete("/api/barber/time-off/abc")).status,
    ).toBe(401);

    await request(app)
      .post("/api/auth/register")
      .send({ email: "client-timeoff@example.com", password: PASSWORD, role: "CLIENT" });
    const { agent } = await login("client-timeoff@example.com");

    expect((await agent.get("/api/barber/time-off")).status).toBe(403);
    expect(
      (await agent.post("/api/barber/time-off").send({})).status,
    ).toBe(403);
    expect((await agent.delete("/api/barber/time-off/abc")).status).toBe(403);
  });

  it("requires CSRF on POST and DELETE", async () => {
    const { agent, csrf } = await setupBarber("csrf-timeoff@example.com");

    const noCsrf = await agent
      .post("/api/barber/time-off")
      .send({ startDate: "2026-06-01", endDate: "2026-06-01" });
    expect(noCsrf.status).toBe(403);
    expect(noCsrf.body.error.code).toBe("CSRF_INVALID");

    const created = await agent
      .post("/api/barber/time-off")
      .set("X-CSRF-Token", csrf)
      .send({ startDate: "2026-06-01", endDate: "2026-06-01" });
    expect(created.status).toBe(201);

    const wrongCsrf = await agent
      .delete(`/api/barber/time-off/${created.body.timeOff.id}`)
      .set("X-CSRF-Token", "wrong");
    expect(wrongCsrf.status).toBe(403);
    expect(wrongCsrf.body.error.code).toBe("CSRF_INVALID");
  });

  it("returns 404 when the profile does not exist", async () => {
    await registerBarber("noprofile-timeoff@example.com");
    const { agent, csrf } = await login("noprofile-timeoff@example.com");

    const got = await agent.get("/api/barber/time-off");
    expect(got.status).toBe(404);
    expect(got.body.error.code).toBe("BARBER_PROFILE_NOT_FOUND");

    const post = await agent
      .post("/api/barber/time-off")
      .set("X-CSRF-Token", csrf)
      .send({ startDate: "2026-06-01", endDate: "2026-06-01" });
    expect(post.status).toBe(404);
    expect(post.body.error.code).toBe("BARBER_PROFILE_NOT_FOUND");

    const del = await agent
      .delete("/api/barber/time-off/abc")
      .set("X-CSRF-Token", csrf);
    expect(del.status).toBe(404);
    expect(del.body.error.code).toBe("BARBER_PROFILE_NOT_FOUND");
  });

  it("isolates periods between two barbers and returns 404 for a foreign id", async () => {
    const a = await setupBarber("barber-a-timeoff@example.com");
    const b = await setupBarber("barber-b-timeoff@example.com");

    const created = await a.agent
      .post("/api/barber/time-off")
      .set("X-CSRF-Token", a.csrf)
      .send({ startDate: "2026-06-01", endDate: "2026-06-02" });
    expect(created.status).toBe(201);

    const listB = await b.agent.get("/api/barber/time-off");
    expect(listB.body.timeOff).toEqual([]);

    const foreignDelete = await b.agent
      .delete(`/api/barber/time-off/${created.body.timeOff.id}`)
      .set("X-CSRF-Token", b.csrf);
    expect(foreignDelete.status).toBe(404);
    expect(foreignDelete.body.error.code).toBe("TIME_OFF_NOT_FOUND");

    // L'indisponibilité de A est intacte.
    const listA = await a.agent.get("/api/barber/time-off");
    expect(listA.body.timeOff).toHaveLength(1);
  });

  it("keeps the reason private (absent from public responses)", async () => {
    const { agent, csrf } = await setupBarber("private-timeoff@example.com");
    await agent
      .post("/api/barber/time-off")
      .set("X-CSRF-Token", csrf)
      .send({
        startDate: "2026-06-01",
        endDate: "2026-06-02",
        reason: "Motif strictement privé",
      });

    const profileRes = await agent.get("/api/barber/profile");
    const barberId = profileRes.body.profile.id as string;

    const publicRes = await request(app).get(`/api/barbers/${barberId}`);
    expect(publicRes.status).toBe(200);
    expect(publicRes.body).not.toHaveProperty("timeOff");
    expect(publicRes.body.profile).not.toHaveProperty("timeOff");
    expect(JSON.stringify(publicRes.body)).not.toContain("Motif strictement privé");
  });
});

describe("time off timezone behaviour", () => {
  it("keeps civil dates unchanged when the timezone is set or changed", async () => {
    const { agent, csrf } = await setupBarber("tz-timeoff@example.com"); // sans fuseau

    const created = await agent
      .post("/api/barber/time-off")
      .set("X-CSRF-Token", csrf)
      .send({ startDate: "2026-12-24", endDate: "2026-12-26" });
    expect(created.status).toBe(201);

    const before = await agent.get("/api/barber/time-off");
    expect(before.body.timeOff[0]).toMatchObject({
      startDate: "2026-12-24",
      endDate: "2026-12-26",
    });

    const setTz = await createProfile(agent, csrf, { timezone: "Europe/Zurich" });
    expect(setTz.status).toBe(200);
    const afterSet = await agent.get("/api/barber/time-off");
    expect(afterSet.body.timeOff).toEqual(before.body.timeOff);

    const changeTz = await createProfile(agent, csrf, {
      timezone: "America/New_York",
    });
    expect(changeTz.status).toBe(200);
    const afterChange = await agent.get("/api/barber/time-off");
    expect(afterChange.body.timeOff).toEqual(before.body.timeOff);
  });
});

describe("time off DB constraints", () => {
  async function insertProfileDirectly(email: string) {
    const user = await registerBarber(email);
    const [profile] = await db
      .insert(barberProfiles)
      .values({
        id: randomUUID(),
        userId: user.id,
        displayName: "Barbier",
        description: "Description",
        address: "Rue 1",
        city: "Genève",
        postalCode: null,
        countryCode: "CH",
        latitude: 46.2,
        longitude: 6.14,
        currency: "CHF",
      })
      .returning();
    return profile;
  }

  function row(profileId: string, overrides: Record<string, unknown> = {}) {
    return {
      id: randomUUID(),
      barberProfileId: profileId,
      startDate: "2026-06-01",
      endDate: "2026-06-01",
      reason: null,
      ...overrides,
    };
  }

  it("rejects invalid rows and accepts the 366-day boundary", async () => {
    const profile = await insertProfileDirectly("db-timeoff@example.com");

    await expect(
      db
        .insert(barberTimeOff)
        .values(row(profile.id, { startDate: "2026-06-10", endDate: "2026-06-01" })),
    ).rejects.toThrow();
    await expect(
      db
        .insert(barberTimeOff)
        .values(row(profile.id, { startDate: "2026-01-01", endDate: "2027-01-02" })),
    ).rejects.toThrow();
    await expect(
      db
        .insert(barberTimeOff)
        .values(row(profile.id, { reason: "a".repeat(501) })),
    ).rejects.toThrow();

    await expect(
      db.insert(barberTimeOff).values(row(profile.id)),
    ).resolves.toBeDefined();
    await expect(
      db
        .insert(barberTimeOff)
        .values(
          row(profile.id, { startDate: "2027-01-01", endDate: "2027-01-01" }),
        ),
    ).resolves.toBeDefined();
    await expect(
      db
        .insert(barberTimeOff)
        .values(
          row(profile.id, {
            startDate: "2028-01-01",
            endDate: "2028-12-31", // 366 jours inclus
          }),
        ),
    ).resolves.toBeDefined();
  });

  it("enforces the exact-duplicate unique index", async () => {
    const profile = await insertProfileDirectly("db-unique-timeoff@example.com");
    await db
      .insert(barberTimeOff)
      .values(row(profile.id, { startDate: "2026-06-01", endDate: "2026-06-05" }));
    await expect(
      db
        .insert(barberTimeOff)
        .values(
          row(profile.id, { startDate: "2026-06-01", endDate: "2026-06-05" }),
        ),
    ).rejects.toThrow();
  });
});
