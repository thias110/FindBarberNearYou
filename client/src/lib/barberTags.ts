import { AUDIENCE_LABELS, type Audience } from "@findbarber/shared/constants";

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
