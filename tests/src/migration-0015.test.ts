// Migration du lot 4 rouvert (refus, expiration, anti-chevauchement) sur une
// base peuplée. Cible découverte PAR CONTENU (`bookings_no_overlap`). Vérifie
// que les données existantes sont conservées, les nouveaux statuts et colonnes,
// et la contrainte d'exclusion sur les seuls statuts actifs.
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { btree_gist } from "@electric-sql/pglite/contrib/btree_gist";
import { describe, expect, it } from "vitest";
import {
  findTagBySqlContent,
  readMigration,
  tagsBefore,
} from "./migration-helpers";

const TAG = findTagBySqlContent((sql) => sql.includes("bookings_no_overlap"));

function bookingInsert(
  ids: { user: string; profile: string; service: string },
  start: string,
  end: string,
  status: string,
  id = randomUUID(),
): string {
  return `INSERT INTO bookings
    (id, client_user_id, barber_profile_id, service_id, start_at, end_at,
     service_place, status, barber_display_name, service_name, service_description,
     duration_minutes, price_minor, currency)
    VALUES ('${id}', '${ids.user}', '${ids.profile}', '${ids.service}',
      '${start}', '${end}', 'SALON', '${status}',
      'Legacy Barber', 'Ancien service', NULL, 30, 2500, 'CHF');`;
}

describe("migration lot 4 sur une base peuplée", () => {
  it("conserve les réservations, ajoute DECLINED/EXPIRED et refuse les chevauchements actifs", async () => {
    const client = new PGlite({ extensions: { btree_gist } });
    for (const tag of tagsBefore(TAG)) {
      await client.exec(readMigration(tag));
    }

    const ids = { user: randomUUID(), profile: randomUUID(), service: randomUUID() };
    const pendingId = randomUUID();
    await client.exec(`
      INSERT INTO users (id, email, password_hash, role, status)
        VALUES ('${ids.user}', 'legacy-lot4@example.com', 'hash', 'BARBER', 'ACTIVE');
      INSERT INTO barber_profiles
        (id, user_id, display_name, description, address, city, postal_code, country_code, latitude, longitude, currency)
        VALUES ('${ids.profile}', '${ids.user}', 'Legacy Barber', 'desc', 'Rue 1', 'Genève', NULL, 'CH', 46.2, 6.14, 'CHF');
      INSERT INTO barber_services
        (id, barber_profile_id, name, description, duration_minutes, price_minor, is_active)
        VALUES ('${ids.service}', '${ids.profile}', 'Ancien service', NULL, 30, 2500, true);
      ${bookingInsert(ids, "2026-06-01T09:00:00Z", "2026-06-01T09:30:00Z", "PENDING", pendingId)}
      ${bookingInsert(ids, "2026-06-01T09:00:00Z", "2026-06-01T09:30:00Z", "CANCELLED")}
      ${bookingInsert(ids, "2026-06-01T09:30:00Z", "2026-06-01T10:00:00Z", "CONFIRMED")}
    `);

    await client.exec(readMigration(TAG));

    // Données conservées, nouvelles colonnes nulles.
    const rows = await client.query<{ n: number; declined: number }>(
      `SELECT count(*)::int AS n,
              count(declined_at)::int + count(decline_reason)::int AS declined
         FROM bookings`,
    );
    expect(rows.rows[0]).toEqual({ n: 3, declined: 0 });

    // Nouveaux statuts et motif de refus utilisables.
    await client.exec(`
      UPDATE bookings SET status = 'DECLINED', declined_at = now(), decline_reason = 'Complet'
        WHERE id = '${pendingId}';
    `);
    await client.exec(
      bookingInsert(ids, "2026-06-02T09:00:00Z", "2026-06-02T09:30:00Z", "EXPIRED"),
    );
    await expect(
      client.exec(
        `UPDATE bookings SET decline_reason = '${"x".repeat(501)}' WHERE id = '${pendingId}'`,
      ),
    ).rejects.toThrow();

    // Chevauchement entre deux réservations actives : refusé (23P01).
    await expect(
      client.exec(
        bookingInsert(ids, "2026-06-01T09:45:00Z", "2026-06-01T10:15:00Z", "PENDING"),
      ),
    ).rejects.toThrow(/bookings_no_overlap/);
    // Intervalles semi-ouverts : un créneau contigu est accepté.
    await client.exec(
      bookingInsert(ids, "2026-06-01T10:00:00Z", "2026-06-01T10:30:00Z", "PENDING"),
    );
    // Le créneau d'une réservation refusée est de nouveau libre.
    await client.exec(
      bookingInsert(ids, "2026-06-01T09:00:00Z", "2026-06-01T09:30:00Z", "CONFIRMED"),
    );

    const notif = await client.query<{ v: string }>(
      "SELECT unnest(enum_range(NULL::notification_type))::text AS v",
    );
    expect(notif.rows.map((r) => r.v)).toEqual(
      expect.arrayContaining(["BOOKING_DECLINED", "BOOKING_EXPIRED"]),
    );

    await client.close();
  });
});
