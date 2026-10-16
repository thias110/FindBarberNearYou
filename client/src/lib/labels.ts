import type {
  Audience,
  AuditAction,
  BookingPaymentStatus,
  BookingStatus,
  Currency,
  PaymentMode,
  ServicePlace,
  Technique,
  Weekday,
} from "@findbarber/shared/constants";
import type { Role, UserStatus } from "@findbarber/shared/types";
import i18n from "../i18n";

// Libellés des valeurs métier traduits (issue #32), espace `labels`. Les
// constantes `*_LABELS` de `@findbarber/shared/constants` restent la
// référence française (serveur, emails) ; l'interface passe par ces fonctions.
interface LabelKinds {
  audience: Audience;
  auditAction: AuditAction;
  bookingPaymentStatus: BookingPaymentStatus;
  bookingStatus: BookingStatus;
  currency: Currency;
  paymentMode: PaymentMode;
  role: Role;
  servicePlace: ServicePlace;
  technique: Technique;
  userStatus: UserStatus;
  weekday: Weekday;
}

export function label<K extends keyof LabelKinds>(
  kind: K,
  value: LabelKinds[K],
): string {
  return i18n.t(`labels:${kind}.${String(value)}`);
}
