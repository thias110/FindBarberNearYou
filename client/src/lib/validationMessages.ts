import { LIMITS, STATS_LIMITS, type Weekday } from "@findbarber/shared/constants";
import {
  PASSWORD_MAX_BYTES,
  PASSWORD_MIN_LENGTH,
  SLOTS_RANGE_MAX_DAYS,
} from "@findbarber/shared/validation";
import i18n from "../i18n";
import { label } from "./labels";

// Messages des schémas Zod partagés (shared/src/validation) traduits côté
// client, espace `validation`. Les schémas et le serveur gardent leurs textes
// d'origine (référence des tests serveur) ; l'interface les reconnaît ici,
// qu'ils viennent d'une validation locale (`issue.message`) ou d'un 400
// VALIDATION_ERROR (`fields[].message`). Un message inconnu reste tel quel.

type Params = Record<string, string | number>;

// Message source exact → clé (et valeurs interpolées). Les messages construits
// avec des constantes reprennent les mêmes constantes : le texte est identique
// à l'exécution.
const EXACT: ReadonlyArray<readonly [source: string, key: string, params?: Params]> = [
  // Commun à plusieurs schémas
  ["Caractères de contrôle interdits.", "common.controlChars"],
  ["Code pays invalide.", "common.countryCodeInvalid"],
  [
    "Date invalide : format AAAA-MM-JJ et date calendaire réelle attendus.",
    "common.dateInvalid",
  ],
  ["Identifiant requis.", "common.idRequired"],
  ["Identifiant trop long.", "common.idTooLong"],
  ["L'adresse est trop longue.", "common.addressTooLong"],

  // Authentification
  ["Invalid email address.", "auth.emailInvalid"],
  ["Email is too long.", "auth.emailTooLong"],
  [
    `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`,
    "auth.passwordTooShort",
    { min: PASSWORD_MIN_LENGTH },
  ],
  ["Password is too long.", "auth.passwordTooLong"],
  [
    `Password must not exceed ${PASSWORD_MAX_BYTES} bytes (bcrypt limit).`,
    "auth.passwordTooManyBytes",
    { max: PASSWORD_MAX_BYTES },
  ],
  ["Name is too long.", "auth.nameTooLong"],
  ["Name cannot be empty.", "auth.nameRequired"],
  ["Password is required.", "auth.passwordRequired"],
  ["Token is required.", "auth.tokenRequired"],
  ["Token is too long.", "auth.tokenTooLong"],

  // Profil professionnel
  ["Sélectionnez au moins un lieu de prestation.", "profile.placesRequired"],
  ["La latitude doit être un nombre fini.", "profile.latitudeNotFinite"],
  ["La latitude doit être comprise entre -90 et 90.", "profile.latitudeRange"],
  ["La longitude doit être un nombre fini.", "profile.longitudeNotFinite"],
  ["La longitude doit être comprise entre -180 et 180.", "profile.longitudeRange"],
  ["Le fuseau horaire est trop long.", "profile.timezoneTooLong"],
  [
    "Fuseau horaire invalide : identifiant IANA attendu (ex. Europe/Zurich ou UTC).",
    "profile.timezoneInvalid",
  ],
  [
    "Ce fuseau à offset fixe (Etc/…) n'est pas accepté. Choisissez un fuseau géographique, ex. Europe/Zurich.",
    "profile.timezoneRestricted",
  ],
  ["Le nom affiché est trop long.", "profile.displayNameTooLong"],
  ["Le nom affiché est requis.", "profile.displayNameRequired"],
  ["La description est trop longue.", "profile.descriptionTooLong"],
  ["La description est requise.", "profile.descriptionRequired"],
  ["La ville est trop longue.", "profile.cityTooLong"],
  ["La ville est requise.", "profile.cityRequired"],
  ["Le code postal est trop long.", "profile.postalCodeTooLong"],
  ["Le rayon doit être un entier.", "profile.radiusInteger"],
  [
    `Le rayon doit être supérieur ou égal à ${LIMITS.travelRadiusKmMin} km.`,
    "profile.radiusMin",
    { min: LIMITS.travelRadiusKmMin },
  ],
  [
    `Le rayon ne peut pas dépasser ${LIMITS.travelRadiusKmMax} km.`,
    "profile.radiusMax",
    { max: LIMITS.travelRadiusKmMax },
  ],
  [
    "La devise est déduite du pays du profil et ne peut pas être choisie.",
    "profile.currencyDerived",
  ],
  [
    "Une adresse est requise pour un lieu en salon ou chez le professionnel.",
    "profile.addressRequired",
  ],
  [
    "Un rayon d'intervention est requis pour les prestations chez le client.",
    "profile.radiusRequired",
  ],
  [
    "Le rayon d'intervention n'est autorisé que pour les prestations chez le client.",
    "profile.radiusNotAllowed",
  ],

  // Prestations
  ["Le nom du service est trop long.", "service.nameTooLong"],
  ["Le nom du service est requis.", "service.nameRequired"],
  ["La description du service est trop longue.", "service.descriptionTooLong"],
  ["La durée doit être un entier.", "service.durationInteger"],
  ["La durée doit être supérieure à 0.", "service.durationMin"],
  [
    `La durée ne peut pas dépasser ${LIMITS.serviceDurationMax} minutes.`,
    "service.durationMax",
    { max: LIMITS.serviceDurationMax },
  ],
  ["Le prix doit être un entier (unités mineures).", "service.priceInteger"],
  ["Le prix ne peut pas être négatif.", "service.priceNegative"],
  ["Le prix est trop élevé.", "service.priceTooHigh"],
  ["La modification est vide.", "service.emptyUpdate"],

  // Recherche publique (paramètres d'API)
  ["Le prix maximum doit préciser une devise.", "search.maxPriceCurrency"],
  [
    "La zone doit préciser minLat, maxLat, minLng et maxLng.",
    "search.boundsIncomplete",
  ],
  ["minLat doit être inférieure ou égale à maxLat.", "search.latitudeOrder"],
  ["minLng doit être inférieure ou égale à maxLng.", "search.longitudeOrder"],

  // Autocomplétion d'adresse
  ["Saisissez au moins 3 caractères.", "addressSuggestions.queryTooShort"],
  ["La recherche est trop longue.", "addressSuggestions.queryTooLong"],
  ["Saisissez au moins 2 caractères.", "addressSuggestions.placeQueryTooShort"],

  // Horaires
  ["Le jour doit être un entier.", "workingHours.weekdayInteger"],
  [
    "Le jour doit être compris entre 1 (lundi) et 7 (dimanche).",
    "workingHours.weekdayRange",
  ],
  ["L'heure de début doit être un entier.", "workingHours.startInteger"],
  ["L'heure de début ne peut pas être avant 00:00.", "workingHours.startMin"],
  ["L'heure de début ne peut pas être après 23:59.", "workingHours.startMax"],
  ["L'heure de fin doit être un entier.", "workingHours.endInteger"],
  ["L'heure de fin ne peut pas être avant 00:01.", "workingHours.endMin"],
  ["L'heure de fin ne peut pas dépasser 24:00.", "workingHours.endMax"],
  [
    "La fin doit être après le début (aucune plage ne traverse minuit).",
    "workingHours.endBeforeStart",
  ],
  [
    `Le planning ne peut pas dépasser ${LIMITS.workingHoursMaxIntervals} plages.`,
    "workingHours.tooManyIntervals",
    { max: LIMITS.workingHoursMaxIntervals },
  ],

  // Fermetures
  [
    `Le motif ne peut pas dépasser ${LIMITS.timeOffReason} caractères.`,
    "timeOff.reasonTooLong",
    { max: LIMITS.timeOffReason },
  ],
  [
    "La date de fin doit être identique ou postérieure à la date de début.",
    "timeOff.endBeforeStart",
  ],
  [
    `La période ne peut pas dépasser ${LIMITS.timeOffMaxRangeDays} jours inclus.`,
    "timeOff.rangeTooLong",
    { max: LIMITS.timeOffMaxRangeDays },
  ],

  // Réservations
  ["L'adresse est requise.", "booking.addressRequired"],
  ["La minute de début doit être un entier.", "booking.startMinuteInteger"],
  ["La minute de début ne peut pas être négative.", "booking.startMinuteNegative"],
  ["La minute de début ne peut pas dépasser 23:59.", "booking.startMinuteMax"],
  [
    "Une adresse est requise pour une prestation chez le client.",
    "booking.clientAddressRequired",
  ],
  [
    "L'adresse client n'est autorisée que pour une prestation chez le client (AT_CLIENT).",
    "booking.clientAddressNotAllowed",
  ],
  ["Le motif est trop long.", "booking.declineReasonTooLong"],
  // Créneaux sur une plage de jours (lot N2)
  ["Le nombre de jours doit être un entier.", "booking.daysInteger"],
  ["Au moins un jour.", "booking.daysMin"],
  [
    `Au plus ${SLOTS_RANGE_MAX_DAYS} jours.`,
    "booking.daysMax",
    { max: SLOTS_RANGE_MAX_DAYS },
  ],

  // Galerie
  ["La légende est trop longue.", "gallery.captionTooLong"],

  // Avis
  ["La note doit être un entier.", "review.ratingInteger"],
  ["La note doit être comprise entre 1 et 5.", "review.ratingRange"],
  [
    `Le commentaire ne peut pas dépasser ${LIMITS.reviewComment} caractères.`,
    "review.commentTooLong",
    { max: LIMITS.reviewComment },
  ],

  // Statistiques (paramètres d'API)
  ["from et to ne sont autorisés qu'avec range=custom.", "stats.fromToNotAllowed"],
  ["from est requis avec range=custom.", "stats.fromRequired"],
  ["to est requis avec range=custom.", "stats.toRequired"],
  ["from doit être une date AAAA-MM-JJ valide.", "stats.fromInvalid"],
  ["to doit être une date AAAA-MM-JJ valide.", "stats.toInvalid"],
  ["from doit être antérieur ou égal à to.", "stats.fromAfterTo"],
  [
    `La plage ne peut pas dépasser ${STATS_LIMITS.maxRangeDays} jours.`,
    "stats.rangeTooLong",
    { max: STATS_LIMITS.maxRangeDays },
  ],
];

