import { z } from "zod";

// Liste des notifications : pas de pagination par page dans ce lot, on borne
// simplement le nombre de résultats renvoyés (50 par défaut, 100 max).
export const notificationListQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(100).default(50),
});

export type NotificationListQuery = z.infer<
  typeof notificationListQuerySchema
>;
