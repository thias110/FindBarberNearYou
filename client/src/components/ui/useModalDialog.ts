import { useEffect, useRef, type RefObject } from "react";

// Ouverture / fermeture d'un `<dialog>` natif piloté par l'état React :
// `showModal()` fournit le piège de focus, `Escape` et le fond inerte. Le focus
// revient sur l'élément déclencheur à la fermeture (plan §2.8).
export function useModalDialog(
  open: boolean,
  initialFocus?: RefObject<HTMLElement | null>,
) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      returnFocusRef.current = document.activeElement as HTMLElement | null;
      dialog.showModal();
      initialFocus?.current?.focus();
    } else if (!open && dialog.open) {
      dialog.close();
      returnFocusRef.current?.focus();
    }
  }, [open, initialFocus]);

  return dialogRef;
}
