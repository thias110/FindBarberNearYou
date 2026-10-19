import type {
  Audience,
  AuditAction,
  BookingPaymentStatus,
  AuditTargetType,
  BookingStatus,
  Currency,
  Locale,
  ProfileCompletionStep,
  NotificationType,
  PaymentMode,
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
  // Langue de l'interface et des emails (issue #32).
  locale: Locale;
  // URL publique relative de l'avatar (`/uploads/avatars/<uuid>.webp`) ou null.
  avatarPath: string | null;
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
  // URL publique relative de l'avatar du professionnel (`/uploads/avatars/...`).
  avatarPath: string | null;
  // Paiement en ligne exigé à la réservation (issue #10).
  onlinePayment: { mode: PaymentMode; depositPercent: number };
  // Badge « Certifié » attribué par un ADMIN (issue #41).
  certified: boolean;
  createdAt: string;
}

// Réponse privée (propriétaire) : mêmes champs + adresse privée exacte,
// coordonnées exactes, fuseau et rayon d'intervention. Seul le propriétaire
// authentifié reçoit cette vue.
export interface OwnBarberProfile extends PublicBarberProfile {
  // Approbation par l'ADMIN (issue #40) : false = profil invisible du public.
  approved: boolean;
  address: string | null;
  timezone: string | null;
  travelRadiusKm: number | null;
  updatedAt: string;
}

// Suggestion d'adresse pour positionner le profil (issue #45). Coordonnées
// exactes : réservées au propriétaire, jamais publiées telles quelles.
export interface AddressSuggestion {
  label: string;
  latitude: number;
  longitude: number;
}

// Progression de finalisation du profil (issue #42), vue du propriétaire.
export interface ProfileCompletion {
  steps: { step: ProfileCompletionStep; done: boolean }[];
  completedCount: number;
  totalCount: number;
  // Pourcentage entier (0..100), arrondi à l'inférieur : 100 = profil complet.
  percent: number;
  complete: boolean;
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

// Horaires publics (lot N3) : plages de travail par jour, en heures locales du
// salon. Ni identifiant interne, ni absences, ni leur motif (privés).
export interface PublicWeeklyHours {
  intervals: { weekday: Weekday; startMinute: number; endMinute: number }[];
  // Jour courant dans le fuseau du salon, pour le mettre en avant ; null si le
  // barber n'a pas renseigné son fuseau.
  today: Weekday | null;
}

export interface PublicBarberProfileWithServices {
  profile: PublicBarberProfile;
  services: PublicBarberService[];
  weeklyHours: PublicWeeklyHours;
}

// --- Recherche publique (lot 3, coordonnées lot 4, agrégats issue #48) ---
// Whitelist stricte : aucun email, hash, userId interne, adresse exacte ni date.
// Les coordonnées sont volontairement exposées : ce sont celles du commerce, déjà
// publiques via le profil détaillé (`PublicBarberProfile`). Les tags proviennent
// exclusivement des services actifs. Photo, devise, prix « à partir de » et note
// sont déjà publics ailleurs (profil, services, avis) : ils sont ajoutés ici
// pour comparer les barbers sans ouvrir chaque profil.
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
  // URL publique relative de l'avatar, ou null.
  avatarPath: string | null;
  // Moyenne des avis publics (réservation terminée, non masqués), null sans avis.
  averageRating: number | null;
  reviewCount: number;
  // Prix minimum des services ACTIFS, en unités mineures ; null sans service actif.
  startingPriceMinor: number | null;
  currency: Currency;
  // Badge « Certifié » attribué par un ADMIN (issue #41).
  certified: boolean;
  // Disponibilité (lot N1) : premier créneau libre des 7 prochains jours du
  // salon (ISO UTC), toutes prestations actives confondues, sinon null ; et
  // créneau libre aujourd'hui (fuseau du salon). Indicatif : la réservation
  // recalcule toujours le créneau.
  nextAvailableAt: string | null;
  availableToday: boolean;
}

