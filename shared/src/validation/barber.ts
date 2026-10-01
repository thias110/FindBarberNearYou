import { z } from "zod";
import {
  AUDIENCES,
  LIMITS,
  SEARCH_LIMITS,
  SUPPORTED_CURRENCIES,
  TECHNIQUES,
} from "../constants";
import { isCountryCode } from "../countries";
import { classifyIanaTimeZone } from "../timezones";

const currencySchema = z.enum(SUPPORTED_CURRENCIES);

const countryCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .refine(isCountryCode, "Code pays invalide.");

// --- Catalogues de prestations ---
// Chaque élément est trim + majuscules, puis dédupliqué (Set) et enfin validé
// contre l'énumération partagée. L'ordre de l'entrée est préservé.
const audienceListSchema = z
  .array(z.string().trim().toUpperCase())
  .transform((values) => Array.from(new Set(values)))
  .pipe(z.array(z.enum(AUDIENCES)).max(AUDIENCES.length));

const techniqueListSchema = z
  .array(z.string().trim().toUpperCase())
  .transform((values) => Array.from(new Set(values)))
  .pipe(z.array(z.enum(TECHNIQUES)).max(TECHNIQUES.length));

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

// --- Fuseau horaire du salon (lot 6A) ---
// Trois états, dans cet ordre : absent = inchangé ; null ou vide après trim =
// effacement explicite ; valeur non vide = identifiant IANA validé. Une valeur
// invalide (offset, abréviation, nom inconnu) ou restreinte (Etc/…) fait
// échouer le parse : elle n'est jamais convertie silencieusement en null.
export const timezoneSchema = z
  .union([
    z
      .string()
      .trim()
      .max(LIMITS.profileTimezone, "Le fuseau horaire est trop long."),
    z.null(),
  ])
  .optional()
  .superRefine((value, ctx) => {
    if (value === undefined || value === null) return;
    const parsed = classifyIanaTimeZone(value);
    if (parsed.kind === "invalid") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "Fuseau horaire invalide : identifiant IANA attendu (ex. Europe/Zurich ou UTC).",
      });
    } else if (parsed.kind === "restricted") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "Ce fuseau à offset fixe (Etc/…) n'est pas accepté. Choisissez un fuseau géographique, ex. Europe/Zurich.",
      });
    }
  })
  .transform((value) => {
    if (value === undefined) return undefined;
    if (value === null) return null;
    const parsed = classifyIanaTimeZone(value);
    if (parsed.kind === "empty") return null;
    // Invalide/restreint : le parse global échoue déjà, la valeur n'est donc
    // jamais persistée. Le null renvoyé ici ne satisfait que le typage.
    return parsed.kind === "valid" ? parsed.value : null;
  });

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
    timezone: timezoneSchema,
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
    // À la création, catégories absentes → tableaux vides (compatibilité).
    audiences: audienceListSchema.optional().default([]),
    techniques: techniqueListSchema.optional().default([]),
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
    // Dans un PATCH : absent → aucune modification ; [] → suppression ;
    // tableau renseigné → remplacement. Pas de default([]) ici.
    audiences: audienceListSchema.optional(),
    techniques: techniqueListSchema.optional(),
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

// --- Recherche publique ---
// Chaque paramètre de pagination doit être une chaîne unique AVANT coercition :
// les tableaux (paramètres répétés), objets et chaînes vides sont rejetés.
function integerParam(min: number, max: number, defaultValue?: number) {
  const base = z.number().int().min(min).max(max);
  const schema = defaultValue === undefined ? base : base.default(defaultValue);
  return z.preprocess((value) => {
    if (typeof value !== "string" || value.trim() === "") return value;
    return Number(value.trim());
  }, schema);
}

// Normalise trim + majuscules ; une chaîne vide devient undefined (ignorée).
// Une valeur non-chaîne (tableau/objet) est conservée pour être rejetée ensuite.
const normalizeFilter = (value: unknown) =>
  typeof value === "string" ? value.trim().toUpperCase() || undefined : value;

