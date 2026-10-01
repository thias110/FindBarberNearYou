// --- Validation du formulaire de réservation (côté client) ---
// La validation serveur reste la source de vérité : ces règles servent
// uniquement à guider l'utilisateur avant l'envoi et à éviter les soumissions
// manifestement incomplètes.
import type { ServicePlace } from "@findbarber/shared/constants";

export interface BookingFormValues {
  serviceId: string;
  place: ServicePlace | "";
  date: string;
  startMinute: number | null;
  clientAddress: string;
}

export type BookingFormField =
  | "serviceId"
  | "place"
  | "date"
  | "startMinute"
  | "clientAddress";

export type BookingFormErrors = Partial<Record<BookingFormField, string>>;

export function validateBookingForm(
  values: BookingFormValues,
): BookingFormErrors {
  const errors: BookingFormErrors = {};

  if (!values.serviceId.trim()) {
    errors.serviceId = "Choisissez un service.";
  }
  if (!values.place) {
    errors.place = "Choisissez un lieu de prestation.";
  }
  if (!values.date) {
    errors.date = "Choisissez une date.";
  }
  if (values.startMinute === null) {
    errors.startMinute = "Choisissez un créneau.";
  }
  if (values.place === "AT_CLIENT" && values.clientAddress.trim() === "") {
    errors.clientAddress =
      "Une adresse est requise pour une prestation chez le client.";
  }

  return errors;
}

export function hasErrors(errors: BookingFormErrors): boolean {
  return Object.keys(errors).length > 0;
}

/** Date du calendrier local du navigateur au format `AAAA-MM-JJ`. */
export function toLocalISODate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** Ajoute des jours calendaires locaux à une date (ne mute pas l'entrée). */
export function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}
