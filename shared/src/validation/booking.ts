import { z } from "zod";
import { SERVICE_PLACES } from "../constants";
import { isValidCalendarDate } from "../dates";

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

// --- Réservation (création) ---
// Le client ne choisit QUE la date et la minute murale locale : le serveur
// recalcule les créneaux et fait autorité. Aucun instant UTC ni prix/durée
// fourni par le client n'est accepté (champs inconnus refusés).
export const bookingCreateSchema = z
  .object({
    barberId: objectIdSchema,
    serviceId: objectIdSchema,
    date: calendarDateSchema,
    startMinute: z
      .number()
      .int("La minute de début doit être un entier.")
      .min(0, "La minute de début ne peut pas être négative.")
      .max(1439, "La minute de début ne peut pas dépasser 23:59."),
    place: servicePlaceSchema,
  })
  .strict();

export type BookingCreateInput = z.infer<typeof bookingCreateSchema>;

// --- Créneaux publics ---
export const bookingSlotsQuerySchema = z
  .object({
    serviceId: objectIdSchema,
    date: calendarDateSchema,
    place: servicePlaceSchema,
  })
  .strict();

export type BookingSlotsQuery = z.infer<typeof bookingSlotsQuerySchema>;
