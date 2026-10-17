import { useId, useRef, type ReactNode, type RefObject } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "../../lib/cn";
import { useModalDialog } from "./useModalDialog";

export interface SheetProps {
  open: boolean;
  title: string;
  children: ReactNode;
  /** Pied de feuille collant (ex. « Afficher 24 barbers » + « Réinitialiser »). */
  footer?: ReactNode;
  initialFocus?: RefObject<HTMLElement | null>;
  onClose: () => void;
}

// Distance de glissement vers le bas (px) qui ferme la feuille sur mobile.
const SWIPE_CLOSE_PX = 80;

// Feuille modale (lot DS-3, plan §2.6.7) : sur mobile, elle monte du bas
// (rayon `radius-xl` en haut, poignée, fermeture par glissement vers le bas ou
// Échap) ; à partir de `sm:`, panneau latéral de 440 px. Usages : filtres,
// choix de la ville, détail d'une réservation.
export function Sheet({
  open,
  title,
  children,
  footer,
  initialFocus,
  onClose,
}: SheetProps) {
  const { t } = useTranslation("common");
  const dialogRef = useModalDialog(open, initialFocus);
  const titleId = useId();
  const touchStartY = useRef<number | null>(null);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      className={cn(
        // Le <dialog> occupe la zone de la feuille ; `m-0` annule le centrage.
        "m-0 flex max-h-[90dvh] w-full max-w-none flex-col border-border bg-surface p-0 text-foreground shadow-3",
        "fixed inset-x-0 bottom-0 top-auto rounded-t-3xl border-t",
        "sm:inset-y-0 sm:left-auto sm:right-0 sm:h-dvh sm:max-h-none sm:w-[27.5rem] sm:rounded-none sm:border-l sm:border-t-0",
        "backdrop:bg-night/55 backdrop:backdrop-blur-[4px]",
        "open:motion-safe:animate-sheet-up sm:open:motion-safe:animate-panel-in",
        "[&:not([open])]:hidden",
      )}
    >
      <div
        className="shrink-0"
        onTouchStart={(event) => {
          touchStartY.current = event.touches[0]?.clientY ?? null;
        }}
        onTouchEnd={(event) => {
          const start = touchStartY.current;
          const end = event.changedTouches[0]?.clientY;
          touchStartY.current = null;
          if (start !== null && end !== undefined && end - start > SWIPE_CLOSE_PX) {
            onClose();
          }
        }}
      >
        <div aria-hidden="true" className="flex justify-center pt-2 sm:hidden">
          <span className="h-1 w-9 rounded-full bg-border-strong" />
        </div>
        <div className="flex items-center justify-between gap-3 px-5 pb-3 pt-3 sm:pt-5">
          <h2 id={titleId} className="text-h3 font-bold">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("dialog.close")}
            className="focus-ring -mr-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-foreground-muted transition-colors duration-fast hover:bg-surface-muted hover:text-foreground"
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 20 20"
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.8}
              strokeLinecap="round"
            >
              <path d="M5 5l10 10M15 5L5 15" />
            </svg>
          </button>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5">{children}</div>
      {footer && (
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-border px-5 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          {footer}
        </div>
      )}
    </dialog>
  );
}
