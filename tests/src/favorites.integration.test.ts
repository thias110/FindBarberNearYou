// Favoris (lot N5) : un CLIENT garde des barbers visibles du public.
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import request from "supertest";
import { createApp } from "../../server/src/app";
import { db } from "../../server/src/db/client";
import { migrateDb } from "../../server/src/db/migrate";
import {
  auditLogs,
  barberProfiles,
  favorites,
  users,
} from "@findbarber/shared/schema";
import { LIMITS } from "@findbarber/shared/constants";
import {
  PASSWORD,
  createUser,
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
  await db.delete(favorites);
  await resetBookingTables();
});

async function setup() {
  const barber = await seedBarber("fav-barber@example.com");
  await createUser("fav-client@example.com", "CLIENT");
  const client = await login(app, "fav-client@example.com");
  return { barber, client };
}

function put(
  session: Awaited<ReturnType<typeof login>>,
  barberId: string,
  csrf: string | null = session.csrf,
) {
  const req = session.agent.put(`/api/users/me/favorites/${barberId}`);
  return csrf ? req.set("X-CSRF-Token", csrf) : req;
}

describe("favoris : ajout, liste, retrait", () => {
  it("ajoute un favori (idempotent) et le liste avec sa carte publique", async () => {
    const { barber, client } = await setup();
    expect((await put(client, barber.profileId)).status).toBe(204);
    expect((await put(client, barber.profileId)).status).toBe(204);

    const rows = await db.select().from(favorites);
    expect(rows).toHaveLength(1);

    const res = await client.agent.get("/api/users/me/favorites");
    expect(res.status).toBe(200);
    expect(res.body.barbers).toHaveLength(1);
    expect(res.body.barbers[0].id).toBe(barber.profileId);
    expect(res.body.barbers[0].displayName).toBe("Barbier Test");
    // Jamais l'adresse privée.
    expect(JSON.stringify(res.body)).not.toContain("Rue du Test");
  });

  it("liste du plus récent au plus ancien", async () => {
    const { barber, client } = await setup();
    const second = await seedBarber("fav-barber2@example.com");
    await put(client, barber.profileId);
    await put(client, second.profileId);
    const res = await client.agent.get("/api/users/me/favorites");
    expect(res.body.barbers.map((b: { id: string }) => b.id)).toEqual([
      second.profileId,
      barber.profileId,
    ]);
  });

  it("retire un favori (idempotent)", async () => {
    const { barber, client } = await setup();
    await put(client, barber.profileId);
    for (let i = 0; i < 2; i += 1) {
      const res = await client.agent
        .delete(`/api/users/me/favorites/${barber.profileId}`)
        .set("X-CSRF-Token", client.csrf);
      expect(res.status).toBe(204);
    }
    expect(await db.select().from(favorites)).toHaveLength(0);
  });

  it("ne mélange pas les favoris de deux clients", async () => {
    const { barber, client } = await setup();
    await createUser("fav-client2@example.com", "CLIENT");
    const other = await login(app, "fav-client2@example.com");
    await put(client, barber.profileId);
    const res = await other.agent.get("/api/users/me/favorites");
    expect(res.body.barbers).toEqual([]);
  });
});

describe("favoris : accès", () => {
  it("exige une session", async () => {
    const { barber } = await setup();
    const bare = request(app);
    expect((await bare.get("/api/users/me/favorites")).status).toBe(401);
    expect(
      (await bare.put(`/api/users/me/favorites/${barber.profileId}`)).status,
    ).toBe(401);
  });

  it("refuse les rôles BARBER et ADMIN (403)", async () => {
    const { barber } = await setup();
    await createUser("fav-admin@example.com", "ADMIN");
    const barberSession = await login(app, "fav-barber@example.com");
    const adminSession = await login(app, "fav-admin@example.com");
    for (const session of [barberSession, adminSession]) {
      expect((await session.agent.get("/api/users/me/favorites")).status).toBe(
        403,
      );
      expect((await put(session, barber.profileId)).status).toBe(403);
    }
  });

  it("exige le jeton CSRF pour écrire", async () => {
    const { barber, client } = await setup();
    expect((await put(client, barber.profileId, null)).status).toBe(403);
    const res = await client.agent
      .delete(`/api/users/me/favorites/${barber.profileId}`);
    expect(res.status).toBe(403);
    expect(await db.select().from(favorites)).toHaveLength(0);
  });
});

describe("favoris : règles métier", () => {
  it("refuse un barber inconnu ou non approuvé (404)", async () => {
    const { barber, client } = await setup();
    expect((await put(client, "inconnu")).status).toBe(404);

    await db
      .update(barberProfiles)
      .set({ approvedAt: null })
      .where(eq(barberProfiles.id, barber.profileId));
    expect((await put(client, barber.profileId)).status).toBe(404);
  });

  it("masque un favori dont le barber n'est plus visible, puis le retrouve", async () => {
    const { barber, client } = await setup();
    await put(client, barber.profileId);

    await db
      .update(users)
      .set({ status: "SUSPENDED" })
      .where(eq(users.id, barber.userId));
    let res = await client.agent.get("/api/users/me/favorites");
    expect(res.body.barbers).toEqual([]);

    await db
      .update(users)
      .set({ status: "ACTIVE" })
      .where(eq(users.id, barber.userId));
    res = await client.agent.get("/api/users/me/favorites");
    expect(res.body.barbers).toHaveLength(1);
  });

  it("plafonne le nombre de favoris (409), sans refuser un favori déjà présent", async () => {
    const { barber, client } = await setup();
    const clientRow = (
      await db.select().from(users).where(eq(users.email, "fav-client@example.com"))
    )[0]!;
    await put(client, barber.profileId);
    for (let i = 1; i < LIMITS.favoritesMax; i += 1) {
      const extra = await seedBarber(`fav-extra-${i}@example.com`);
      await db
        .insert(favorites)
        .values({ userId: clientRow.id, barberProfileId: extra.profileId });
    }
    const one = await seedBarber("fav-one-too-many@example.com");
    const res = await put(client, one.profileId);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("FAVORITES_LIMIT_REACHED");
    expect((await put(client, barber.profileId)).status).toBe(204);
  });

  it("supprime les favoris quand le barber est supprimé (cascade)", async () => {
    const { barber, client } = await setup();
    await put(client, barber.profileId);
    await db.delete(barberProfiles).where(eq(barberProfiles.id, barber.profileId));
    expect(await db.select().from(favorites)).toHaveLength(0);
  });
});

describe("favoris : données personnelles", () => {
  it("l'export JSON inclut les favoris", async () => {
    const { barber, client } = await setup();
    await put(client, barber.profileId);
    const res = await client.agent.get("/api/users/me/export");
    expect(res.status).toBe(200);
    expect(res.body.favorites).toHaveLength(1);
    expect(res.body.favorites[0].barberProfileId).toBe(barber.profileId);
  });

  it("la suppression du compte efface les favoris", async () => {
    const { barber, client } = await setup();
    await put(client, barber.profileId);
    const res = await client.agent
      .delete("/api/users/me")
      .set("X-CSRF-Token", client.csrf)
      .send({ password: PASSWORD });
    expect(res.status).toBe(204);
    expect(await db.select().from(favorites)).toHaveLength(0);
  });
});
