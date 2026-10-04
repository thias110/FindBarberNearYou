import { z } from "zod";
import {
  AUDIENCES,
  LIMITS,
  SEARCH_LIMITS,
  SERVICE_PLACES,
  SUPPORTED_CURRENCIES,
  TECHNIQUES,
} from "../constants";
import { isCountryCode } from "../countries";
import { compareCalendarDates, inclusiveDayCount, isValidCalendarDate } from "../dates";
import { classifyIanaTimeZone } from "../timezones";
import { safeText } from "./safeText";

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

// --- Lieux de prestation (lot 8, issue #19) ---
// Au moins un mode par profil, valeurs connues uniquement, dédupliquées, ordre
// d'entrée préservé. Remplacement complet lors d'un PUT (remplace le Set en
// transaction), comme les catégories de prestation.
const placeListSchema = z
  .array(z.string().trim().toUpperCase())
  .transform((values) => Array.from(new Set(values)))
  .pipe(
    z
      .array(z.enum(SERVICE_PLACES))
      .min(1, "Sélectionnez au moins un lieu de prestation.")
      .max(SERVICE_PLACES.length),
  );

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
    displayName: safeText(
      LIMITS.profileDisplayName,
      "Le nom affiché est trop long.",
    ).min(1, "Le nom affiché est requis."),
    description: safeText(
      LIMITS.profileDescription,
      "La description est trop longue.",
    ).min(1, "La description est requise."),
    // Adresse privée facultative. Vide → null. Requise par la règle
    // conditionnelle ci-dessous si SALON ou AT_PROVIDER est sélectionné.
    address: safeText(LIMITS.profileAddress, "L'adresse est trop longue.")
      .nullish()
      .transform((value) => (value ? value : null)),
    city: safeText(LIMITS.profileCity, "La ville est trop longue.").min(
      1,
      "La ville est requise.",
    ),
    postalCode: safeText(
      LIMITS.profilePostalCode,
      "Le code postal est trop long.",
    )
      .nullish()
      .transform((value) => (value ? value : null)),
    countryCode: countryCodeSchema,
    latitude: latitudeSchema,
    longitude: longitudeSchema,
    currency: currencySchema,
    timezone: timezoneSchema,
    // Rayon d'intervention mobile (km) : requis si AT_CLIENT, interdit sinon.
    // Le client envoie explicitement `null` hors AT_CLIENT ; le serveur rejette
    // un rayon non nul (superRefine ci-dessous).
    travelRadiusKm: z
      .number()
      .int("Le rayon doit être un entier.")
      .min(
        LIMITS.travelRadiusKmMin,
        `Le rayon doit être supérieur ou égal à ${LIMITS.travelRadiusKmMin} km.`,
      )
      .max(
        LIMITS.travelRadiusKmMax,
        `Le rayon ne peut pas dépasser ${LIMITS.travelRadiusKmMax} km.`,
      )
      .nullish()
      .transform((value) => (value === undefined || value === null ? null : value)),
    places: placeListSchema,
  })
  .strict()
  .superRefine((data, ctx) => {
    const requiresAddress =
      data.places.includes("SALON") || data.places.includes("AT_PROVIDER");
    const isMobile = data.places.includes("AT_CLIENT");

    if (requiresAddress && data.address === null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "Une adresse est requise pour un lieu en salon ou chez le professionnel.",
        path: ["address"],
      });
    }
    if (isMobile && data.travelRadiusKm === null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "Un rayon d'intervention est requis pour les prestations chez le client.",
        path: ["travelRadiusKm"],
      });
    }
    if (!isMobile && data.travelRadiusKm !== null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "Le rayon d'intervention n'est autorisé que pour les prestations chez le client.",
        path: ["travelRadiusKm"],
      });
    }
  });

export const serviceCreateSchema = z
  .object({
    name: safeText(LIMITS.serviceName, "Le nom du service est trop long.").min(
      1,
      "Le nom du service est requis.",
    ),
    description: safeText(
      LIMITS.serviceDescription,
      "La description du service est trop longue.",
    )
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
    name: safeText(LIMITS.serviceName, "Le nom du service est trop long.")
      .min(1, "Le nom du service est requis.")
      .optional(),
    description: safeText(
      LIMITS.serviceDescription,
      "La description du service est trop longue.",
    )
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
export function integerParam(min: number, max: number, defaultValue?: number) {
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
    place: z.preprocess(normalizeFilter, z.enum(SERVICE_PLACES).optional()),
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

// --- Indisponibilités / fermetures exceptionnelles (lot 7, issue #22) ---
// Fermetures en journées entières : `startDate` et `endDate` sont des dates
// civiles réelles `AAAA-MM-JJ`, bornes incluses. Le motif est facultatif,
// trimé, vide → null, privé. La période est bornée à `timeOffMaxRangeDays`
// jours inclus ; le plafond total est vérifié côté service. Les dates passées
// sont autorisées. Aucune conversion de fuseau, aucune dépendance au DST.
const calendarDateSchema = z
  .string()
  .trim()
  .refine(
    isValidCalendarDate,
    "Date invalide : format AAAA-MM-JJ et date calendaire réelle attendus.",
  );

export const timeOffCreateSchema = z
  .object({
    startDate: calendarDateSchema,
    endDate: calendarDateSchema,
    reason: safeText(
      LIMITS.timeOffReason,
      `Le motif ne peut pas dépasser ${LIMITS.timeOffReason} caractères.`,
    )
      .nullish()
      .transform((value) => {
        if (value === undefined || value === null) return null;
        return value.length > 0 ? value : null;
      }),
  })
  .strict()
  .superRefine((data, ctx) => {
    // Les deux dates ont déjà été validées par `calendarDateSchema` : si l'une
    // est invalide, l'issue de champ suffit, on n'ajoute pas d'issue de plage.
    if (!isValidCalendarDate(data.startDate) || !isValidCalendarDate(data.endDate)) {
      return;
    }
    if (compareCalendarDates(data.startDate, data.endDate) > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "La date de fin doit être identique ou postérieure à la date de début.",
        path: ["endDate"],
      });
      return;
    }
    if (inclusiveDayCount(data.startDate, data.endDate) > LIMITS.timeOffMaxRangeDays) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `La période ne peut pas dépasser ${LIMITS.timeOffMaxRangeDays} jours inclus.`,
        path: ["endDate"],
      });
    }
  });

export type TimeOffCreateInput = z.infer<typeof timeOffCreateSchema>;
