import { PASSWORD_MIN_LENGTH } from "@findbarber/shared/validation";

// Réservation express (lot N6) : saisie du compte à la dernière étape du
// tunnel (voir components/booking/ExpressFields.tsx). `website` est le piège à
// robots, qui doit rester vide.

export interface ExpressValues {
  name: string;
  email: string;
  password: string;
  website: string;
}

export type ExpressField = "name" | "email" | "password";
export type ExpressErrors = Partial<Record<ExpressField, string>>;
export const EXPRESS_FIELDS: readonly ExpressField[] = ["name", "email", "password"];

export const EMPTY_EXPRESS: ExpressValues = {
  name: "",
  email: "",
  password: "",
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
  if (values.password.length < PASSWORD_MIN_LENGTH) {
    errors.password = t("client:booking.flow.express.errors.passwordTooShort", {
      min: PASSWORD_MIN_LENGTH,
    });
  }
  return errors;
}
