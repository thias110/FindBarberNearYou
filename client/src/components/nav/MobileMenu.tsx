import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { buttonClasses } from "../ui/buttonStyles";
import { useModalDialog } from "../ui/useModalDialog";

// Menu plein écran du site public sur mobile (lot DS-4, plan §2.6.6) : fond
// `night`, liens en Bricolage 700 28 px. `<dialog>` modal : focus piégé, Échap
// ferme, le focus revient au burger.
export function MobileMenu({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation("common");
  const dialogRef = useModalDialog(open);

  const linkClass =
    "focus-ring-on-night block rounded-lg py-2 font-display text-[1.75rem] font-bold leading-tight text-white";

  return (
    <dialog
      ref={dialogRef}
      aria-label={t("nav.menu")}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      className="m-0 h-dvh max-h-none w-full max-w-none bg-night p-0 text-white open:motion-safe:animate-fade-in [&:not([open])]:hidden"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(75%_60%_at_85%_10%,rgb(var(--fb-cobalt)/0.26),transparent_70%)]"
      />
      <div className="relative flex h-full flex-col px-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-4">
        <div className="flex justify-end">
          <button
            type="button"
            onClick={onClose}
            aria-label={t("nav.closeMenu")}
            className={buttonClasses("outline-inverse", "icon")}
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
        <nav aria-label={t("nav.main")} className="mt-6">
          <ul className="space-y-2">
            <li>
              <Link to="/barbers" className={linkClass} onClick={onClose}>
                {t("nav.search")}
              </Link>
            </li>
            <li>
              <Link to="/register?role=BARBER" className={linkClass} onClick={onClose}>
                {t("nav.becomePartner")}
              </Link>
            </li>
            <li>
              <Link to="/login" className={linkClass} onClick={onClose}>
                {t("app.login")}
              </Link>
            </li>
          </ul>
        </nav>
        <Link
          to="/barbers"
          onClick={onClose}
          className={buttonClasses("inverse", "xl", "relative mt-auto w-full")}
        >
          {t("nav.book")}
        </Link>
      </div>
    </dialog>
  );
}
