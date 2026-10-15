// Classes communes des contrôles de formulaire (Input, Select, Textarea) :
// mêmes bordures, focus, état désactivé et erreur (`aria-invalid`).
// Issue #28 : 44 px de haut minimum (cible tactile) et texte 16 px sur mobile
// (en dessous, iOS zoome sur le champ au focus), 14 px à partir de `sm:`.
export const CONTROL_CLASS =
  "block min-h-11 w-full rounded-xl border border-border-strong bg-surface px-3.5 py-2 " +
  "text-base text-foreground sm:text-sm " +
  "placeholder:text-foreground-muted hover:border-foreground-muted " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent " +
  "focus-visible:ring-offset-2 focus-visible:ring-offset-background " +
  "disabled:cursor-not-allowed disabled:opacity-50 " +
  "aria-[invalid=true]:border-2 aria-[invalid=true]:border-danger";
