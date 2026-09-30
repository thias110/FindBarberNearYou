/**
 * Échappe les caractères spéciaux de LIKE/ILIKE (\, %, _) pour qu'ils soient
 * traités comme des caractères littéraux. À utiliser avec `ESCAPE '\\'`.
 */
export function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, (ch) => `\\${ch}`);
}
