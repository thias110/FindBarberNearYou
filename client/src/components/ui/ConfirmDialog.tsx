import { useRef, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "./Button";
import { Dialog } from "./Dialog";

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

// Boîte de confirmation modale (remplace `window.confirm`), construite sur
// `Dialog`. Le focus initial va sur « Annuler » (choix sûr) et revient sur
// l'élément déclencheur à la fermeture. Une action destructive se confirme
// avec le bouton `danger-solid` (plan §2.6.1).
export function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel,
  cancelLabel,
  tone = "primary",
  isLoading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const { t } = useTranslation("common");
  const cancelRef = useRef<HTMLButtonElement>(null);

  return (
    <Dialog
      open={open}
      title={title}
      description={children}
      initialFocus={cancelRef}
      dismissible={!isLoading}
      onClose={onCancel}
      actions={
        <>
          <Button
            ref={cancelRef}
            variant="secondary"
            disabled={isLoading}
            onClick={onCancel}
          >
            {cancelLabel ?? t("dialog.cancel")}
          </Button>
          <Button
            variant={tone === "danger" ? "danger-solid" : "primary"}
            isLoading={isLoading}
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </>
      }
    />
  );
}
