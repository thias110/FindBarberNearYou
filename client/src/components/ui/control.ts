// Classes communes des contrôles de formulaire (Input, Select, Textarea) :
// mêmes bordures, focus, état désactivé et erreur (`aria-invalid`).
export const CONTROL_CLASS =
  "block w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground " +
  "placeholder:text-foreground-muted " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent " +
  "focus-visible:ring-offset-2 focus-visible:ring-offset-background " +
  "disabled:cursor-not-allowed disabled:opacity-50 " +
  "aria-[invalid=true]:border-danger";
