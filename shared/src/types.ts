import type {
  Audience,
  Currency,
  ROLES,
  ServicePlace,
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

// Réponse publique : liste blanche stricte (aucun email, hash, userId interne,
// adresse privée). Depuis le lot 8 (issue #19), l'adresse exacte est retirée du
// contrat public et les coordonnées sont **approximatives** (arrondies à deux
// décimales côté serveur) : la localisation publique est distincte de l'adresse
// exacte de rendez-vous.
export interface PublicBarberProfile {
  id: string;
  displayName: string;
  description: string;
  city: string;
  postalCode: string | null;
  countryCode: CountryCode;
  latitude: number;
  longitude: number;
  currency: Currency;
  places: ServicePlace[];
  createdAt: string;
}

// Réponse privée (propriétaire) : mêmes champs + adresse privée exacte,
// coordonnées exactes, fuseau et rayon d'intervention. Seul le propriétaire
// authentifié reçoit cette vue.
export interface OwnBarberProfile extends PublicBarberProfile {
  address: string | null;
  timezone: string | null;
  travelRadiusKm: number | null;
  updatedAt: string;
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
  places: ServicePlace[];
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

// --- Indisponibilités / fermetures exceptionnelles (lot 7, issue #22) ---
// Journées entières civiles, bornes incluses, format `AAAA-MM-JJ`, sans fuseau.
// `reason` est privé (jamais exposé par le profil public ni la recherche).
export interface TimeOff {
  id: string;
  startDate: string;
  endDate: string;
  reason: string | null;
}

export interface TimeOffResponse {
  timeOff: TimeOff[];
}
