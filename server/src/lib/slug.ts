// Identifiant d'URL d'une ville (lot N9) : minuscules, sans accents, mots
// séparés par un tiret. « Genève », « GENÈVE » et « geneve » donnent le même
// identifiant ; « Saint-Gervais-les-Bains » donne `saint-gervais-les-bains`.
// Un nom sans lettre ni chiffre latin (alphabet non latin) donne une chaîne
// vide : la ville n'a pas de page.
export const CITY_SLUG_MAX_LENGTH = 80;

export function slugifyCity(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, CITY_SLUG_MAX_LENGTH)
    .replace(/-+$/g, "");
}

/** Forme valide d'un identifiant de ville reçu dans une URL. */
export function isCitySlug(value: string): boolean {
  return (
    value.length > 0 &&
    value.length <= CITY_SLUG_MAX_LENGTH &&
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)
  );
}
