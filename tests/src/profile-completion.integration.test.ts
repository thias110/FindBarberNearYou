// Checklist de finalisation du profil barber (issue #42) : progression
// calculée côté serveur, pour le seul propriétaire authentifié.
import { randomUUID } from "node:crypto";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { eq } from "drizzle-orm";
import { createApp } from "../../server/src/app";
import { db } from "../../server/src/db/client";
import { migrateDb } from "../../server/src/db/migrate";
import {
  barberPhotos,
  barberProfiles,
  barberServices,
  barberWorkingHours,
  users,
} from "@findbarber/shared/schema";
import { giveAvatar, markEmailVerified } from "./auth-helpers";

const app = createApp();
const PASSWORD = "password123";

beforeAll(async () => {
  await migrateDb();
});

beforeEach(async () => {
  await db.delete(barberPhotos);
  await db.delete(barberWorkingHours);
  await db.delete(barberServices);
  await db.delete(barberProfiles);
  await db.delete(users);
});

async function register(email: string, role: "BARBER" | "CLIENT" = "BARBER") {
  const res = await request(app)
    .post("/api/auth/register")
    .send({ email, password: PASSWORD, role });
  expect(res.status).toBe(201);
  await markEmailVerified(email);
  if (role === "BARBER") await giveAvatar(email);
  const agent = request.agent(app);
  const login = await agent.post("/api/auth/login").send({ email, password: PASSWORD });
  expect(login.status).toBe(200);
  return { agent, csrf: login.body.csrfToken as string };
}

async function createProfile(agent: request.SuperAgentTest, csrf: string) {
  const res = await agent
    .put("/api/barber/profile")
    .set("X-CSRF-Token", csrf)
    .send({
      displayName: "Barbier",
      description: "Coupes",
      address: "Rue 1",
      city: "Genève",
      countryCode: "CH",
      latitude: 46.2,
      longitude: 6.14,
      places: ["SALON"],
    });
  expect(res.status).toBe(200);
  return res.body.profile.id as string;
}

async function completion(agent: request.SuperAgentTest) {
  const res = await agent.get("/api/barber/profile/completion");
  expect(res.status).toBe(200);
  return res.body.completion as {
    steps: { step: string; done: boolean }[];
    completedCount: number;
    totalCount: number;
    percent: number;
    complete: boolean;
  };
}

function doneSteps(value: Awaited<ReturnType<typeof completion>>) {
  return value.steps.filter((item) => item.done).map((item) => item.step);
}