// Prestations populaires (issue #47) : uniquement l'ordre des techniques,
// sans compteur ni donnée de réservation individuelle.
export interface PopularTechniquesResponse {
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

// --- Réservations (lot 9) ---
// `startAt`/`endAt` sont des instants UTC (ISO 8601). Les snapshots figent le
// nom du professionnel, le nom/la description du service, la durée, le prix et
// la devise au moment de la réservation. L'adresse client n'est pas exposée
// dans ce lot.
export interface Booking {
  id: string;
  barberId: string;
  serviceId: string;
  barberDisplayName: string;
  serviceName: string;
  serviceDescription: string | null;
  durationMinutes: number;
  priceMinor: number;
  currency: Currency;
  servicePlace: ServicePlace;
  status: BookingStatus;
  startAt: string;
  endAt: string;
  clientName: string | null;
  // Indicateur léger uniquement (lot 11) : le commentaire et les détails d'un
  // éventuel avis ne sont JAMAIS embarqués dans les listes de réservations.
  hasReview: boolean;
  cancelledBy: string | null;
  cancelledAt: string | null;
  // Refus par le barber (lot 4 rouvert) : motif facultatif visible du client.
  declinedAt: string | null;
  declineReason: string | null;
  // Échéance d'une demande PENDING (24 h ou début du rendez-vous) ; null sinon.
  expiresAt: string | null;
  // Paiement en ligne (issue #10) : montant payé ou à payer en ligne (null si
  // paiement sur place) et lien Checkout tant que le paiement est attendu.
  paymentStatus: BookingPaymentStatus;
  amountDueMinor: number | null;
  checkoutUrl: string | null;
  createdAt: string;
}

// Réponse de création : `checkoutUrl` présent si le client doit payer en ligne.
export interface BookingCreateResponse {
  booking: Booking;
  checkoutUrl: string | null;
}

// Paiement en ligne côté barber (issue #10).
export interface BarberPaymentSettings {
  /** Stripe configuré sur la plateforme. */
  available: boolean;
  /** Compte Stripe Connect créé. */
  connected: boolean;
  /** Stripe autorise les encaissements (inscription terminée). */
  chargesEnabled: boolean;
  paymentMode: PaymentMode;
  depositPercent: number;
  platformFeePercent: number;
}

export interface BookingsResponse {
  bookings: Booking[];
}

// Détails privés d'une réservation (lot 9 passe A, issue #19). L'adresse et les
// coordonnées exactes du client ne sont exposées qu'au CLIENT propriétaire, au
// BARBER concerné et à ADMIN, via l'endpoint de détail uniquement. Jamais dans
// les listes ni dans les réponses publiques.
export interface BookingDetails extends Booking {
  clientAddress: string | null;
  clientLatitude: number | null;
  clientLongitude: number | null;
  // Itinéraire (lot N3) : adresse exacte du barber, donnée au SEUL client
  // propriétaire d'une réservation CONFIRMED au salon ou chez le professionnel.
  // null dans tous les autres cas (barber, admin, autre statut, à domicile).
  barberAddress: string | null;
}

export interface BookingSlotDto {
  startAt: string;
  endAt: string;
  startMinute: number;
}

export interface BookingSlotsResponse {
  slots: BookingSlotDto[];
}

// Créneaux sur une plage de jours (lot N2) : un jour par entrée, dans l'ordre,
// y compris les jours sans créneau (`slots` vide) pour que la grille de la
// semaine affiche tous les jours demandés. `date` : jour civil du salon.
export interface BookingSlotsDay {
  date: string;
  slots: BookingSlotDto[];
}

export interface BookingSlotsRangeResponse {
  days: BookingSlotsDay[];
}

// --- Avis post-rendez-vous (lot 11) ---
// Whitelist publique stricte : note, commentaire, date et nom public du client
// (users.name, nullable). Aucun email, hash, userId interne, adresse, identifiant
// de réservation ni coordonnées. `clientName` est le nom affiché de l'auteur,
// conformément à la convention déjà utilisée par `Booking.clientName`.
export interface PublicReview {
  id: string;
  rating: number;
  comment: string | null;
  createdAt: string;
  clientName: string | null;
}

export interface BarberReviewsSummary {
  averageRating: number | null;
  totalReviews: number;
}

export interface BarberReviewsResponse {
  summary: BarberReviewsSummary;
  reviews: PublicReview[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

// --- Notifications de réservation (MVP, lot notifications Mission A) ---
// DTO de lecture pour le destinataire uniquement. `actorUserId` n'est pas
// exposé (le type encode déjà l'acteur). `bookingId` permet le lien profond
// côté frontend ; le libellé d'affichage est dérivé du type + booking.
export interface Notification {
  id: string;
  type: NotificationType;
  bookingId: string | null;
  readAt: string | null;
  createdAt: string;
}

export interface NotificationsResponse {
  notifications: Notification[];
}

export interface UnreadCountResponse {
  count: number;
}

// --- Statistiques d'activité du barber (issue #20) ---
// Agrégats uniquement : aucune donnée personnelle de client. Les buckets sont
// complets (même à zéro) et ordonnés pour un rendu client stable. Les clés sont
// des codes stables (`YYYY-Www`, `YYYY-MM`, `1`..`7`, `0`..`23`) ; `label` est
// le libellé d'affichage français. Les taux sont des fractions 0..1.
export interface BarberStatsPeriod {
  from: string; // AAAA-MM-JJ (fuseau du barber)
  to: string; // AAAA-MM-JJ (fuseau du barber)
  timezone: string;
}

export interface BarberStatsTotals {
  bookings: number;
  completed: number;
  cancelled: number;
  refused: number; // CANCELLED + cancelledBy === "BARBER"
  revenueMinor: number; // COMPLETED uniquement
  noShows: number; // NO_SHOW (absence du client, lot N8)
}

export interface BarberStatsRates {
  cancellationRate: number; // 0..1
  refusalRate: number; // 0..1
  // Absences / (terminés + absences) ; null sans terminé ni absent (lot N8).
  noShowRate: number | null;
}

export interface BarberStatsBucket {
  key: string;
  label: string;
  count: number;
}

export interface BarberStatsRevenueBucket {
  key: string;
  label: string;
  revenueMinor: number;
}

export interface BarberStatsTopService {
  serviceName: string;
  count: number;
  revenueMinor: number;
}

export interface BarberStatsRating {
  averageRating: number | null;
  totalReviews: number;
}

export interface BarberStatsClients {
  newClients: number;
  returningClients: number;
}

export interface BarberStatsResponse {
  currency: Currency;
  period: BarberStatsPeriod;
  totals: BarberStatsTotals;
  rates: BarberStatsRates;
  appointmentsByWeek: BarberStatsBucket[];
  appointmentsByMonth: BarberStatsBucket[];
  revenueByMonth: BarberStatsRevenueBucket[];
  topServices: BarberStatsTopService[];
  busiestWeekdays: BarberStatsBucket[];
  busiestHours: BarberStatsBucket[];
  rating: BarberStatsRating;
  clients: BarberStatsClients;
}

// --- Administration & modération (issue #7, LOT 1) ---
// DTO réservés à l'API admin : ils peuvent exposer des identifiants internes
// (userId, profileId, bookingId) nécessaires à la modération, contrairement aux
// DTO publics. Aucun DTO public existant n'est modifié.

export interface AdminMetrics {
  users: { total: number; active: number; suspended: number };
  barbers: { active: number; pendingApproval: number };
  bookings: {
    total: number;
    pending: number;
    confirmed: number;
    completed: number;
    cancelled: number;
  };
  reviews: { total: number; hidden: number };
}

export interface AdminUser {
  id: string;
  email: string;
  role: Role;
  status: UserStatus;
  name: string | null;
  createdAt: string;
  // Identifiant du profil professionnel s'il existe (lien stats admin).
  barberProfileId: string | null;
  // Date d'attribution du badge « Certifié » (issue #41), null sinon.
  certifiedAt: string | null;
  // Profil barber en attente d'approbation (issue #40) ; false sans profil.
  barberPendingApproval: boolean;
}

export interface AdminUsersResponse {
  users: AdminUser[];
  pagination: AdminPagination;
}

export interface AdminBooking {
  id: string;
  clientUserId: string;
  clientName: string | null;
  clientEmail: string | null;
  barberProfileId: string;
  serviceId: string;
  barberDisplayName: string;
  serviceName: string;
  servicePlace: ServicePlace;
  status: BookingStatus;
  startAt: string;
  endAt: string;
  priceMinor: number;
  currency: Currency;
  cancelledBy: string | null;
  cancelledAt: string | null;
  createdAt: string;
}

export interface AdminBookingsResponse {
  bookings: AdminBooking[];
  pagination: AdminPagination;
}

export interface AdminReview {
  id: string;
  bookingId: string;
  rating: number;
  comment: string | null;
  hiddenAt: string | null;
  createdAt: string;
  clientName: string | null;
  barberDisplayName: string | null;
}

export interface AdminReviewsResponse {
  reviews: AdminReview[];
  pagination: AdminPagination;
}

// Entrée du journal d'audit (issue #13), vue ADMIN. `actorEmail` est résolu à
// la lecture (jamais stocké dans le journal) ; null pour une action système ou
// un compte supprimé.
export interface AdminAuditLog {
  id: string;
  action: AuditAction;
  actorUserId: string | null;
  actorRole: Role | null;
  actorEmail: string | null;
  targetType: AuditTargetType;
  targetId: string;
  /** Email du compte ciblé (cibles USER uniquement), résolu à la lecture. */
  targetEmail: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export interface AdminAuditLogsResponse {
  entries: AdminAuditLog[];
  pagination: AdminPagination;
}

export interface AdminPagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

// --- Galerie photos du professionnel (issue #8) ---
// `imagePath` est une URL publique relative servie sous `/uploads`. Aucune
// donnée privée : ni chemin disque absolu, ni identifiant de réservation.
export interface PublicBarberPhoto {
  id: string;
  imagePath: string;
  caption: string | null;
  createdAt: string;
}

// Vue propriétaire : mêmes champs + rattachement au profil et date de mise à jour.
export interface OwnBarberPhoto extends PublicBarberPhoto {
  barberProfileId: string;
  updatedAt: string;
}

export interface PublicBarberPhotosResponse {
  photos: PublicBarberPhoto[];
}

export interface OwnBarberPhotosResponse {
  photos: OwnBarberPhoto[];
}

// --- Configuration publique du site (issues #58, #59) ---
// Valeurs facultatives réglées par variables d'environnement serveur : une
// valeur absente n'est jamais affichée (aucun lien vide).
export type SocialNetwork = "instagram" | "facebook" | "tiktok" | "linkedin";

export interface SiteConfigResponse {
  supportEmail: string | null;
  socialLinks: { network: SocialNetwork; url: string }[];
  legal: { operatorName: string | null; operatorAddress: string | null };
}
