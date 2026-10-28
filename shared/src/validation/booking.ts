import { z } from "zod";
import { LIMITS, LOCALES, PAYMENT_MODES, SERVICE_PLACES } from "../constants";
import { isValidCalendarDate } from "../dates";
import { emailSchema } from "./auth";
import { safeText } from "./safeText";

const objectIdSchema = z
  .string()
  .trim()
  .min(1, "Identifiant requis.")
  .max(64, "Identifiant trop long.");

const calendarDateSchema = z
  .string()
  .trim()
  .refine(
    isValidCalendarDate,
    "Date invalide : format AAAA-MM-JJ et date calendaire réelle attendus.",
  );

const servicePlaceSchema = z.enum(SERVICE_PLACES);

// Adresse client privée, géocodée côté serveur. Requise uniquement pour
// `AT_CLIENT` ; interdite pour les autres lieux. Les coordonnées ne sont JAMAIS
// acceptées du navigateur : seules celles du géocodeur serveur font foi.
const clientAddressSchema = safeText(
  LIMITS.clientAddress,
  "L'adresse est trop longue.",
).min(1, "L'adresse est requise.");

// --- Réservation (création) ---
// Le client ne choisit QUE la date et la minute murale locale : le serveur
// recalcule les créneaux et fait autorité. Aucun instant UTC ni prix/durée
// fourni par le client n'est accepté (champs inconnus refusés).
const bookingFields = {
  barberId: objectIdSchema,
  serviceId: objectIdSchema,
  date: calendarDateSchema,
  startMinute: z
    .number()
    .int("La minute de début doit être un entier.")
    .min(0, "La minute de début ne peut pas être négative.")
    .max(1439, "La minute de début ne peut pas dépasser 23:59."),
  place: servicePlaceSchema,
  clientAddress: clientAddressSchema.optional(),
};

// Adresse client exigée pour AT_CLIENT, refusée sinon (création et express).
function refineClientAddress(
  data: { place: string; clientAddress?: string },
  ctx: z.RefinementCtx,
): void {
  if (data.place === "AT_CLIENT") {
    if (!data.clientAddress) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Une adresse est requise pour une prestation chez le client.",
        path: ["clientAddress"],
      });
    }
  } else if (data.clientAddress) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message:
        "L'adresse client n'est autorisée que pour une prestation chez le client (AT_CLIENT).",
      path: ["clientAddress"],
    });
  }
}

export const bookingCreateSchema = z
  .object(bookingFields)
  .strict()
  .superRefine(refineClientAddress);

export type BookingCreateInput = z.infer<typeof bookingCreateSchema>;

// Réservation express (lot N6) : un visiteur crée son compte dans le tunnel.
// Mêmes règles que l'inscription pour l'email et le nom. Aucun mot de passe :
// il est choisi depuis le lien reçu par email, ce qui empêche un tiers de
// créer un compte au nom d'autrui avec un mot de passe qu'il connaît.
// `website` est un piège à robots (champ masqué, doit rester vide).
export const bookingExpressSchema = z
  .object({
    ...bookingFields,
    email: emailSchema,
    name: safeText(100, "Name is too long.").min(1, "Name cannot be empty."),
    locale: z.enum(LOCALES).optional(),
    website: z.string().max(500).optional(),
  })
  .strict()
  .superRefine(refineClientAddress);

export type BookingExpressInput = z.infer<typeof bookingExpressSchema>;

// --- Créneaux publics ---
export const bookingSlotsQuerySchema = z
  .object({
    serviceId: objectIdSchema,
    date: calendarDateSchema,
    place: servicePlaceSchema,
  })
  .strict();

export type BookingSlotsQuery = z.infer<typeof bookingSlotsQuerySchema>;

// Créneaux publics sur une plage de jours (lot N2, grille de la semaine) :
// `from` (date civile du salon) et `days` (1 à 7, 7 par défaut). Mêmes règles
// que la lecture d'un seul jour ; la réponse groupe les créneaux par date.
export const SLOTS_RANGE_MAX_DAYS = 7;

export const bookingSlotsRangeQuerySchema = z
  .object({
    serviceId: objectIdSchema,
    place: servicePlaceSchema,
    from: calendarDateSchema,
    days: z.coerce
      .number()
      .int("Le nombre de jours doit être un entier.")
      .min(1, "Au moins un jour.")
      .max(SLOTS_RANGE_MAX_DAYS, `Au plus ${SLOTS_RANGE_MAX_DAYS} jours.`)
      .default(SLOTS_RANGE_MAX_DAYS),
  })
  .strict();

export type BookingSlotsRangeQuery = z.infer<typeof bookingSlotsRangeQuerySchema>;

// --- Refus d'une demande par le barber (lot 4 rouvert) ---
// Motif facultatif, visible par le client. Chaîne vide ou absente = sans motif.
export const bookingDeclineSchema = z
  .object({
    reason: safeText(
      LIMITS.bookingDeclineReason,
      "Le motif est trop long.",
    ).optional(),
  })
  .strict();

export type BookingDeclineInput = z.infer<typeof bookingDeclineSchema>;

// Politique de paiement en ligne du barber (issue #10).
export const paymentSettingsSchema = z
  .object({
    paymentMode: z.enum(PAYMENT_MODES),
    depositPercent: z
      .number()
      .int()
      .min(LIMITS.depositPercentMin)
      .max(LIMITS.depositPercentMax)
      .optional(),
  })
  .strict();

export type PaymentSettingsInput = z.infer<typeof paymentSettingsSchema>;
