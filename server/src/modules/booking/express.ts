import { eq } from "drizzle-orm";
import { db } from "../../db/client.js";
import { barberProfiles } from "@findbarber/shared/schema";
import { LIMITS } from "@findbarber/shared/constants";
import type { BookingExpressInput } from "@findbarber/shared/validation";
import { AppError, isExclusionViolation } from "../../lib/errors.js";
import { sendExpressBookingEmail } from "../../lib/email.js";
import {
  generateEmailToken,
  hashPassword,
  insertUser,
  isEmailTaken,
  issuePasswordResetToken,
  normalizeEmail,
  notifyExistingAccount,
} from "../auth/service.js";
import { geocodeClientAddress, insertBookingUnderLock } from "./service.js";

// --- Réservation express (lot N6) ---
// Un visiteur sans compte réserve en saisissant nom et email à la dernière
// étape du tunnel. Dans UNE transaction : le compte est créé non vérifié, avec
// un mot de passe aléatoire que personne ne connaît, la demande est
// enregistrée en attente de l'email (créneau bloqué `expressBookingHoldMinutes`,
// demande invisible du barber), et un jeton de choix du mot de passe est émis.
// Après validation de la transaction, un seul email réunit ce lien et le
// récapitulatif. Choisir son mot de passe prouve la possession de l'adresse,
// vérifie le compte et transmet la demande au barber (`resetPassword`, puis
// `expressRelease.ts`) ; sans clic, elle expire. Un tiers qui réserve avec
// l'adresse d'autrui ne peut donc jamais se connecter à ce compte.
// Garde-fous : email déjà connu → réponse identique à un succès, rien n'est
// créé ni fusionné, et le titulaire est invité par email à se connecter ;
// barber qui exige un paiement en ligne → compte classique ; plafond de
// demandes non confirmées par barber (`insertBookingUnderLock`) ; limiteur de
// l'inscription et piège à robots dans la route.

/** Délai pour cliquer sur le lien, en millisecondes. */
export const EXPRESS_HOLD_MS = LIMITS.expressBookingHoldMinutes * 60_000;

export async function createExpressBooking(
  input: Omit<BookingExpressInput, "website">,
): Promise<{ expiresAt: string }> {
  // Champs du compte séparés de la demande elle-même.
  const { email, name, locale, ...bookingInput } = input;
  // Mot de passe inutilisable (jamais transmis). Hachage hors transaction :
  // jamais de calcul coûteux sous le verrou du profil.
  const passwordHash = await hashPassword(generateEmailToken());
  // Chez le client : géocodage avant la transaction (jamais sous le verrou).
  const clientLocation = await geocodeClientAddress(bookingInput);
  const expiresAt = new Date(Date.now() + EXPRESS_HOLD_MS);

  let created;
  try {
    created = await db.transaction(async (tx) => {
      const runner = tx as unknown as typeof db;
      const user = await insertUser(runner, {
        email: normalizeEmail(email),
        passwordHash,
        role: "CLIENT",
        name,
        locale,
      });
      const booking = await insertBookingUnderLock(runner, user.id, bookingInput, {
        emailConfirmExpiresAt: expiresAt,
        clientLocation,
      });
      const token = await issuePasswordResetToken(user.id, runner);
      return { user, booking, token };
    });
  } catch (err) {
    if (isEmailTaken(err)) {
      await notifyExistingAccount(normalizeEmail(email));
      return { expiresAt: expiresAt.toISOString() };
    }
    if (isExclusionViolation(err)) {
      throw new AppError(409, "SLOT_UNAVAILABLE", "Ce créneau n'est plus disponible.");
    }
    throw err;
  }

  const { user, booking, token } = created;
  const [profile] = await db
    .select({ timezone: barberProfiles.timezone })
    .from(barberProfiles)
    .where(eq(barberProfiles.id, booking.barberId))
    .limit(1);
  // Un échec d'envoi n'annule rien : le lien se redemande (« Renvoyer le lien »).
  await sendExpressBookingEmail({
    to: user.email,
    token,
    locale: user.locale,
    barberName: booking.barberDisplayName,
    serviceName: booking.serviceName,
    servicePlace: booking.servicePlace,
    startAt: new Date(booking.startAt),
    timeZone: profile?.timezone ?? "UTC",
    minutes: LIMITS.expressBookingHoldMinutes,
  });

  return { expiresAt: expiresAt.toISOString() };
}
