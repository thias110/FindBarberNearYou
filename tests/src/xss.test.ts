// Anti-XSS (issue #12). Défense en couches :
// 1. l'API stocke et renvoie le texte tel quel, en JSON (jamais du HTML), avec
//    `X-Content-Type-Options: nosniff` ;
// 2. React échappe tout texte rendu (aucun `dangerouslySetInnerHTML` dans le
//    client) : une charge utile s'affiche comme du texte inerte ;
// 3. la CSP Nginx `script-src 'self'` bloque en dernier recours tout script
//    inline injecté.
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import request from "supertest";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../server/src/app";
import { db } from "../../server/src/db/client";
import { migrateDb } from "../../server/src/db/migrate";
import { barberProfiles, reviews } from "@findbarber/shared/schema";
import { BarberReviews } from "../../client/src/components/barber/BarberReviews";
import {
  createUser,
  hoursFromNow,
  insertBooking,
  resetBookingTables,
  seedBarber,
} from "./booking-api-helpers";

const PAYLOAD = `<script>alert("xss")</script><img src=x onerror="alert(1)">`;

const app = createApp();

beforeAll(async () => {
  await migrateDb();
});

beforeEach(async () => {
  await resetBookingTables();
});

describe("API : le texte utilisateur reste du texte JSON", () => {
  it("renvoie un avis et une description piégés à l'identique, en JSON nosniff", async () => {
    const barber = await seedBarber("xss-barber@example.com");
    await db
      .update(barberProfiles)
      .set({ description: PAYLOAD })
      .where(eq(barberProfiles.id, barber.profileId));
    const clientId = await createUser("xss-client@example.com", "CLIENT");
    const bookingId = await insertBooking({
      barber,
      clientUserId: clientId,
      startAt: hoursFromNow(-48),
      status: "COMPLETED",
    });
    await db
      .insert(reviews)
      .values({ id: randomUUID(), bookingId, rating: 4, comment: PAYLOAD });

    const profile = await request(app).get(`/api/barbers/${barber.profileId}`);
    expect(profile.status).toBe(200);
    expect(profile.headers["content-type"]).toMatch(/^application\/json/);
    expect(profile.headers["x-content-type-options"]).toBe("nosniff");
    expect(profile.body.profile.description).toBe(PAYLOAD);

    const list = await request(app).get(
      `/api/barbers/${barber.profileId}/reviews`,
    );
    expect(list.status).toBe(200);
    expect(list.headers["content-type"]).toMatch(/^application\/json/);
    expect(list.body.reviews[0].comment).toBe(PAYLOAD);
  });
});

describe("rendu React : la charge utile est échappée", () => {
  it("affiche un commentaire piégé comme du texte inerte", () => {
    const html = renderToStaticMarkup(
      createElement(BarberReviews, {
        summary: { averageRating: 4, totalReviews: 1 },
        reviews: [
          {
            id: "r1",
            rating: 4,
            comment: PAYLOAD,
            createdAt: new Date().toISOString(),
            clientName: `<b onmouseover="alert(2)">Eve</b>`,
          },
        ],
        loading: false,
        error: null,
        onRetry: () => {},
      }),
    );
    expect(html).not.toContain("<script");
    expect(html).not.toContain("<img");
    expect(html).not.toContain("<b onmouseover");
    expect(html).toContain("&lt;script&gt;");
  });

  it("le client n'utilise jamais dangerouslySetInnerHTML", () => {
    const root = fileURLToPath(new URL("../../client/src", import.meta.url));
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const file = path.join(dir, name);
        if (statSync(file).isDirectory()) walk(file);
        else if (/\.(tsx?|jsx?)$/.test(name)) {
          if (readFileSync(file, "utf8").includes("dangerouslySetInnerHTML")) {
            offenders.push(path.relative(root, file));
          }
        }
      }
    };
    walk(root);
    expect(offenders).toEqual([]);
  });
});
