// Classes communes des contrôles de formulaire (Input, Select, Textarea) :
// mêmes bordures, focus, état désactivé, lecture seule et erreur
// (`aria-invalid`). Lot DS-2 (plan §2.6.2) : 48 px de haut (cible tactile
// confortable), rayon `radius-sm` (`rounded-lg`), texte 16 px sur mobile (en
// dessous, iOS zoome sur le champ au focus), 14 px à partir de `sm:`.
export const CONTROL_CLASS =
  "focus-ring block min-h-12 w-full rounded-lg border border-border-strong bg-surface px-3.5 py-2 " +
  "text-base text-foreground sm:text-sm " +
  "transition-[border-color,box-shadow] duration-fast ease-out " +
  "placeholder:text-foreground-muted hover:border-foreground-muted focus-visible:border-accent " +
  "disabled:cursor-not-allowed disabled:bg-surface-muted disabled:text-foreground-muted " +
  "[&[readonly]]:border-transparent [&[readonly]]:bg-surface-muted " +
  "aria-[invalid=true]:border-2 aria-[invalid=true]:border-danger";
