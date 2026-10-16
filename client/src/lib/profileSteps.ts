import type { ServicePlace } from "@findbarber/shared/constants";
import type { CountryCode } from "@findbarber/shared/countries";
import type { OwnBarberProfile } from "@findbarber/shared/types";
import { profileSchema, type ProfileRequest } from "@findbarber/shared/validation";

// --- Formulaire de profil barber en étapes (issue #43) ---
// Les règles de validation restent celles du schéma partagé `profileSchema`
// (inchangé côté serveur) : chaque étape est validée avec ce même schéma, en
// complétant les étapes suivantes par des valeurs neutres valides, puis seules
// les erreurs des champs déjà présentés sont retenues.

export interface ProfileFormState {
  displayName: string;
  description: string;
  address: string;
  city: string;
  postalCode: string;
  countryCode: string;
  latitude: string;
  longitude: string;
  timezone: string;
  places: ServicePlace[];
  travelRadiusKm: string;
}

export type ProfileField = keyof ProfileFormState;
export type ProfileErrors = Partial<Record<ProfileField, string>>;

export const EMPTY_PROFILE_FORM: ProfileFormState = {
  displayName: "",
  description: "",
  address: "",
  city: "",
  postalCode: "",
  countryCode: "CH",
  latitude: "",
  longitude: "",
  timezone: "",
  places: [],
  travelRadiusKm: "",
};

export const PROFILE_STEPS = [
  {
    key: "identity",
    anchor: "identite",
    title: "Identité",
    fields: ["displayName", "description"],
  },
  {
    key: "places",
    anchor: "lieux",
    title: "Lieux de prestation",
    fields: ["places", "address", "travelRadiusKm"],
  },
  {
    key: "location",
    anchor: "localisation",
    title: "Localisation",
    fields: ["city", "postalCode", "countryCode", "latitude", "longitude"],
  },
  {
    key: "timezone",
    anchor: "fuseau",
    title: "Fuseau horaire",
    fields: ["timezone"],
  },
] as const satisfies readonly {
  key: string;
  anchor: string;
  title: string;
  fields: readonly ProfileField[];
}[];

export const PROFILE_STEP_COUNT = PROFILE_STEPS.length;

// Ancres historiques du formulaire d'un seul bloc (issue #56) encore valides.
const LEGACY_ANCHORS: Record<string, string> = { "devise-fuseau": "fuseau" };

