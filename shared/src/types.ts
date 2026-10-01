import type {
  Audience,
  Currency,
  ROLES,
  Technique,
  USER_STATUSES,
  Weekday,
} from "./constants";
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

// Réponse privée (propriétaire) : mêmes champs + updatedAt + fuseau du salon.
export interface OwnBarberProfile extends PublicBarberProfile {
  updatedAt: string;
  timezone: string | null;
}

export interface PublicBarberService {
  id: string;
  name: string;
  description: string | null;
  durationMinutes: number;
  priceMinor: number;
  audiences: Audience[];
  techniques: Technique[];
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

// --- Recherche publique (lot 3, coordonnées lot 4) ---
// Whitelist stricte : aucun email, hash, userId interne, adresse, devise ni date.
// Les coordonnées sont volontairement exposées : ce sont celles du commerce, déjà
// publiques via le profil détaillé (`PublicBarberProfile`). Les tags proviennent
// exclusivement des services actifs.
export interface PublicBarberSearchItem {
  id: string;
  displayName: string;
  city: string;
  countryCode: CountryCode;
  latitude: number;
  longitude: number;
  activeServiceCount: number;
  audiences: Audience[];
  techniques: Technique[];
}

export interface BarbersSearchResponse {
  barbers: PublicBarberSearchItem[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

// --- Horaires hebdomadaires (lot 5) ---
// Une entrée = une plage de travail. Les trous entre plages d'un même jour
// sont des pauses implicites. Minutes depuis minuit local du salon.
// `endMinute` vaut au plus 1440 (24:00, fin de journée) ; aucun passage minuit.
export interface WorkingHoursInterval {
  id: string;
  weekday: Weekday;
  startMinute: number;
  endMinute: number;
}

export interface WorkingHoursResponse {
  intervals: WorkingHoursInterval[];
}
