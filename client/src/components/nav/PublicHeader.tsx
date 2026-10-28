import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, NavLink, useLocation } from "react-router-dom";
import { cn } from "../../lib/cn";
import { LanguageSelect } from "../LanguageSelect";
import { Logo } from "../Logo";
import { buttonClasses } from "../ui/buttonStyles";
import { MobileMenu } from "./MobileMenu";
import { ProsMenu } from "./ProsMenu";

// Seuil de défilement au-delà duquel la barre devient opaque.
const SCROLL_OPAQUE_PX = 80;

// Barre du site public (lot DS-4, plan §2.6.6) : pilule flottante de 64 px,
// en verre biseauté (« liquid glass ») en haut de page, opaque avec `shadow-2`
// après 80 px de défilement.
// Desktop : logo, Rechercher, menu « Pour les pros », langue, Connexion, CTA
// « Réserver ». Mobile : logo, langue et burger (menu plein écran).
// Sur le hero de nuit de l'accueil, tant qu'on n'a pas défilé : verre nuit à
// liseré spéculaire et texte blanc. Hauteur totale 4,5 rem, comme la barre des
// espaces connectés.
export function PublicHeader() {
  const { t } = useTranslation("common");
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = useCallback(() => setMenuOpen(false), []);
  const { pathname } = useLocation();
  const onNight = pathname === "/" && !scrolled;

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
      "inline-flex min-h-11 items-center rounded-full px-3.5 text-sm font-semibold transition-colors duration-fast",
      onNight
        ? "focus-ring-on-night text-white hover:bg-white/10"
        : cn(
            "focus-ring hover:bg-surface-muted",
            isActive ? "text-accent-strong" : "text-foreground",
          ),
    );

  return (
    <header className="sticky top-0 z-40 h-[4.5rem] px-2 pt-2 sm:px-4">
      <div
        className={cn(
          "mx-auto flex h-16 max-w-6xl items-center gap-2 rounded-full border pl-3 pr-2 sm:pl-4",
          "transition-shadow duration-base ease-out",
          scrolled
            ? "border-border bg-surface shadow-2"
            : onNight
              ? "border-white/15 bg-night/75 shadow-[inset_0_1px_0_rgb(255_255_255/0.14),0_18px_42px_-16px_rgb(0_0_0/0.65)] backdrop-blur-xl backdrop-saturate-150"
              : "border-border/80 bg-surface/95 shadow-1 backdrop-blur-xl backdrop-saturate-150",
        )}
      >
        <Link
          to="/"
          aria-label={t("app.homeLink")}
          className={cn(
            "inline-flex min-h-11 min-w-11 items-center rounded-full",
            onNight ? "focus-ring-on-night" : "focus-ring",
          )}
        >
          <Logo tone={onNight ? "onNight" : "default"} />
        </Link>
        <nav aria-label={t("nav.main")} className="ml-3 hidden items-center gap-1 md:flex">
          <NavLink to="/barbers" className={navLinkClass}>
            {t("nav.search")}
          </NavLink>
          <ProsMenu onNight={onNight} />
        </nav>
        <div className="ml-auto flex min-w-0 items-center gap-2">
          {/* Langue accessible à tous, même sans compte (issue #37). */}
          <LanguageSelect compact tone={onNight ? "onNight" : "default"} />
          <Link
            to="/login"
            className={buttonClasses(
              "ghost",
              "sm",
              cn(
                "hidden whitespace-nowrap md:inline-flex",
                onNight && "focus-ring-on-night text-white hover:bg-white/10",
              ),
            )}
          >
            {t("app.login")}
          </Link>
          <Link
            to="/barbers"
            className={buttonClasses(
              "primary",
              "sm",
              cn("hidden whitespace-nowrap md:inline-flex", onNight && "shadow-cta"),
            )}
          >
            {t("nav.book")}
          </Link>
          <button
            type="button"
            aria-label={t("nav.openMenu")}
            aria-expanded={menuOpen}
            aria-haspopup="dialog"
            onClick={() => setMenuOpen(true)}
            className={buttonClasses(
              "ghost",
              "icon",
              cn("md:hidden", onNight && "focus-ring-on-night text-white hover:bg-white/10"),
            )}
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