/** Étape visée par une ancre d'URL (`#localisation`), ou -1. */
export function stepFromHash(hash: string): number {
  const raw = decodeURIComponent(hash.replace(/^#/, ""));
  const anchor = LEGACY_ANCHORS[raw] ?? raw;
  return PROFILE_STEPS.findIndex((step) => step.anchor === anchor);
}

// Valeurs neutres et valides des étapes pas encore présentées : elles ne sont
// jamais envoyées, elles permettent seulement d'évaluer les règles croisées
// (adresse requise, rayon) d'une étape avec le schéma complet.
const FILLER: ProfileFormState = {
  displayName: "x",
  description: "x",
  address: "",
  city: "x",
  postalCode: "",
  countryCode: "CH",
  latitude: "0",
  longitude: "0",
  timezone: "",
  places: ["AT_CLIENT"],
  travelRadiusKm: "10",
};

// Position (issue #45) : plus de champ latitude/longitude, le barber choisit
// une adresse ou clique sur la carte. Message unique sous le sélecteur.
const POSITION_MESSAGE =
  "Indiquez votre position : choisissez une adresse suggérée ou cliquez sur la carte.";

const NUMBER_MESSAGES: Partial<Record<ProfileField, string>> = {
  latitude: POSITION_MESSAGE,
  longitude: POSITION_MESSAGE,
  travelRadiusKm: "Le rayon d'intervention doit être un nombre entier de kilomètres.",
};

// "" → NaN (et non 0) pour qu'un champ vide soit refusé ; virgule décimale tolérée.
function parseNumber(value: string): number {
  const trimmed = value.trim();
  return trimmed === "" ? Number.NaN : Number(trimmed.replace(",", "."));
}

export function fromProfile(profile: OwnBarberProfile): ProfileFormState {
  return {
    displayName: profile.displayName,
    description: profile.description,
    address: profile.address ?? "",
    city: profile.city,
    postalCode: profile.postalCode ?? "",
    countryCode: profile.countryCode,
    latitude: String(profile.latitude),
    longitude: String(profile.longitude),
    timezone: profile.timezone ?? "",
    places: profile.places,
    travelRadiusKm:
      profile.travelRadiusKm === null ? "" : String(profile.travelRadiusKm),
  };
}

export function toProfileRequest(form: ProfileFormState): ProfileRequest {
  const isMobile = form.places.includes("AT_CLIENT");
  return {
    displayName: form.displayName,
    description: form.description,
    address: form.address.trim() === "" ? null : form.address.trim(),
    city: form.city,
    postalCode: form.postalCode.trim() ? form.postalCode.trim() : null,
    countryCode: form.countryCode as CountryCode,
    latitude: parseNumber(form.latitude),
    longitude: parseNumber(form.longitude),
    // "" = « Non renseigné » : effacement explicite (null). Sinon le fuseau
    // choisi est envoyé tel quel, validé côté serveur.
    timezone: form.timezone.trim() === "" ? null : form.timezone,
    // Hors AT_CLIENT, le client envoie explicitement null (règle serveur).
    travelRadiusKm:
      isMobile && form.travelRadiusKm.trim() !== ""
        ? parseNumber(form.travelRadiusKm)
        : null,
    places: form.places,
  };
}

function fieldsUpTo(stepIndex: number): Set<ProfileField> {
  return new Set(
    PROFILE_STEPS.slice(0, stepIndex + 1).flatMap((step) => step.fields),
  );
}

/**
 * Valide les étapes 0..stepIndex avec le schéma partagé. Renvoie un message par
 * champ en erreur (le premier rencontré), vide si l'étape est valide.
 */
export function validateProfileSteps(
  form: ProfileFormState,
  stepIndex: number,
): ProfileErrors {
  const visible = fieldsUpTo(stepIndex);
  const merged = { ...FILLER };
  for (const field of visible) {
    (merged as Record<ProfileField, unknown>)[field] = form[field];
  }

  const errors: ProfileErrors = {};
  const result = profileSchema.safeParse(toProfileRequest(merged));
  if (!result.success) {
    for (const issue of result.error.issues) {
      const field = issue.path[0] as ProfileField;
      if (!visible.has(field) || errors[field]) continue;
      const value = merged[field];
      errors[field] =
        NUMBER_MESSAGES[field] && typeof value === "string" && !Number.isFinite(parseNumber(value))
          ? NUMBER_MESSAGES[field]
          : issue.message;
    }
  }
  return errors;
}

/** Première étape contenant un champ en erreur, ou -1. */
export function firstStepWithError(errors: ProfileErrors): number {
  return PROFILE_STEPS.findIndex((step) =>
    step.fields.some((field) => errors[field as ProfileField]),
  );
}

/** Champs du formulaire, pour rattacher les erreurs du serveur (issue #57). */
export const PROFILE_FIELDS: readonly ProfileField[] = PROFILE_STEPS.flatMap(
  (step) => step.fields,
);

/** Position choisie (adresse ou clic sur la carte), ou null si absente. */
export function positionOf(
  form: ProfileFormState,
): { latitude: number; longitude: number } | null {
  const latitude = parseNumber(form.latitude);
  const longitude = parseNumber(form.longitude);
  return Number.isFinite(latitude) && Number.isFinite(longitude)
    ? { latitude, longitude }
    : null;
}

// --- Brouillon local (création uniquement) ---
// Les étapes validées d'un nouveau profil sont conservées dans le navigateur,
// par utilisateur, pour survivre à un rechargement. Effacé après création.
// Accès protégés : stockage indisponible (mode privé) = pas de brouillon.

export interface ProfileDraft {
  form: ProfileFormState;
  step: number;
}

function draftKey(userId: string): string {
  return `fb-barber-profile-draft:${userId}`;
}

export function loadProfileDraft(userId: string): ProfileDraft | null {
  try {
    const raw = window.localStorage.getItem(draftKey(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<ProfileDraft>;
    if (!parsed.form || typeof parsed.step !== "number") return null;
    return {
      form: { ...EMPTY_PROFILE_FORM, ...parsed.form },
      step: Math.min(Math.max(0, Math.trunc(parsed.step)), PROFILE_STEP_COUNT - 1),
    };
  } catch {
    return null;
  }
}

export function saveProfileDraft(userId: string, draft: ProfileDraft): void {
  try {
    window.localStorage.setItem(draftKey(userId), JSON.stringify(draft));
  } catch {
    // Stockage indisponible : le brouillon n'est simplement pas conservé.
  }
}

export function clearProfileDraft(userId: string): void {
  try {
    window.localStorage.removeItem(draftKey(userId));
  } catch {
    // Rien à nettoyer.
  }
}
