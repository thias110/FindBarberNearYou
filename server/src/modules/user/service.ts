import { eq } from "drizzle-orm";
import { db } from "../../db/client.js";
import { users, type User } from "@findbarber/shared/schema";
import { AppError } from "../../lib/errors.js";
import { toAvatarWebp } from "../../lib/images.js";
import { remove, save } from "../../lib/storage.js";

// Avatar utilisateur (issue #8). Le traitement d'image est délégué à `sharp`
// (512x512 WebP) et l'écriture à l'abstraction de stockage. L'ancien fichier est
// supprimé après la mise à jour réussie de `users.avatarPath`.

async function requireUser(userId: string): Promise<User> {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!user) {
    throw new AppError(404, "USER_NOT_FOUND", "Utilisateur introuvable.");
  }
  return user;
}

export async function updateAvatar(
  userId: string,
  buffer: Buffer,
): Promise<User> {
  const current = await requireUser(userId);
  const webp = await toAvatarWebp(buffer);
  const storedPath = await save(webp, "avatars");

  let updated: User;
  try {
    [updated] = await db
      .update(users)
      .set({ avatarPath: storedPath, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();
  } catch (err) {
    // Mise à jour DB échouée : supprimer le nouvel avatar orphelin sans masquer
    // l'erreur initiale.
    await remove(storedPath).catch(() => {});
    throw err;
  }

  // L'ancien fichier n'est supprimé qu'après la mise à jour DB réussie. Un
  // échec de suppression ne remet pas en cause la mise à jour (comportement
  // conservé).
  if (current.avatarPath) {
    await remove(current.avatarPath);
  }
  return updated;
}

export async function deleteAvatar(userId: string): Promise<User> {
  const current = await requireUser(userId);

  const [updated] = await db
    .update(users)
    .set({ avatarPath: null, updatedAt: new Date() })
    .where(eq(users.id, userId))
    .returning();

  if (current.avatarPath) {
    await remove(current.avatarPath);
  }
  return updated;
}
