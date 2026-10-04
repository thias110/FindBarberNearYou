import { z } from "zod";
import { LIMITS, REVIEW_LIMITS } from "../constants";
import { integerParam } from "./barber";

// --- Création d'un avis (lot 11) ---
// Le client ne fournit QUE la note et un commentaire facultatif. `barberId` et
// `clientId` sont déduits du booking et de l'utilisateur authentifié : tout
// champ inconnu (dont `barberId`/`clientId`/`bookingId`) est rejeté par
// `.strict()`. Le commentaire est trimé, vide → null.
export const reviewCreateSchema = z
  .object({
    rating: z
      .number()
      .int("La note doit être un entier.")
      .min(LIMITS.reviewRatingMin, "La note doit être comprise entre 1 et 5.")
      .max(LIMITS.reviewRatingMax, "La note doit être comprise entre 1 et 5."),
    comment: z
      .string()
      .trim()
      .max(
        LIMITS.reviewComment,
        `Le commentaire ne peut pas dépasser ${LIMITS.reviewComment} caractères.`,
      )
      .nullish()
      .transform((value) => {
        if (value === undefined || value === null) return null;
        return value.length > 0 ? value : null;
      }),
  })
  .strict();

export type ReviewCreateInput = z.infer<typeof reviewCreateSchema>;

// --- Lecture publique paginée des avis d'un professionnel ---
// Même stratégie de pagination que la recherche publique : paramètres uniques,
// entiers bornés, champs inconnus rejetés.
export const reviewListQuerySchema = z
  .object({
    page: integerParam(
      REVIEW_LIMITS.pageDefault,
      REVIEW_LIMITS.pageMax,
      REVIEW_LIMITS.pageDefault,
    ),
    pageSize: integerParam(
      1,
      REVIEW_LIMITS.pageSizeMax,
      REVIEW_LIMITS.pageSizeDefault,
    ),
  })
  .strict();

export type ReviewListQuery = z.infer<typeof reviewListQuerySchema>;
