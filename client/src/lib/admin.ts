// Helpers d'affichage de l'interface d'administration. Aucune règle métier :
// le serveur reste la source de vérité (autorisations, transitions, etc.).
import type { AdminBooking, AdminUser } from "@findbarber/shared/types";

/** Nom affiché d'un utilisateur : nom s'il existe, sinon email. */
export function adminUserDisplayName(user: AdminUser): string {
  const name = user.name?.trim();
  return name ? name : user.email;
}

/** Libellé du responsable d'une annulation, ou `null` si inconnu. */
/** Nom du client d'une réservation : nom, sinon email, sinon « inconnu ». */
export function bookingClientLabel(
  booking: Pick<AdminBooking, "clientName" | "clientEmail">,
): string {
  const name = booking.clientName?.trim();
  if (name) return name;
  return booking.clientEmail ?? "Client inconnu";
}

export function cancellationActorLabel(
  cancelledBy: string | null,
): string | null {
  switch (cancelledBy) {
    case "CLIENT":
      return "Le client";
    case "BARBER":
      return "Le professionnel";
    case "ADMIN":
      return "L'administration";
    default:
      return null;
  }
}
