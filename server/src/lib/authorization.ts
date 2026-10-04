import type { Role } from "@findbarber/shared/types";
import { AppError } from "./errors.js";

// --- Politiques d'autorisation des réservations (anti-IDOR) ---
//
// Convention d'erreurs du serveur :
//  - 401 : requête non authentifiée (middleware `requireAuth`).
//  - 403 : refus global de rôle ou de policy, ou CSRF invalide
//    (middlewares `requireRole` / `csrfProtection`).
//  - 404 : ressource privée inexistante **ou non possédée**. On ne divulgue
//    jamais l'existence d'une réservation à un utilisateur qui n'y a pas droit.
//
// Ces décisions sont PURES (aucun accès base) : elles s'appliquent à une
// réservation déjà chargée. Les mutations conservent en plus un filtrage SQL
// scopé (`barber_profile_id` / `client_user_id`) comme défense en profondeur.

export interface AuthUser {
  id: string;
  role: Role;
}

export interface BookingOwnership {
  clientUserId: string;
  barberProfileId: string;
}

/** Erreur 404 unique : réservation introuvable ou non possédée. */
export function bookingNotFound(): AppError {
  return new AppError(404, "BOOKING_NOT_FOUND", "Réservation introuvable.");
}

/** L'utilisateur est-il le CLIENT propriétaire de la réservation ? */
export function isBookingClientOwner(
  user: AuthUser,
  booking: Pick<BookingOwnership, "clientUserId">,
): boolean {
  return user.role === "CLIENT" && booking.clientUserId === user.id;
}

/** La réservation appartient-elle au profil du BARBER donné ? */
export function isBookingBarberOwner(
  barberProfileId: string,
  booking: Pick<BookingOwnership, "barberProfileId">,
): boolean {
  return booking.barberProfileId === barberProfileId;
}

/**
 * Accès en lecture au détail privé d'une réservation :
 * CLIENT propriétaire, BARBER propriétaire, ou ADMIN (convention explicite,
 * lecture seule — aucun autre droit ADMIN n'est accordé).
 * Sinon 404 `BOOKING_NOT_FOUND` (aucune fuite d'existence).
 */
export function assertBookingReadAccess(
  user: AuthUser,
  booking: BookingOwnership,
  barberProfileId: string | null,
): void {
  if (user.role === "ADMIN") return;
  if (isBookingClientOwner(user, booking)) return;
  if (
    barberProfileId !== null &&
    isBookingBarberOwner(barberProfileId, booking)
  ) {
    return;
  }
  throw bookingNotFound();
}

/**
 * Dépôt d'un avis : seul le CLIENT propriétaire de la réservation.
 * Sinon 404 `BOOKING_NOT_FOUND` (le BARBER/ADMIN n'apprend rien).
 */
export function assertBookingClientOwner(
  user: AuthUser,
  booking: Pick<BookingOwnership, "clientUserId">,
): void {
  if (isBookingClientOwner(user, booking)) return;
  throw bookingNotFound();
}
