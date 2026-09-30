import type { Currency, ROLES, USER_STATUSES } from "./constants";
import type { CountryCode } from "./countries";

export type Role = (typeof ROLES)[number];
export type UserStatus = (typeof USER_STATUSES)[number];

export interface PublicUser {
  id: string;
  email: string;
  role: Role;
  status: UserStatus;
  name: string | null;
  createdAt: string;
}

// --- Profils et services barbier ---

// Réponse publique : liste blanche stricte (aucun email, hash, userId interne).
export interface PublicBarberProfile {
  id: string;
  displayName: string;
  description: string;
  address: string;
  city: string;
  postalCode: string | null;
  countryCode: CountryCode;
  latitude: number;
  longitude: number;
  currency: Currency;
  createdAt: string;
}

// Réponse privée (propriétaire) : mêmes champs + updatedAt.
export interface OwnBarberProfile extends PublicBarberProfile {
  updatedAt: string;
}

export interface PublicBarberService {
  id: string;
  name: string;
  description: string | null;
  durationMinutes: number;
  priceMinor: number;
}

export interface OwnBarberService extends PublicBarberService {
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PublicBarberProfileWithServices {
  profile: PublicBarberProfile;
  services: PublicBarberService[];
}
