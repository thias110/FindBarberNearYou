import {
  BOOKING_STATUS_LABELS,
  type BookingStatus,
} from "@findbarber/shared/constants";
import { Badge, type BadgeVariant } from "./ui/Badge";

// Seules les couleurs changent (tokens de statut). Statuts, libellés, props et
// logique métier restent identiques.
const STATUS_VARIANTS: Record<BookingStatus, BadgeVariant> = {
  PENDING: "warning",
  CONFIRMED: "success",
  CANCELLED: "neutral",
  COMPLETED: "info",
  NO_SHOW: "danger",
};

export function BookingStatusBadge({ status }: { status: BookingStatus }) {
  return (
    <Badge variant={STATUS_VARIANTS[status]}>
      {BOOKING_STATUS_LABELS[status]}
    </Badge>
  );
}
