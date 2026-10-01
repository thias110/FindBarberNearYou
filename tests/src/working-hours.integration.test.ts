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
  barberWorkingHours,
  users,
} from "@findbarber/shared/schema";

const app = createApp();
const PASSWORD = "password123";

type IntervalInput = {
  weekday: number;
  startMinute: number;
  endMinute: number;
};

beforeAll(async () => {
  await migrateDb();
});

beforeEach(async () => {
  // Nettoyage dans l'ordre des clés étrangères (horaires → services → profils → users).
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
    ...overrides,
  };
}

function hoursPayload(intervals: IntervalInput[]) {
  return { intervals };
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

async function setupBarber(email: string) {
  await registerBarber(email);
  const { agent, csrf } = await login(email);
  const profile = await createProfile(agent, csrf);
  expect(profile.status).toBe(200);
  return { agent, csrf };
}

async function saveWorkingHours(
  agent: request.SuperAgentTest,
  csrf: string,
  intervals: IntervalInput[],
) {
  return agent
    .put("/api/barber/working-hours")
    .set("X-CSRF-Token", csrf)
    .send(hoursPayload(intervals));
}

function tuples(intervals: IntervalInput[]) {
  return intervals.map((interval) => [
    interval.weekday,
    interval.startMinute,
    interval.endMinute,
  ]);
}

describe("working hours persistence", () => {
  it("saves and returns the planning, sorted by weekday then start", async () => {
    const { agent, csrf } = await setupBarber("persist@example.com");

    const saved = await saveWorkingHours(agent, csrf, [
      { weekday: 3, startMinute: 540, endMinute: 720 },
      { weekday: 1, startMinute: 840, endMinute: 1080 },
      { weekday: 1, startMinute: 540, endMinute: 720 },
    ]);
    expect(saved.status).toBe(200);

    const ordered = saved.body.intervals.map(
      (interval: { weekday: number; startMinute: number; endMinute: number }) => [
        interval.weekday,
        interval.startMinute,
        interval.endMinute,
      ],
    );
    expect(ordered).toEqual([
      [1, 540, 720],
      [1, 840, 1080],
      [3, 540, 720],
    ]);

    const got = await agent.get("/api/barber/working-hours");
    expect(got.status).toBe(200);
    expect(got.body.intervals).toHaveLength(3);
    expect(
      got.body.intervals.map(
        (interval: { weekday: number; startMinute: number; endMinute: number }) => [
          interval.weekday,
          interval.startMinute,
          interval.endMinute,
        ],
      ),
    ).toEqual(ordered);
  });

  it("replaces the whole planning on the next PUT", async () => {
    const { agent, csrf } = await setupBarber("replace@example.com");

    await saveWorkingHours(agent, csrf, [
      { weekday: 1, startMinute: 540, endMinute: 720 },
      { weekday: 2, startMinute: 540, endMinute: 720 },
    ]);

    const replaced = await saveWorkingHours(agent, csrf, [
      { weekday: 5, startMinute: 840, endMinute: 1080 },
    ]);
    expect(replaced.status).toBe(200);

    const got = await agent.get("/api/barber/working-hours");
    expect(
      got.body.intervals.map(
        (interval: { weekday: number; startMinute: number; endMinute: number }) => [
          interval.weekday,
          interval.startMinute,
          interval.endMinute,
        ],
      ),
    ).toEqual([[5, 840, 1080]]);

    const rows = await db.select().from(barberWorkingHours);
    expect(rows).toHaveLength(1);
    expect(rows[0].weekday).toBe(5);
  });

  it("clears the planning with an empty intervals array", async () => {
    const { agent, csrf } = await setupBarber("clear@example.com");

    await saveWorkingHours(agent, csrf, [
      { weekday: 1, startMinute: 540, endMinute: 720 },
    ]);
    const cleared = await saveWorkingHours(agent, csrf, []);
    expect(cleared.status).toBe(200);
    expect(cleared.body.intervals).toEqual([]);

    const got = await agent.get("/api/barber/working-hours");
    expect(got.body.intervals).toEqual([]);
    expect(await db.select().from(barberWorkingHours)).toHaveLength(0);
  });

  it("persists a 24:00 end and restores it on reload", async () => {
    const { agent, csrf } = await setupBarber("midnight@example.com");

    const saved = await saveWorkingHours(agent, csrf, [
      { weekday: 6, startMinute: 1200, endMinute: 1440 },
    ]);
    expect(saved.status).toBe(200);
    expect(saved.body.intervals[0].endMinute).toBe(1440);

    const got = await agent.get("/api/barber/working-hours");
    expect(got.body.intervals).toHaveLength(1);
    expect(got.body.intervals[0].startMinute).toBe(1200);
    expect(got.body.intervals[0].endMinute).toBe(1440);

    const rows = await db.select().from(barberWorkingHours);
    expect(rows[0].endMinute).toBe(1440);
  });

  it("cascades the deletion of the profile", async () => {
    const user = await registerBarber("cascade@example.com");
    const { agent, csrf } = await login("cascade@example.com");
    await createProfile(agent, csrf);
    await saveWorkingHours(agent, csrf, [
      { weekday: 1, startMinute: 540, endMinute: 720 },
    ]);
    expect(await db.select().from(barberWorkingHours)).toHaveLength(1);

    await db
      .delete(barberProfiles)
      .where(eq(barberProfiles.userId, user.id));
    expect(await db.select().from(barberWorkingHours)).toHaveLength(0);
  });
});

describe("working hours validation (API)", () => {
  it("rejects invalid payloads with 400 VALIDATION_ERROR", async () => {
    const { agent, csrf } = await setupBarber("invalid@example.com");

    const cases: unknown[] = [
      {}, // intervals manquant
      { intervals: "x" },
      { intervals: [], userId: "evil" }, // clé inconnue
      hoursPayload([
        { weekday: 0, startMinute: 540, endMinute: 720 } as unknown as IntervalInput,
      ]),
      hoursPayload([
        { weekday: 8, startMinute: 540, endMinute: 720 } as unknown as IntervalInput,
      ]),
      hoursPayload([
        { weekday: 1, startMinute: -1, endMinute: 720 } as unknown as IntervalInput,
      ]),
      hoursPayload([
        { weekday: 1, startMinute: 1440, endMinute: 1440 } as unknown as IntervalInput,
      ]),
      hoursPayload([
        { weekday: 1, startMinute: 540, endMinute: 1441 } as unknown as IntervalInput,
      ]),
      hoursPayload([
        { weekday: 1, startMinute: 720, endMinute: 540 },
      ]), // début >= fin
      hoursPayload([
        { weekday: 1, startMinute: 540, endMinute: 720 },
        { weekday: 1, startMinute: 600, endMinute: 840 },
      ]), // chevauchement
      hoursPayload([
        { weekday: 1, startMinute: 540, endMinute: 720 },
        { weekday: 1, startMinute: 540, endMinute: 720 },
      ]), // doublon
      hoursPayload([
        { weekday: 1, startMinute: 540, endMinute: 720, barberProfileId: "evil" },
      ]), // champ interdit
    ];

    for (const body of cases) {
      const res = await agent
        .put("/api/barber/working-hours")
        .set("X-CSRF-Token", csrf)
        .send(body as object);
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    }

    // Aucun planning résiduel après ces échecs.
    expect(await db.select().from(barberWorkingHours)).toHaveLength(0);
  });

  it("rejects more than the maximum intervals per day", async () => {
    const { agent, csrf } = await setupBarber("cap-day@example.com");
    const res = await saveWorkingHours(
      agent,
      csrf,
      Array.from({ length: 7 }, (_, index) => ({
        weekday: 1,
        startMinute: 60 * index,
        endMinute: 60 * index + 30,
      })),
    );
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });
});

describe("working hours DB constraints", () => {
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

  function row(
    profileId: string,
    overrides: Record<string, unknown> = {},
  ) {
    return {
      id: randomUUID(),
      barberProfileId: profileId,
      weekday: 1,
      startMinute: 540,
      endMinute: 720,
      ...overrides,
    };
  }

  it("rejects invalid rows and accepts boundaries", async () => {
    const profile = await insertProfileDirectly("db-hours@example.com");

    await expect(
      db.insert(barberWorkingHours).values(row(profile.id, { weekday: 0 })),
    ).rejects.toThrow();
    await expect(
      db.insert(barberWorkingHours).values(row(profile.id, { weekday: 8 })),
    ).rejects.toThrow();
    await expect(
      db.insert(barberWorkingHours).values(row(profile.id, { startMinute: -1 })),
    ).rejects.toThrow();
    await expect(
      db.insert(barberWorkingHours).values(row(profile.id, { startMinute: 1440 })),
    ).rejects.toThrow();
    await expect(
      db.insert(barberWorkingHours).values(row(profile.id, { endMinute: 0 })),
    ).rejects.toThrow();
    await expect(
      db.insert(barberWorkingHours).values(row(profile.id, { endMinute: 1441 })),
    ).rejects.toThrow();
    await expect(
      db.insert(
        barberWorkingHours,
      ).values(row(profile.id, { startMinute: 720, endMinute: 540 })),
    ).rejects.toThrow();
    await expect(
      db.insert(
        barberWorkingHours,
      ).values(row(profile.id, { startMinute: 720, endMinute: 720 })),
    ).rejects.toThrow();

    await expect(
      db.insert(barberWorkingHours).values(row(profile.id, { weekday: 1 })),
    ).resolves.toBeDefined();
    await expect(
      db.insert(
        barberWorkingHours,
      ).values(row(profile.id, { weekday: 7, startMinute: 0, endMinute: 1440 })),
    ).resolves.toBeDefined();
  });

  it("enforces the unique (profile, weekday, start) index", async () => {
    const profile = await insertProfileDirectly("db-unique@example.com");
    await db
      .insert(barberWorkingHours)
      .values(row(profile.id, { startMinute: 540, endMinute: 720 }));
    await expect(
      db
        .insert(barberWorkingHours)
        .values(row(profile.id, { startMinute: 540, endMinute: 840 })),
    ).rejects.toThrow();
  });
});

describe("working hours access control", () => {
  it("returns 401 without authentication and 403 for a CLIENT", async () => {
    expect((await request(app).get("/api/barber/working-hours")).status).toBe(401);
    expect((await request(app).put("/api/barber/working-hours")).status).toBe(401);

    await request(app)
      .post("/api/auth/register")
      .send({ email: "client@example.com", password: PASSWORD, role: "CLIENT" });
    const { agent } = await login("client@example.com");

    expect((await agent.get("/api/barber/working-hours")).status).toBe(403);
    expect((await agent.put("/api/barber/working-hours").send({ intervals: [] })).status).toBe(403);
  });

  it("returns 404 when the profile does not exist", async () => {
    await registerBarber("noprofile@example.com");
    const { agent, csrf } = await login("noprofile@example.com");

    const got = await agent.get("/api/barber/working-hours");
    expect(got.status).toBe(404);
    expect(got.body.error.code).toBe("BARBER_PROFILE_NOT_FOUND");

    const put = await saveWorkingHours(agent, csrf, [
      { weekday: 1, startMinute: 540, endMinute: 720 },
    ]);
    expect(put.status).toBe(404);
    expect(put.body.error.code).toBe("BARBER_PROFILE_NOT_FOUND");
  });

  it("requires CSRF on the mutation", async () => {
    const { agent, csrf } = await setupBarber("csrf-hours@example.com");

    const noCsrf = await agent
      .put("/api/barber/working-hours")
      .send(hoursPayload([{ weekday: 1, startMinute: 540, endMinute: 720 }]));
    expect(noCsrf.status).toBe(403);
    expect(noCsrf.body.error.code).toBe("CSRF_INVALID");

    const wrongCsrf = await agent
      .put("/api/barber/working-hours")
      .set("X-CSRF-Token", "wrong")
      .send(hoursPayload([{ weekday: 1, startMinute: 540, endMinute: 720 }]));
    expect(wrongCsrf.status).toBe(403);
    expect(wrongCsrf.body.error.code).toBe("CSRF_INVALID");

    const valid = await saveWorkingHours(agent, csrf, [
      { weekday: 1, startMinute: 540, endMinute: 720 },
    ]);
    expect(valid.status).toBe(200);
  });

  it("isolates plannings between two barbers", async () => {
    const a = await setupBarber("barber-a-hours@example.com");
    const b = await setupBarber("barber-b-hours@example.com");

    await saveWorkingHours(a.agent, a.csrf, [
      { weekday: 1, startMinute: 540, endMinute: 720 },
    ]);

    const listB = await b.agent.get("/api/barber/working-hours");
    expect(listB.body.intervals).toEqual([]);

    await saveWorkingHours(b.agent, b.csrf, [
      { weekday: 2, startMinute: 840, endMinute: 1080 },
    ]);

    const listA = await a.agent.get("/api/barber/working-hours");
    expect(tuples(listA.body.intervals)).toEqual([[1, 540, 720]]);
    expect(
      tuples((await b.agent.get("/api/barber/working-hours")).body.intervals),
    ).toEqual([[2, 840, 1080]]);
  });
});

// La concurrence est sérialisée par le verrou FOR UPDATE sur la ligne du
// profil, résolu DANS la transaction. Note : PGlite exécute les transactions
// via un mutex interne (une seule connexion) : ces tests prouvent l'absence
// de mélange et d'erreur 500, mais pas le comportement multi-connexions d'un
// vrai PostgreSQL, qui reste à valider sur une base Postgres réelle.
describe("concurrent replacements", () => {
  async function assertResponseMatches(
    response: request.Response,
    intervals: IntervalInput[],
  ) {
    expect(response.status).toBe(200);
    expect(tuples(response.body.intervals)).toEqual(tuples(intervals));
  }

  it("serializes two simultaneous PUTs on an empty planning", async () => {
    await registerBarber("concurrent-empty@example.com");
    const first = await login("concurrent-empty@example.com");
    const second = await login("concurrent-empty@example.com");
    await createProfile(first.agent, first.csrf);

    const payloadA = [{ weekday: 1, startMinute: 540, endMinute: 720 }];
    const payloadB = [{ weekday: 2, startMinute: 840, endMinute: 1080 }];

    const [resA, resB] = await Promise.all([
      saveWorkingHours(first.agent, first.csrf, payloadA),
      saveWorkingHours(second.agent, second.csrf, payloadB),
    ]);

    // Chaque transaction répond avec son propre payload…
    await assertResponseMatches(resA, payloadA);
    await assertResponseMatches(resB, payloadB);

    // …et l'état final est exactement l'un des deux, jamais un mélange.
    const final = await first.agent.get("/api/barber/working-hours");
    const finalTuples = tuples(final.body.intervals);
    const matchesA = JSON.stringify(finalTuples) === JSON.stringify(tuples(payloadA));
    const matchesB = JSON.stringify(finalTuples) === JSON.stringify(tuples(payloadB));
    expect(matchesA || matchesB).toBe(true);
    expect(finalTuples).toHaveLength(1);

    const rows = await db.select().from(barberWorkingHours);
    expect(rows).toHaveLength(1);
  });

  it("serializes two simultaneous PUTs on a filled planning", async () => {
    await registerBarber("concurrent-filled@example.com");
    const first = await login("concurrent-filled@example.com");
    const second = await login("concurrent-filled@example.com");
    await createProfile(first.agent, first.csrf);

    await saveWorkingHours(first.agent, first.csrf, [
      { weekday: 3, startMinute: 540, endMinute: 720 },
      { weekday: 4, startMinute: 540, endMinute: 720 },
    ]);

    const payloadA = [{ weekday: 1, startMinute: 540, endMinute: 720 }];
    const payloadB = [
      { weekday: 5, startMinute: 480, endMinute: 600 },
      { weekday: 6, startMinute: 480, endMinute: 600 },
      { weekday: 7, startMinute: 480, endMinute: 600 },
    ];

    const [resA, resB] = await Promise.all([
      saveWorkingHours(first.agent, first.csrf, payloadA),
      saveWorkingHours(second.agent, second.csrf, payloadB),
    ]);

    await assertResponseMatches(resA, payloadA);
    await assertResponseMatches(resB, payloadB);

    const final = await first.agent.get("/api/barber/working-hours");
    const finalTuples = tuples(final.body.intervals);
    const matchesA = JSON.stringify(finalTuples) === JSON.stringify(tuples(payloadA));
    const matchesB = JSON.stringify(finalTuples) === JSON.stringify(tuples(payloadB));
    expect(matchesA || matchesB).toBe(true);
    expect(finalTuples).toHaveLength(matchesA ? payloadA.length : payloadB.length);

    const rows = await db.select().from(barberWorkingHours);
    expect(rows).toHaveLength(finalTuples.length);
  });
});
