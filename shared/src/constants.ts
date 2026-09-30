export const ROLES = ["CLIENT", "BARBER", "ADMIN"] as const;

export const USER_STATUSES = ["ACTIVE", "SUSPENDED"] as const;

export const ROLE_HOME = {
  CLIENT: "/",
  BARBER: "/pro/dashboard",
  ADMIN: "/admin",
} as const;

// Devises prises en charge dans ce lot. Une seule devise par profil, immuable
// après création. Les montants sont stockés en unités mineures entières.
export const SUPPORTED_CURRENCIES = ["CHF", "EUR", "USD"] as const;

export type Currency = (typeof SUPPORTED_CURRENCIES)[number];

export const DEFAULT_CURRENCY: Currency = "CHF";

export const CURRENCY_LABELS: Record<Currency, string> = {
  CHF: "Franc suisse (CHF)",
  EUR: "Euro (EUR)",
  USD: "Dollar américain (USD)",
};

// --- Catalogue des prestations (lot 3) ---
// Codes stables en majuscules, libellés français partagés. « Mixte » n'est pas
// un code stocké : il se calcule (FEMME + HOMME présents).
export const AUDIENCES = ["FEMME", "HOMME", "ENFANT"] as const;
export type Audience = (typeof AUDIENCES)[number];

export const AUDIENCE_LABELS: Record<Audience, string> = {
  FEMME: "Femme",
  HOMME: "Homme",
  ENFANT: "Enfant",
};

export const TECHNIQUES = [
  "COUPE",
  "TAPER",
  "DEGRADE",
  "LOCKS",
  "TRESSES",
  "COLORATION",
  "BARBE",
] as const;
export type Technique = (typeof TECHNIQUES)[number];

export const TECHNIQUE_LABELS: Record<Technique, string> = {
  COUPE: "Coupe",
  TAPER: "Taper",
  DEGRADE: "Dégradé",
  LOCKS: "Locks",
  TRESSES: "Tresses",
  COLORATION: "Coloration",
  BARBE: "Barbe",
};

// Limites de pagination de la recherche publique.
export const SEARCH_LIMITS = {
  pageDefault: 1,
  // Borne haute volontaire : évite un offset excessif (page * pageSize) tout en
  // laissant une marge très large (10 000 pages x 50 éléments max).
  pageMax: 10_000,
  pageSizeDefault: 12,
  pageSizeMax: 50,
} as const;

// Limites partagées (utilisées par Zod côté serveur et par les formulaires côté client).
export const LIMITS = {
  profileDisplayName: 120,
  profileDescription: 2000,
  profileAddress: 200,
  profileCity: 100,
  profilePostalCode: 20,
  serviceName: 120,
  serviceDescription: 1000,
  serviceDurationMin: 1,
  serviceDurationMax: 480,
  servicePriceMinorMin: 0,
  servicePriceMinorMax: 1_000_000,
} as const;
