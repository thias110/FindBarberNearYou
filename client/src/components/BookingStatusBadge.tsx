import {
  BOOKING_STATUS_LABELS,
  type BookingStatus,
} from "@findbarber/shared/constants";

const STATUS_STYLES: Record<BookingStatus, string> = {
  PENDING: "bg-amber-100 text-amber-800",
  CONFIRMED: "bg-green-100 text-green-700",
  CANCELLED: "bg-gray-200 text-gray-600",
  COMPLETED: "bg-blue-100 text-blue-800",
  NO_SHOW: "bg-red-100 text-red-700",
};

export function BookingStatusBadge({ status }: { status: BookingStatus }) {
  return (
    <span
      className={`rounded-full px-2 py-1 text-xs ${STATUS_STYLES[status]}`}
    >
      {BOOKING_STATUS_LABELS[status]}
    </span>
  );
}
