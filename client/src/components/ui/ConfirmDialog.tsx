import { useEffect, useId, useRef, type ReactNode } from "react";
import { Button } from "./Button";

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  children?: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  /** `danger` pour les actions destructives (suspension, masquage…). */
  tone?: "primary" | "danger";
  isLoading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

// Boîte de confirmation modale (remplace `window.confirm`). S'appuie sur
// `<dialog>` + `showModal()` : piège de focus, `Escape` et fond inerte sont
// gérés nativement par le navigateur. Le focus initial va sur « Annuler »
// (choix sûr) et revient sur l'élément déclencheur à la fermeture.
export function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel,
  cancelLabel = "Annuler",
  tone = "primary",
  isLoading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      returnFocusRef.current = document.activeElement as HTMLElement | null;
      dialog.showModal();
      cancelRef.current?.focus();
    } else if (!open && dialog.open) {
      dialog.close();
      returnFocusRef.current?.focus();
    }
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      aria-describedby={children ? descriptionId : undefined}
      // Escape : le navigateur ferme le dialog ; on garde l'état React maître.
      onCancel={(event) => {
        event.preventDefault();
        if (!isLoading) onCancel();
      }}
      className="w-[calc(100%-2rem)] max-w-md rounded-2xl border border-border bg-surface p-6 text-foreground shadow-card backdrop:bg-black/50"
    >
      <h2 id={titleId} className="text-lg font-semibold text-foreground">
        {title}
      </h2>
      {children && (
        <div id={descriptionId} className="mt-2 text-sm text-foreground-muted">
          {children}
        </div>
      )}
      <div className="mt-6 flex flex-wrap justify-end gap-2">
        <Button
          ref={cancelRef}
          variant="secondary"
          className="min-h-11"
          disabled={isLoading}
          onClick={onCancel}
        >
          {cancelLabel}
        </Button>
        <Button
          variant={tone === "danger" ? "danger" : "primary"}
          className="min-h-11"
          isLoading={isLoading}
          onClick={onConfirm}
        >
          {confirmLabel}
        </Button>
      </div>
    </dialog>
  );
}
