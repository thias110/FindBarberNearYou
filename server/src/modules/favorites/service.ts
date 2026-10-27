import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "../../db/client.js";
import { barberProfiles, favorites, users } from "@findbarber/shared/schema";
import { LIMITS } from "@findbarber/shared/constants";
import type { FavoritesResponse } from "@findbarber/shared/types";
import { AppError } from "../../lib/errors.js";
import { loadSearchItems, publicBarberConditions } from "../barber/service.js";

// --- Favoris (lot N5) ---
// Un favori n'est listé que tant que le barber est visible du public (compte
// actif, profil approuvé) ; la ligne reste en base et réapparaît si le barber
// redevient visible.

/** Favoris du client, du plus récent au plus ancien, barbers visibles seulement. */
export async function listFavorites(userId: string): Promise<FavoritesResponse> {
  const rows = await db
    .select({ barberProfileId: favorites.barberProfileId })
    .from(favorites)
    .where(eq(favorites.userId, userId))
    .orderBy(desc(favorites.createdAt));
  if (rows.length === 0) return { barbers: [] };

  const ids = rows.map((row) => row.barberProfileId);
  const items = await loadSearchItems(
    and(...publicBarberConditions(), inArray(barberProfiles.id, ids))!,
  );
  const byId = new Map(items.map((item) => [item.id, item]));
  return {
    barbers: ids.flatMap((id) => {
      const item = byId.get(id);
      return item ? [item] : [];
    }),
  };
}

/** Ajoute un favori. Idempotent : un favori déjà présent ne change rien. */
export async function addFavorite(
  userId: string,
  barberId: string,
): Promise<void> {
  const [visible] = await db
    .select({ id: barberProfiles.id })
    .from(barberProfiles)
    .innerJoin(users, eq(barberProfiles.userId, users.id))
    .where(and(...publicBarberConditions(), eq(barberProfiles.id, barberId)))
    .limit(1);
  if (!visible) {
    throw new AppError(404, "BARBER_PROFILE_NOT_FOUND", "Profil introuvable.");
  }

  await db.transaction(async (tx) => {
    const existing = await tx
      .select({ id: favorites.barberProfileId })
      .from(favorites)
      .where(eq(favorites.userId, userId));
    if (existing.some((row) => row.id === barberId)) return;
    if (existing.length >= LIMITS.favoritesMax) {
      throw new AppError(
        409,
        "FAVORITES_LIMIT_REACHED",
        `Vous pouvez garder ${LIMITS.favoritesMax} favoris au maximum.`,
      );
    }
    await tx
      .insert(favorites)
      .values({ userId, barberProfileId: barberId })
      .onConflictDoNothing();
  });
}

/** Retire un favori. Idempotent : retirer un favori absent réussit aussi. */
export async function removeFavorite(
  userId: string,
  barberId: string,
): Promise<void> {
  await db
    .delete(favorites)
    .where(
      and(eq(favorites.userId, userId), eq(favorites.barberProfileId, barberId)),
    );
}
