// Approbation des profils barber (issue #40) pour les tests qui créent un
// profil par l'API : un profil neuf est invisible du public tant que l'ADMIN
// ne l'a pas approuvé. Le parcours d'approbation lui-même est testé dans
// barber-approval.integration.test.ts.
import { eq } from "drizzle-orm";
import { barberProfiles } from "@findbarber/shared/schema";
import { db } from "../../server/src/db/client";

export async function approveProfile(barberProfileId: string): Promise<void> {
  await db
    .update(barberProfiles)
    .set({ approvedAt: new Date() })
    .where(eq(barberProfiles.id, barberProfileId));
}
