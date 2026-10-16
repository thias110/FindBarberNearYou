// Helpers d'affichage de l'interface d'administration. Aucune règle métier :
// le serveur reste la source de vérité (autorisations, transitions, etc.).
import type { AdminBooking, AdminUser } from "@findbarber/shared/types";
import i18n from "../i18n";

/** Nom affiché d'un utilisateur : nom s'il existe, sinon email. */
export function adminUserDisplayName(user: AdminUser): string {
  const name = user.name?.trim();
  return name ? name : user.email;
}

/** Nom du client d'une réservation : nom, sinon email, sinon « inconnu ». */
export function bookingClientLabel(
  booking: Pick<AdminBooking, "clientName" | "clientEmail">,
): string {
  const name = booking.clientName?.trim();
  if (name) return name;
  return booking.clientEmail ?? i18n.t("admin:lib.unknownClient");
}

/** Libellé du responsable d'une annulation, ou `null` si inconnu. */
export function cancellationActorLabel(
  cancelledBy: string | null,
): string | null {
  switch (cancelledBy) {
    case "CLIENT":
      return i18n.t("admin:lib.cancelledBy.client");
    case "BARBER":
      return i18n.t("admin:lib.cancelledBy.barber");
    case "ADMIN":
      return i18n.t("admin:lib.cancelledBy.admin");
    default:
      return null;
  }
}