const BY_SOURCE = new Map(
  EXACT.map(([source, key, params]) => [source, { key, params }]),
);

// Messages qui contiennent une valeur variable (le jour de la semaine) : la
// valeur capturée est passée en interpolation. Le jour s'affiche par son nom
// dans la langue courante, calculé à l'appel.
const PATTERNS: ReadonlyArray<{
  pattern: RegExp;
  key: string;
  params: (match: RegExpMatchArray) => Params;
}> = [
  {
    pattern: new RegExp(
      `^Jour ([1-7]) : plus de ${LIMITS.workingHoursMaxIntervalsPerDay} plages\\.$`,
    ),
    key: "workingHours.tooManyPerDay",
    params: (match) => ({
      day: label("weekday", Number(match[1]) as Weekday),
      max: LIMITS.workingHoursMaxIntervalsPerDay,
    }),
  },
  {
    pattern: /^Jour ([1-7]) : plages qui se chevauchent\.$/,
    key: "workingHours.overlap",
    params: (match) => ({ day: label("weekday", Number(match[1]) as Weekday) }),
  },
];

/** Vrai si le message d'origine est reconnu par la table (exact ou motif). */
export function isKnownValidationMessage(message: string): boolean {
  return (
    BY_SOURCE.has(message) || PATTERNS.some(({ pattern }) => pattern.test(message))
  );
}

/**
 * Traduit un message de validation Zod partagé dans la langue courante. Un
 * message inconnu (nouveau message, texte libre du serveur) est renvoyé tel
 * quel.
 */
export function translateValidationMessage(message: string): string {
  const exact = BY_SOURCE.get(message);
  if (exact) return i18n.t(`validation:${exact.key}`, exact.params ?? {});
  for (const { pattern, key, params } of PATTERNS) {
    const match = message.match(pattern);
    if (match) return i18n.t(`validation:${key}`, params(match));
  }
  return message;
}
