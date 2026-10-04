export const ROLES = ["CLIENT", "BARBER", "ADMIN"] as const;

export const USER_STATUSES = ["ACTIVE", "SUSPENDED"] as const;

export const ROLE_HOME = {
  CLIENT: "/",
  BARBER: "/pro/dashboard",
  ADMIN: "/admin",
} as const;

// Libellés français partagés (interface d'administration, lot 3).
export const ROLE_LABELS: Record<(typeof ROLES)[number], string> = {
  CLIENT: "Client",
  BARBER: "Barbier",
  ADMIN: "Administrateur",
};

export const USER_STATUS_LABELS: Record<
  (typeof USER_STATUSES)[number],
  string
> = {
  ACTIVE: "Actif",
  SUSPENDED: "Suspendu",
};

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

// --- Lieux de prestation (lot 8, issue #19) ---
// Modes cumulables au niveau du profil (pas de mode par prestation dans ce lot).
// Codes stables en majuscules, libellés français partagés. `SALON` et
// `AT_PROVIDER` exigent une adresse privée ; `AT_CLIENT` exige un rayon
// d'intervention. Aucun libellé « domicile » ambigu : on distingue le domicile
// du professionnel (`AT_PROVIDER`) de celui du client (`AT_CLIENT`).
export const SERVICE_PLACES = ["SALON", "AT_PROVIDER", "AT_CLIENT"] as const;
export type ServicePlace = (typeof SERVICE_PLACES)[number];

export const SERVICE_PLACE_LABELS: Record<ServicePlace, string> = {
  SALON: "En salon",
  AT_PROVIDER: "Chez le professionnel",
  AT_CLIENT: "Chez le client",
};

// --- Réservations (lot 9) ---
// Enum complet des statuts dès maintenant ; seules les transitions
// PENDING→CONFIRMED (barber) et →CANCELLED sont câblées dans ce lot.
// `ACTIVE_BOOKING_STATUSES` = statuts qui bloquent un créneau.
export const BOOKING_STATUSES = [
  "PENDING",
  "CONFIRMED",
  "CANCELLED",
  "COMPLETED",
  "NO_SHOW",
] as const;
export type BookingStatus = (typeof BOOKING_STATUSES)[number];

export const BOOKING_STATUS_LABELS: Record<BookingStatus, string> = {
  PENDING: "En attente de confirmation",
  CONFIRMED: "Confirmée",
  CANCELLED: "Annulée",
  COMPLETED: "Terminée",
  NO_SHOW: "Absence",
};

export const ACTIVE_BOOKING_STATUSES = ["PENDING", "CONFIRMED"] as const;

// Mention obligatoire de l'arrondi des coordonnées publiques. Cet arrondi
// réduit la précision mais ne garantit pas l'anonymat.
export const APPROXIMATE_LOCATION_LABEL = "Localisation approximative";
export const APPROXIMATE_DISTANCE_LABEL = "Distance approximative";

// --- Jours de la semaine (ISO-8601 : 1 = lundi … 7 = dimanche) ---
// Codes entiers stockés en base, libellés français partagés côté client.
export const WEEKDAYS = [1, 2, 3, 4, 5, 6, 7] as const;
export type Weekday = (typeof WEEKDAYS)[number];

