import { eq } from "drizzle-orm";
import { db } from "../../db/client.js";
import { barberProfiles } from "@findbarber/shared/schema";
import { LIMITS } from "@findbarber/shared/constants";
import type { BookingExpressInput } from "@findbarber/shared/validation";
import { AppError, isExclusionViolation } from "../../lib/errors.js";
import { sendExpressBookingEmail } from "../../lib/email.js";
import {
  hashPassword,
  insertUser,
  issueEmailVerificationToken,
  normalizeEmail,
} from "../auth/service.js";
import { insertBookingUnderLock } from "./service.js";

// --- Réservation express (lot N6) ---
// Un visiteur sans compte réserve en saisissant nom, email et mot de passe à
// la dernière étape du tunnel. Dans UNE transaction : le compte est créé non
// vérifié, la demande est enregistrée en attente de l'email (créneau bloqué
// `expressBookingHoldMinutes`, demande invisible du barber), et un jeton de
// vérification est émis. Après validation de la transaction, un seul email
// réunit le lien de vérification et le récapitulatif. Le clic transmet la
// demande au barber (voir `expressRelease.ts`) ; sans clic, elle expire.
// Garde-fous : email déjà connu → connexion demandée (aucune fusion
// silencieuse) ; barber qui exige un paiement en ligne → compte classique ;
// plafond de demandes non confirmées par barber (`insertBookingUnderLock`) ;
// limiteur de l'inscription et piège à robots dans la route.

/** Délai pour cliquer sur le lien, en millisecondes. */
export const EXPRESS_HOLD_MS = LIMITS.expressBookingHoldMinutes * 60_000;

export async function createExpressBooking(
  input: Omit<BookingExpressInput, "website">,
): Promise<{ expiresAt: string }> {
  // Champs du compte séparés de la demande elle-même.
  const { email, password, name, locale, ...bookingInput } = input;
  // Hachage hors transaction : jamais de calcul coûteux sous le verrou du profil.
  const passwordHash = await hashPassword(password);
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
      });
      const token = await issueEmailVerificationToken(user.id, runner);
      return { user, booking, token };
    });
  } catch (err) {
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
