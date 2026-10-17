import { useEffect, useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { cn } from "../../lib/cn";
import { FadeMotif } from "../ui/FadeMotif";

// Menu « Pour les pros » de la barre publique (lot DS-4, plan §2.6.6) :
// ouvert au clic ou au clavier (pas au survol seul), tuile illustrée et liens
// vers des routes existantes. Échap ou un clic à l'extérieur le ferme ; Échap
// rend le focus au bouton.
export function ProsMenu({ onNight = false }: { onNight?: boolean }) {
  const { t } = useTranslation("common");
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    }
    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open]);

  return (
    <div
      ref={rootRef}
      className="relative"
      // Le focus qui quitte le menu (Tab) le referme.
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setOpen(false);
        }
      }}
    >
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
        className={cn(
          "inline-flex min-h-11 items-center gap-1 rounded-full px-3.5 text-sm font-semibold transition-colors duration-fast",
          onNight
            ? "focus-ring-on-night text-white hover:bg-white/10"
            : "focus-ring text-foreground hover:bg-surface-muted",
        )}
      >
        {t("nav.forPros")}
        <svg
          aria-hidden="true"
          viewBox="0 0 20 20"
          className={cn(
            "h-4 w-4 transition-transform duration-base ease-out",
            open && "rotate-180",
          )}
          fill="none"
          stroke="currentColor"
          strokeWidth={1.8}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M5 7.5l5 5 5-5" />
        </svg>
      </button>
      <div
        id={panelId}
        hidden={!open}
        className="absolute left-0 top-full z-50 mt-3 w-[22rem] rounded-2xl border border-border bg-surface p-2 shadow-3 motion-safe:animate-fade-in"
      >
        <div className="relative overflow-hidden rounded-xl bg-night p-4 text-white">
          <FadeMotif className="absolute inset-x-0 bottom-0 h-8 w-full text-white/10" />
          <p className="relative font-display text-base font-bold leading-snug">
            {t("nav.prosTileTitle")}
          </p>
          <p className="relative mt-1 text-sm text-night-muted">
            {t("nav.prosTileBody")}
          </p>
        </div>
        <ul className="mt-1">
          <li>
            <Link
              to="/register?role=BARBER"
              onClick={() => setOpen(false)}
              className="focus-ring flex min-h-11 items-center rounded-lg px-3 text-sm font-semibold text-foreground hover:bg-surface-muted"
            >
              {t("nav.becomePartner")}
            </Link>
          </li>
          <li>
            <Link
              to="/login"
              onClick={() => setOpen(false)}
              className="focus-ring flex min-h-11 items-center rounded-lg px-3 text-sm font-semibold text-foreground hover:bg-surface-muted"
            >
              {t("nav.proLogin")}
            </Link>
          </li>
        </ul>
      </div>
    </div>
  );
}