export const WEEKDAY_LABELS: Record<Weekday, string> = {
  1: "Lundi",
  2: "Mardi",
  3: "Mercredi",
  4: "Jeudi",
  5: "Vendredi",
  6: "Samedi",
  7: "Dimanche",
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

// Pagination des avis publics d'un professionnel (lot 11). Liste courte par
// défaut : le profil public reste léger ; la pagination complète est disponible
// via `page`/`pageSize`.
export const REVIEW_LIMITS = {
  pageDefault: 1,
  pageMax: 10_000,
  pageSizeDefault: 5,
  pageSizeMax: 20,
} as const;

// Limites partagées (utilisées par Zod côté serveur et par les formulaires côté client).
export const LIMITS = {
  profileDisplayName: 120,
  profileDescription: 2000,
  profileAddress: 200,
  profileCity: 100,
  profilePostalCode: 20,
  profileTimezone: 64,
  serviceName: 120,
  serviceDescription: 1000,
  serviceDurationMin: 1,
  serviceDurationMax: 480,
  servicePriceMinorMin: 0,
  servicePriceMinorMax: 1_000_000,
  // Horaires hebdomadaires : minutes depuis minuit local (heures murales du
  // salon, sans fuseau). 1440 = 24:00 (fin de journée, jamais un départ).
  workingHoursStartMin: 0,
  workingHoursStartMax: 1439,
  workingHoursEndMin: 1,
  workingHoursEndMax: 1440,
  workingHoursMaxIntervalsPerDay: 6,
  workingHoursMaxIntervals: 42, // 7 jours × 6 plages
  // Indisponibilités en journées entières (lot 7, issue #22) : motif privé
  // facultatif, période inclusive bornée et plafond total par professionnel.
  timeOffReason: 500,
  timeOffMaxRangeDays: 366,
  timeOffMaxPerBarber: 200,
  // Lieux de prestation (lot 8, issue #19) : rayon d'intervention mobile en
  // kilomètres, requis uniquement si `AT_CLIENT` est sélectionné.
  travelRadiusKmMin: 1,
  travelRadiusKmMax: 100,
  // Réservations (lot 9) : délai minimal avant le début, horizon de réservation
  // et délai limite d'annulation côté client. La grille de créneaux n'est PAS
  // fixe (pas de pas de 15 minutes) : elle suit la durée de la prestation.
  bookingLeadTimeMinutes: 30,
  bookingHorizonDays: 60,
  bookingClientCancelMinMinutes: 120,
  // Adresse client privée (lot 9 passe A, issue #19) : chaîne libre géocodée
  // côté serveur pour `AT_CLIENT`, jamais exposée publiquement.
  clientAddress: 200,
  // Avis post-rendez-vous (lot 11) : note entière 1..5 obligatoire et
  // commentaire public facultatif, trimé et borné. La note est aussi garantie
  // par un CHECK SQL en dernier ressort.
  reviewRatingMin: 1,
  reviewRatingMax: 5,
  reviewComment: 1000,
  // Uploads d'images (issue #8). Taille maximale du fichier source, dimensions
  // de réencodage WebP (avatar 512x512 crop cover, galerie 1600px max de large)
  // et limites de la galerie (nombre de photos, longueur de la légende).
  uploadMaxBytes: 5_242_880,
  avatarSizePx: 512,
  galleryMaxWidthPx: 1600,
  galleryMaxPhotos: 15,
  galleryCaption: 300,
} as const;

// Types MIME acceptés pour les uploads d'images (issue #8).
export const UPLOAD_IMAGE_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

// --- Statistiques d'activité du barber (issue #20) ---
// Plages prédéfinies du tableau de bord et bornes de la plage personnalisée.
export const STATS_RANGES = ["7d", "30d", "month", "custom"] as const;
export type StatsRange = (typeof STATS_RANGES)[number];
export const STATS_DEFAULT_RANGE: StatsRange = "30d";

export const STATS_LIMITS = {
  maxRangeDays: 366,
  topServicesLimit: 5,
} as const;

// --- Administration & modération (issue #7, LOT 1) ---
// `cancelled_by` utilisé lorsqu'une suspension administrateur annule les
// réservations futures d'un barber. Le champ reste un `text` (pas d'enum) dans
// le schéma : on partage la constante pour éviter les divergences.
export const CANCELLED_BY_ADMIN = "ADMIN" as const;

// Pagination des listes d'administration (users, bookings, reviews).
export const ADMIN_LIMITS = {
  pageDefault: 1,
  pageMax: 10_000,
  pageSizeDefault: 20,
  pageSizeMax: 100,
} as const;
