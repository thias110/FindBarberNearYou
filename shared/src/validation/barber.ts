import { z } from "zod";
import { LIMITS, SUPPORTED_CURRENCIES } from "../constants";
import { isCountryCode } from "../countries";

const currencySchema = z.enum(SUPPORTED_CURRENCIES);

const countryCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .refine(isCountryCode, "Code pays invalide.");

const latitudeSchema = z
  .number()
  .finite("La latitude doit être un nombre fini.")
  .min(-90, "La latitude doit être comprise entre -90 et 90.")
  .max(90, "La latitude doit être comprise entre -90 et 90.");

const longitudeSchema = z
  .number()
  .finite("La longitude doit être un nombre fini.")
  .min(-180, "La longitude doit être comprise entre -180 et 180.")
  .max(180, "La longitude doit être comprise entre -180 et 180.");

export const profileSchema = z
  .object({
    displayName: z
      .string()
      .trim()
      .min(1, "Le nom affiché est requis.")
      .max(LIMITS.profileDisplayName, "Le nom affiché est trop long."),
    description: z
      .string()
      .trim()
      .min(1, "La description est requise.")
      .max(LIMITS.profileDescription, "La description est trop longue."),
    address: z
      .string()
      .trim()
      .min(1, "L'adresse est requise.")
      .max(LIMITS.profileAddress, "L'adresse est trop longue."),
    city: z
      .string()
      .trim()
      .min(1, "La ville est requise.")
      .max(LIMITS.profileCity, "La ville est trop longue."),
    postalCode: z
      .string()
      .trim()
      .max(LIMITS.profilePostalCode, "Le code postal est trop long.")
      .nullish()
      .transform((value) => (value ? value : null)),
    countryCode: countryCodeSchema,
    latitude: latitudeSchema,
    longitude: longitudeSchema,
    currency: currencySchema,
  })
  .strict();

export const serviceCreateSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, "Le nom du service est requis.")
      .max(LIMITS.serviceName, "Le nom du service est trop long."),
    description: z
      .string()
      .trim()
      .max(LIMITS.serviceDescription, "La description du service est trop longue.")
      .nullish()
      .transform((value) => (value ? value : null)),
    durationMinutes: z
      .number()
      .int("La durée doit être un entier.")
      .min(LIMITS.serviceDurationMin, "La durée doit être supérieure à 0.")
      .max(
        LIMITS.serviceDurationMax,
        `La durée ne peut pas dépasser ${LIMITS.serviceDurationMax} minutes.`,
      ),
    priceMinor: z
      .number()
      .int("Le prix doit être un entier (unités mineures).")
      .min(LIMITS.servicePriceMinorMin, "Le prix ne peut pas être négatif.")
      .max(LIMITS.servicePriceMinorMax, "Le prix est trop élevé."),
  })
  .strict();

export const serviceUpdateSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, "Le nom du service est requis.")
      .max(LIMITS.serviceName, "Le nom du service est trop long.")
      .optional(),
    description: z
      .string()
      .trim()
      .max(LIMITS.serviceDescription, "La description du service est trop longue.")
      .nullable()
      .optional()
      .transform((value) => (value === "" ? null : value)),
    durationMinutes: z
      .number()
      .int("La durée doit être un entier.")
      .min(LIMITS.serviceDurationMin, "La durée doit être supérieure à 0.")
      .max(
        LIMITS.serviceDurationMax,
        `La durée ne peut pas dépasser ${LIMITS.serviceDurationMax} minutes.`,
      )
      .optional(),
    priceMinor: z
      .number()
      .int("Le prix doit être un entier (unités mineures).")
      .min(LIMITS.servicePriceMinorMin, "Le prix ne peut pas être négatif.")
      .max(LIMITS.servicePriceMinorMax, "Le prix est trop élevé.")
      .optional(),
    isActive: z.boolean().optional(),
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, {
    message: "La modification est vide.",
    path: ["body"],
  });

export type ProfileInput = z.infer<typeof profileSchema>;
export type ServiceCreateInput = z.infer<typeof serviceCreateSchema>;
export type ServiceUpdateInput = z.infer<typeof serviceUpdateSchema>;
