// Helpers partagés des tests d'intégration. La vérification d'email est
// désormais active : les suites qui ne testent pas ce flux marquent les
// comptes créés comme vérifiés via `markEmailVerified`. Les suites qui testent
// le flux utilisent les endpoints réels (`/verify-email`, `/resend-verification`).
import { eq } from "drizzle-orm";
import { db } from "../../server/src/db/client";
import { users } from "@findbarber/shared/schema";

export async function markEmailVerified(email: string): Promise<void> {
  await db
    .update(users)
    .set({ emailVerifiedAt: new Date() })
    .where(eq(users.email, email.trim().toLowerCase()));
}

// Photo de profil obligatoire pour créer un profil barber (issue #44) : les
// suites qui créent un profil par l'API donnent d'abord un avatar au compte.
// Le parcours d'envoi réel est testé dans avatar.integration.test.ts.
export const TEST_AVATAR_PATH = "avatars/test-avatar.webp";

export async function giveAvatar(email: string): Promise<void> {
  await db
    .update(users)
    .set({ avatarPath: TEST_AVATAR_PATH })
    .where(eq(users.email, email.trim().toLowerCase()));
}
