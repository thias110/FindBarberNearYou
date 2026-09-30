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
