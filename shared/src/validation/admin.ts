import { z } from "zod";
import { ADMIN_LIMITS, BOOKING_STATUSES, ROLES } from "../constants";
import { integerParam } from "./barber";

// Pagination partagée des listes d'administration. `integerParam` réutilise la
// convention du repo : chaîne unique, entier borné, défaut appliqué.
const page = integerParam(
  ADMIN_LIMITS.pageDefault,
  ADMIN_LIMITS.pageMax,
  ADMIN_LIMITS.pageDefault,
);
const pageSize = integerParam(
  1,
  ADMIN_LIMITS.pageSizeMax,
  ADMIN_LIMITS.pageSizeDefault,
);

// GET /api/admin/users : filtre optionnel par rôle. Les actions
// suspend/reactivate prennent l'identifiant en paramètre de route, sans body.
export const adminUserListQuerySchema = z
  .object({
    role: z.enum(ROLES).optional(),
    page,
    pageSize,
  })
  .strict();

// GET /api/admin/bookings : filtre optionnel par statut.
export const adminBookingListQuerySchema = z
  .object({
    status: z.enum(BOOKING_STATUSES).optional(),
    page,
    pageSize,
  })
  .strict();

// GET /api/admin/reviews : pagination seule (les avis masqués sont inclus pour
// l'administration).
export const adminReviewListQuerySchema = z
  .object({
    page,
    pageSize,
  })
  .strict();

export type AdminUserListQuery = z.infer<typeof adminUserListQuerySchema>;
export type AdminBookingListQuery = z.infer<typeof adminBookingListQuerySchema>;
export type AdminReviewListQuery = z.infer<typeof adminReviewListQuerySchema>;
