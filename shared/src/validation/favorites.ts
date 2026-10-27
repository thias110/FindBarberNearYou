import { z } from "zod";

// Paramètre de route `:barberId` des favoris (lot N5). Même convention que les
// autres identifiants : une valeur malformée est rejetée avant tout accès base.
export const favoriteParamsSchema = z
  .object({
    barberId: z
      .string()
      .trim()
      .min(1, "Identifiant requis.")
      .max(64, "Identifiant trop long."),
  })
  .strict();

export type FavoriteParams = z.infer<typeof favoriteParamsSchema>;
