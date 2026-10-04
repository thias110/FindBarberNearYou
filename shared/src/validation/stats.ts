import { z } from "zod";
import { STATS_DEFAULT_RANGE, STATS_LIMITS, STATS_RANGES } from "../constants";
import { inclusiveDayCount, isValidCalendarDate } from "../dates";

// Requête `GET /api/barber/stats` : plage prédéfinie ou plage personnalisée.
// - `from`/`to` (AAAA-MM-JJ) sont réservés à `range=custom`.
// - Plage custom bornée à STATS_LIMITS.maxRangeDays jours inclus.
// - Paramètres inconnus ou répétés rejetés (.strict + z.string()).
export const barberStatsQuerySchema = z
  .object({
    range: z.enum(STATS_RANGES).default(STATS_DEFAULT_RANGE),
    from: z.string().optional(),
    to: z.string().optional(),
  })
  .strict()
  .superRefine((data, ctx) => {
    if (data.range !== "custom") {
      if (data.from !== undefined || data.to !== undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "from et to ne sont autorisés qu'avec range=custom.",
          path: ["from"],
        });
      }
      return;
    }

    if (data.from === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "from est requis avec range=custom.",
        path: ["from"],
      });
    }
    if (data.to === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "to est requis avec range=custom.",
        path: ["to"],
      });
    }
    if (data.from === undefined || data.to === undefined) return;

    const fromOk = isValidCalendarDate(data.from);
    const toOk = isValidCalendarDate(data.to);
    if (!fromOk) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "from doit être une date AAAA-MM-JJ valide.",
        path: ["from"],
      });
    }
    if (!toOk) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "to doit être une date AAAA-MM-JJ valide.",
        path: ["to"],
      });
    }
    if (!fromOk || !toOk) return;

    if (data.from > data.to) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "from doit être antérieur ou égal à to.",
        path: ["to"],
      });
      return;
    }
    if (inclusiveDayCount(data.from, data.to) > STATS_LIMITS.maxRangeDays) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `La plage ne peut pas dépasser ${STATS_LIMITS.maxRangeDays} jours.`,
        path: ["to"],
      });
    }
  });

export type BarberStatsQuery = z.infer<typeof barberStatsQuerySchema>;