describe("GET /api/barber/profile/completion (issue #42)", () => {
  it("lists every step as pending for a barber without profile", async () => {
    const { agent } = await register("new@example.com");
    const value = await completion(agent);
    expect(value.steps.map((item) => item.step)).toEqual([
      "AVATAR",
      "PROFILE",
      "SERVICES",
      "WORKING_HOURS",
      "GALLERY",
    ]);
    // Le compte de test a déjà sa photo (giveAvatar) : seule l'étape AVATAR est faite.
    expect(doneSteps(value)).toEqual(["AVATAR"]);
    expect(value).toMatchObject({ completedCount: 1, totalCount: 5, percent: 20, complete: false });
  });

  it("tracks progress step by step until the profile is complete", async () => {
    const { agent, csrf } = await register("progress@example.com");
    const profileId = await createProfile(agent, csrf);
    expect(await completion(agent)).toMatchObject({ completedCount: 2, percent: 40 });

    // Un service inactif ne compte pas.
    const service = await agent
      .post("/api/barber/services")
      .set("X-CSRF-Token", csrf)
      .send({ name: "Coupe", durationMinutes: 30, priceMinor: 2500 });
    expect(service.status).toBe(201);
    expect(doneSteps(await completion(agent))).toEqual(["AVATAR", "PROFILE", "SERVICES"]);
    await agent
      .patch(`/api/barber/services/${service.body.service.id}`)
      .set("X-CSRF-Token", csrf)
      .send({ isActive: false });
    expect(doneSteps(await completion(agent))).toEqual(["AVATAR", "PROFILE"]);
    await agent
      .patch(`/api/barber/services/${service.body.service.id}`)
      .set("X-CSRF-Token", csrf)
      .send({ isActive: true });

    await db.insert(barberWorkingHours).values({
      id: randomUUID(),
      barberProfileId: profileId,
      weekday: 1,
      startMinute: 540,
      endMinute: 1080,
    });
    expect(await completion(agent)).toMatchObject({ completedCount: 4, percent: 80, complete: false });

    await db.insert(barberPhotos).values({
      id: randomUUID(),
      barberProfileId: profileId,
      imagePath: "gallery/photo.webp",
    });
    expect(await completion(agent)).toMatchObject({
      completedCount: 5,
      percent: 100,
      complete: true,
    });
  });

  it("never exposes another barber's progress", async () => {
    const owner = await register("owner@example.com");
    const ownerProfileId = await createProfile(owner.agent, owner.csrf);
    await db.insert(barberPhotos).values({
      id: randomUUID(),
      barberProfileId: ownerProfileId,
      imagePath: "gallery/owner.webp",
    });

    const other = await register("other@example.com");
    // Un identifiant passé en paramètre est ignoré : seule la session compte.
    const res = await other.agent.get(
      `/api/barber/profile/completion?barberProfileId=${ownerProfileId}`,
    );
    expect(res.status).toBe(200);
    expect(doneSteps(res.body.completion)).toEqual(["AVATAR"]);
    const [ownerRow] = await db
      .select({ id: barberProfiles.id })
      .from(barberProfiles)
      .where(eq(barberProfiles.id, ownerProfileId));
    expect(ownerRow).toBeDefined();
  });

  it("is reserved to authenticated barbers", async () => {
    expect((await request(app).get("/api/barber/profile/completion")).status).toBe(401);
    const client = await register("client@example.com", "CLIENT");
    expect((await client.agent.get("/api/barber/profile/completion")).status).toBe(403);
  });
});

describe("photo de profil obligatoire (issue #44)", () => {
  it("refuses to create a new profile without a photo", async () => {
    const { agent, csrf } = await register("no-photo@example.com");
    await db
      .update(users)
      .set({ avatarPath: null })
      .where(eq(users.email, "no-photo@example.com"));

    const res = await agent
      .put("/api/barber/profile")
      .set("X-CSRF-Token", csrf)
      .send({
        displayName: "Barbier",
        description: "Coupes",
        address: "Rue 1",
        city: "Genève",
        countryCode: "CH",
        latitude: 46.2,
        longitude: 6.14,
        places: ["SALON"],
      });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("AVATAR_REQUIRED");
    expect(res.body.error.message).toMatch(/photo de profil est requise/);
    expect(await db.select().from(barberProfiles)).toHaveLength(0);
  });

  it("keeps an existing profile without photo editable, and flags the step until a photo is added", async () => {
    const { agent, csrf } = await register("legacy@example.com");
    await createProfile(agent, csrf);
    // Barber existant au déploiement : profil déjà créé, pas de photo.
    await db
      .update(users)
      .set({ avatarPath: null })
      .where(eq(users.email, "legacy@example.com"));

    const before = await completion(agent);
    expect(doneSteps(before)).toEqual(["PROFILE"]);
    expect(before.complete).toBe(false);

    // La mise à jour du profil existant reste possible sans photo.
    const update = await agent
      .put("/api/barber/profile")
      .set("X-CSRF-Token", csrf)
      .send({
        displayName: "Barbier modifié",
        description: "Coupes",
        address: "Rue 1",
        city: "Genève",
        countryCode: "CH",
        latitude: 46.2,
        longitude: 6.14,
        places: ["SALON"],
      });
    expect(update.status).toBe(200);

    await giveAvatar("legacy@example.com");
    expect(doneSteps(await completion(agent))).toEqual(["AVATAR", "PROFILE"]);
  });
});
