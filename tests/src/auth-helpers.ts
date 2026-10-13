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
