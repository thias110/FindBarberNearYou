import { z } from "zod";

// Caractères de contrôle interdits dans les champs texte libres. Ils n'ont
// aucune utilité légitime dans un nom, une description, une adresse ou un avis,
// et peuvent servir à tromper des logs/terminaux ou à contourner des filtres.
// On ne TRANSFORME pas le texte : on le valide (le rendu reste échappé par React).
// eslint-disable-next-line no-control-regex -- volontaire : on DÉTECTE les caractères de contrôle
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;

// Négation ancrée : le champ ne doit contenir AUCUN caractère de contrôle.
// `.regex()` renvoie un `ZodString` (contrairement à `.refine()` qui renvoie un
// `ZodEffects`), ce qui permet aux appelants d'enchaîner `.min()`, `.nullable()`,
// `.optional()`, etc. Les sauts de ligne (`\n`) et tabulations (`\t`) restent
// autorisés car hors du jeu de caractères de contrôle rejeté.
// eslint-disable-next-line no-control-regex -- négation ancrée de la même liste
const NO_CONTROL_CHARS = /^[^\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]*$/;

export function containsControlChars(value: string): boolean {
  return CONTROL_CHARS.test(value);
}

/** Champ texte libre : trim + longueur max + rejet des caractères de contrôle. */
export function safeText(max: number, tooLongMessage?: string) {
  return z
    .string()
    .trim()
    .max(max, tooLongMessage)
    .regex(NO_CONTROL_CHARS, "Caractères de contrôle interdits.");
}