export const barberSearchQuerySchema = z
  .object({
    q: z
      .string()
      .trim()
      .max(LIMITS.profileDisplayName)
      .optional()
      .transform((value) => (value ? value : undefined)),
    city: z
      .string()
      .trim()
      .max(LIMITS.profileCity)
      .optional()
      .transform((value) => (value ? value : undefined)),
    countryCode: z.preprocess(
      normalizeFilter,
      z.string().refine(isCountryCode, "Code pays invalide.").optional(),
    ),
    audience: z.preprocess(normalizeFilter, z.enum(AUDIENCES).optional()),
    technique: z.preprocess(normalizeFilter, z.enum(TECHNIQUES).optional()),
    page: integerParam(
      SEARCH_LIMITS.pageDefault,
      SEARCH_LIMITS.pageMax,
      SEARCH_LIMITS.pageDefault,
    ),
    pageSize: integerParam(1, SEARCH_LIMITS.pageSizeMax, SEARCH_LIMITS.pageSizeDefault),
  })
  .strict();

export type BarberSearchQuery = z.infer<typeof barberSearchQuerySchema>;

// --- Horaires hebdomadaires (remplacement complet par PUT) ---
// Les heures sont des minutes murales locales (0..1439 pour un départ,
// 1..1440 pour une fin ; 1440 = 24:00). Refuse les doublons, les
// chevauchements stricts (les plages adjacentes sont autorisées) et les
// dépassements du nombre maximal de plages (par jour et au total).
export const workingHoursIntervalSchema = z
  .object({
    weekday: z
      .number()
      .int("Le jour doit être un entier.")
      .min(1, "Le jour doit être compris entre 1 (lundi) et 7 (dimanche).")
      .max(7, "Le jour doit être compris entre 1 (lundi) et 7 (dimanche)."),
    startMinute: z
      .number()
      .int("L'heure de début doit être un entier.")
      .min(
        LIMITS.workingHoursStartMin,
        "L'heure de début ne peut pas être avant 00:00.",
      )
      .max(
        LIMITS.workingHoursStartMax,
        "L'heure de début ne peut pas être après 23:59.",
      ),
    endMinute: z
      .number()
      .int("L'heure de fin doit être un entier.")
      .min(
        LIMITS.workingHoursEndMin,
        "L'heure de fin ne peut pas être avant 00:01.",
      )
      .max(
        LIMITS.workingHoursEndMax,
        "L'heure de fin ne peut pas dépasser 24:00.",
      ),
  })
  .strict()
  .refine((interval) => interval.startMinute < interval.endMinute, {
    message: "La fin doit être après le début (aucune plage ne traverse minuit).",
    path: ["endMinute"],
  });

export const workingHoursSchema = z
  .object({
    intervals: z
      .array(workingHoursIntervalSchema)
      .max(
        LIMITS.workingHoursMaxIntervals,
        `Le planning ne peut pas dépasser ${LIMITS.workingHoursMaxIntervals} plages.`,
      ),
  })
  .strict()
  .superRefine((payload, ctx) => {
    // Les indices d'origine dans le payload sont conservés dans `path` de
    // chaque issue (["intervals", index]) pour que le client rattache
    // l'erreur à la ligne concernée, même après tri par début.
    const byDay = new Map<
      number,
      { index: number; startMinute: number; endMinute: number }[]
    >();
    payload.intervals.forEach((interval, index) => {
      const list = byDay.get(interval.weekday) ?? [];
      list.push({
        index,
        startMinute: interval.startMinute,
        endMinute: interval.endMinute,
      });
      byDay.set(interval.weekday, list);
    });
    for (const [weekday, items] of byDay) {
      if (items.length > LIMITS.workingHoursMaxIntervalsPerDay) {
        for (const item of items.slice(LIMITS.workingHoursMaxIntervalsPerDay)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Jour ${weekday} : plus de ${LIMITS.workingHoursMaxIntervalsPerDay} plages.`,
            path: ["intervals", item.index],
          });
        }
        continue;
      }
      // Tri par début : un doublon exact ou un chevauchement strict se lit
      // par `début suivant < fin précédente`. L'issue est rattachée à
      // l'intervalle concerné par son index d'origine.
      const sorted = [...items].sort((a, b) => a.startMinute - b.startMinute);
      for (let position = 1; position < sorted.length; position++) {
        const current = sorted[position];
        const previous = sorted[position - 1];
        if (current.startMinute < previous.endMinute) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Jour ${weekday} : plages qui se chevauchent.`,
            path: ["intervals", current.index],
          });
        }
      }
    }
  });

export type WorkingHoursInput = z.infer<typeof workingHoursSchema>;
