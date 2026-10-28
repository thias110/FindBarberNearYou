// Réservation express (lot N6) : saisie du compte à la dernière étape du
// tunnel (voir components/booking/ExpressFields.tsx). Pas de mot de passe : il
// se choisit depuis le lien reçu par email. `website` est le piège à robots,
// qui doit rester vide.

export interface ExpressValues {
  name: string;
  email: string;
  website: string;
}

export type ExpressField = "name" | "email";
export type ExpressErrors = Partial<Record<ExpressField, string>>;
export const EXPRESS_FIELDS: readonly ExpressField[] = ["name", "email"];

export const EMPTY_EXPRESS: ExpressValues = {
  name: "",
  email: "",
  website: "",
};

/** Contrôles avant envoi (le serveur revalide tout). */
export function validateExpress(
  values: ExpressValues,
  t: (key: string, options?: Record<string, unknown>) => string,
): ExpressErrors {
  const errors: ExpressErrors = {};
  if (!values.name.trim()) errors.name = t("client:booking.flow.express.errors.nameRequired");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) {
    errors.email = t("client:booking.flow.express.errors.emailInvalid");
  }
  return errors;
}
