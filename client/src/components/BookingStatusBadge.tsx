import { useTranslation } from "react-i18next";
import type { BookingStatus } from "@findbarber/shared/constants";
import { label } from "../lib/labels";
import { Badge, type BadgeVariant } from "./ui/Badge";

// Seules les couleurs changent (tokens de statut). Statuts, libellés, props et
// logique métier restent identiques.
const STATUS_VARIANTS: Record<BookingStatus, BadgeVariant> = {
  PENDING: "warning",
  CONFIRMED: "success",
  CANCELLED: "neutral",
  COMPLETED: "info",
  NO_SHOW: "danger",
  DECLINED: "danger",
  EXPIRED: "neutral",
};

export function BookingStatusBadge({ status }: { status: BookingStatus }) {
  // Abonnement au changement de langue (le libellé passe par `label()`).
  useTranslation("client");
  return (
    <Badge variant={STATUS_VARIANTS[status]}>
      {label("bookingStatus", status)}
    </Badge>
  );
}
