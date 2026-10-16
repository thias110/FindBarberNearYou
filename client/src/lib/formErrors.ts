import { ApiError } from "./apiClient";
import { translateValidationMessage } from "./validationMessages";

// Erreurs de formulaire au plus près du champ (issue #57).

export type FieldErrorMap = Record<string, string>;

/**
 * Erreurs par champ d'une réponse 400 VALIDATION_ERROR, indexées par le
 * premier segment du chemin (`places.0` → `places`) : c'est le champ du
 * formulaire. Seuls les champs listés dans `known` sont retenus, pour ne pas
 * afficher une erreur qu'aucun champ visible ne peut porter.
 */
export function fieldErrorsFrom(
  err: unknown,
  known: readonly string[],
): FieldErrorMap {
  if (!(err instanceof ApiError) || err.code !== "VALIDATION_ERROR") return {};
  const result: FieldErrorMap = {};
  for (const issue of err.fields) {
    const key = issue.path.split(".")[0];
    if (known.includes(key) && !result[key]) result[key] = translateValidationMessage(issue.message);
  }
  return result;
}

/**
 * Place le focus sur le premier champ en erreur du conteneur, après le rendu
 * des messages (le lecteur d'écran annonce alors le champ et son erreur, liée
 * par `aria-describedby`). Sans champ en erreur, ne fait rien.
 */
export function focusFirstInvalid(root: HTMLElement | null): void {
  requestAnimationFrame(() => {
    // Un groupe de boutons (ex. créneaux) se signale par `data-invalid` : on
    // place alors le focus sur son premier bouton.
    const target = root?.querySelector<HTMLElement>(
      '[aria-invalid="true"], [data-invalid="true"] button',
    );
    if (!target) return;
    target.focus({ preventScroll: true });
    target.scrollIntoView({ block: "center", behavior: "smooth" });
  });
}
