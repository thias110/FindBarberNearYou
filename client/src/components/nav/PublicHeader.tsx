import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, NavLink } from "react-router-dom";
import { cn } from "../../lib/cn";
import { LanguageSelect } from "../LanguageSelect";
import { Logo } from "../Logo";
import { buttonClasses } from "../ui/buttonStyles";
import { MobileMenu } from "./MobileMenu";
import { ProsMenu } from "./ProsMenu";

// Seuil de défilement au-delà duquel la barre devient opaque.
const SCROLL_OPAQUE_PX = 80;

// Barre du site public (lot DS-4, plan §2.6.6) : pilule flottante de 64 px,
// en verre en haut de page, opaque avec `shadow-2` après 80 px de défilement.
// Desktop : logo, Rechercher, menu « Pour les pros », langue, Connexion, CTA
// « Réserver ». Mobile : logo, langue et burger (menu plein écran).
// Hauteur totale 4,5 rem, comme la barre des espaces connectés.
export function PublicHeader() {
  const { t } = useTranslation("common");
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = useCallback(() => setMenuOpen(false), []);

  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > SCROLL_OPAQUE_PX);
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    cn(
      "focus-ring inline-flex min-h-11 items-center rounded-full px-3.5 text-sm font-semibold transition-colors duration-fast hover:bg-surface-muted",
      isActive ? "text-accent-strong" : "text-foreground",
    );

  return (
    <header className="sticky top-0 z-40 h-[4.5rem] px-2 pt-2 sm:px-4">
      <div
        className={cn(
          "mx-auto flex h-16 max-w-6xl items-center gap-2 rounded-full border pl-3 pr-2 sm:pl-4",
          "transition-[background-color,box-shadow,border-color] duration-base ease-out",
          scrolled
            ? "border-border bg-surface shadow-2"
            : "border-border/70 bg-surface/80 shadow-1 backdrop-blur-md backdrop-saturate-150",
        )}
      >
        <Link
          to="/"
          aria-label={t("app.homeLink")}
          className="focus-ring inline-flex min-h-11 min-w-11 items-center rounded-full"
        >
          <Logo />
        </Link>
        <nav aria-label={t("nav.main")} className="ml-3 hidden items-center gap-1 md:flex">
          <NavLink to="/barbers" className={navLinkClass}>
            {t("nav.search")}
          </NavLink>
          <ProsMenu />
        </nav>
        <div className="ml-auto flex min-w-0 items-center gap-2">
          {/* Langue accessible à tous, même sans compte (issue #37). */}
          <LanguageSelect compact />
          <Link
            to="/login"
            className={buttonClasses("ghost", "sm", "hidden whitespace-nowrap md:inline-flex")}
          >
            {t("app.login")}
          </Link>
          <Link
            to="/barbers"
            className={buttonClasses("primary", "sm", "hidden whitespace-nowrap md:inline-flex")}
          >
            {t("nav.book")}
          </Link>
          <button
            type="button"
            aria-label={t("nav.openMenu")}
            aria-expanded={menuOpen}
            aria-haspopup="dialog"
            onClick={() => setMenuOpen(true)}
            className={buttonClasses("ghost", "icon", "md:hidden")}
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              className="h-6 w-6"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.8}
              strokeLinecap="round"
            >
              <path d="M4 7h16M4 12h16M4 17h10" />
            </svg>
          </button>
        </div>
      </div>
      <MobileMenu open={menuOpen} onClose={closeMenu} />
    </header>
  );
}
