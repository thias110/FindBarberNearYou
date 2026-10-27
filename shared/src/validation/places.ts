import { z } from "zod";

// Autocomplétion de ville (lot N4) : route publique, donc saisie bornée.
export const PLACE_SUGGESTION_LIMIT = 5;
export const PLACE_QUERY_MIN = 2;
export const PLACE_QUERY_MAX = 80;

export const placeSuggestQuerySchema = z
  .object({
    q: z
      .string()
      .trim()
      // Texte littéral (traduit côté client) : garder « 2 » égal à PLACE_QUERY_MIN.
      .min(PLACE_QUERY_MIN, "Saisissez au moins 2 caractères.")
      .max(PLACE_QUERY_MAX, "La recherche est trop longue."),
  })
  .strict();

export type PlaceSuggestQuery = z.infer<typeof placeSuggestQuerySchema>;
