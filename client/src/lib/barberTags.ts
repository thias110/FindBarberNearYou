import {
  AUDIENCE_LABELS,
  type Audience,
  type Technique,
} from "@findbarber/shared/constants";

// « Mixte » n'est pas un code stocké : il se calcule (FEMME + HOMME présents).
// Partagé entre la carte de résultat et l'encart du barber sélectionné.
export function audienceChips(audiences: Audience[]): string[] {
  const labels: string[] = [];
  if (audiences.includes("FEMME") && audiences.includes("HOMME")) {
    labels.push("Mixte");
  } else {
    if (audiences.includes("FEMME")) labels.push(AUDIENCE_LABELS.FEMME);
    if (audiences.includes("HOMME")) labels.push(AUDIENCE_LABELS.HOMME);
  }
  if (audiences.includes("ENFANT")) labels.push(AUDIENCE_LABELS.ENFANT);
  return labels;
}

const MAX_POPULAR = 2;

// Une ou deux prestations du barber, les plus populaires d'abord (classement
// de l'accueil, issue #47), puis dans l'ordre du catalogue.
export function popularTechniquesOf(
  techniques: Technique[],
  ranking: readonly Technique[],
): Technique[] {
  const rank = (technique: Technique) => {
    const index = ranking.indexOf(technique);
    return index === -1 ? ranking.length : index;
  };
  return [...techniques].sort((a, b) => rank(a) - rank(b)).slice(0, MAX_POPULAR);
}
