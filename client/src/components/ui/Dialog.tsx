import { useId, type ReactNode, type RefObject } from "react";
import { cn } from "../../lib/cn";
import { useModalDialog } from "./useModalDialog";

export interface DialogProps {
  open: boolean;
  title: string;
  /** Texte d'explication (relié par `aria-describedby`). */
  description?: ReactNode;
  /** Boutons d'action, alignés à droite. */
  actions?: ReactNode;
  children?: ReactNode;
  /** Élément qui reçoit le focus à l'ouverture (choix sûr, ex. « Annuler »). */
  initialFocus?: RefObject<HTMLElement | null>;
  /** Échap ou clic sur le fond. Ignoré si `dismissible` vaut false. */
  onClose: () => void;
  dismissible?: boolean;
  className?: string;
}

// Boîte de dialogue modale (lot DS-3, plan §2.6.7) sur `<dialog>` natif :
// rayon `radius-lg`, `shadow-3`, 440 px au plus, fond nuit à 55 % flouté.
// Entrée en `scale(.96)` + fondu, seulement sans reduced-motion.
export function Dialog({
  open,
  title,
  description,
  actions,
  children,
  initialFocus,
  onClose,
  dismissible = true,
  className,
}: DialogProps) {
  const dialogRef = useModalDialog(open, initialFocus);
  const titleId = useId();
  const descriptionId = useId();

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      // Escape : le navigateur fermerait le dialog ; l'état React reste maître.
      onCancel={(event) => {
        event.preventDefault();
        if (dismissible) onClose();
      }}
      // Clic sur le fond (la cible est alors le <dialog> lui-même).
      onClick={(event) => {
        if (dismissible && event.target === event.currentTarget) onClose();
      }}
      className={cn(
        "w-[calc(100%-2rem)] max-w-[27.5rem] rounded-2xl border border-border bg-surface p-6 text-foreground shadow-3",
        "backdrop:bg-night/55 backdrop:backdrop-blur-[4px]",
        "open:motion-safe:animate-dialog-in",
        className,
      )}
    >
      <h2 id={titleId} className="text-h3 font-bold text-foreground">
        {title}
      </h2>
      {description && (
        <div id={descriptionId} className="mt-2 text-sm text-foreground-muted">
          {description}
        </div>
      )}
      {children}
      {actions && (
        <div className="mt-6 flex flex-wrap justify-end gap-2">{actions}</div>
      )}
    </dialog>
  );
}
