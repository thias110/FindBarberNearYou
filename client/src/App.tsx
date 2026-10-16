import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Link, useLocation } from "react-router-dom";
import { ROLE_HOME } from "@findbarber/shared/constants";
import { useAuth } from "./app/auth-context";
import { AuthProvider } from "./app/AuthProvider";
import { LocaleProvider } from "./app/LocaleProvider";
import { ThemeProvider } from "./app/ThemeProvider";
import { AppRoutes } from "./app/router";
import { Logo } from "./components/Logo";
import { NotificationBell } from "./components/NotificationBell";
import { SiteFooter } from "./components/SiteFooter";
import { LanguageSelect } from "./components/LanguageSelect";
import { buttonClasses } from "./components/ui/buttonStyles";
import { AUTH_ROUTES, pageTitle } from "./lib/pageTitle";

function AppShell() {
  const { pathname } = useLocation();
  const { user } = useAuth();
  const isAuthRoute = AUTH_ROUTES.has(pathname);
  const mainRef = useRef<HTMLElement>(null);
  const previousPathRef = useRef(pathname);
  const { t, i18n } = useTranslation("common");
  const language = i18n.language;

  // Titre du document par route (les pages d'auth posent le leur), mis à jour
  // aussi au changement de langue.
  useEffect(() => {
    const title = pageTitle(pathname);
    if (title) document.title = title;
  }, [pathname, language]);

  // Navigation SPA : le focus revient au contenu principal, comme lors d'un
  // chargement de page (lecteurs d'écran et clavier).
  useEffect(() => {
    if (previousPathRef.current === pathname) return;
    previousPathRef.current = pathname;
    mainRef.current?.focus({ preventScroll: true });
  }, [pathname]);

  if (isAuthRoute) {
    // AuthLayout porte son propre header et son <main>.
    return (
      <div className="bg-background text-foreground">
        <AppRoutes />
      </div>
    );
  }

  return (
    <div className="bg-background text-foreground">
      <a
        href="#contenu"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-accent focus:px-4 focus:py-3 focus:text-sm focus:font-medium focus:text-accent-foreground focus:shadow-card"
      >
        {t("app.skipToContent")}
      </a>
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-3 px-4 py-3">
          <Link
            to={user ? ROLE_HOME[user.role] : "/"}
            aria-label={t("app.homeLink")}
            className="inline-flex min-h-11 min-w-11 items-center rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            <Logo />
          </Link>
          <div className="flex min-w-0 items-center gap-2">
            {/* Langue accessible à tous, même sans compte (issue #37). */}
            <LanguageSelect compact />
            {/* Le thème se choisit dans Paramètres (issue #30). */}
            {/* L'API des notifications est réservée aux CLIENT et BARBER. */}
            {user && user.role !== "ADMIN" && <NotificationBell />}
            {user && user.role !== "ADMIN" && (
              <Link
                to="/account"
                className={buttonClasses("ghost", "sm", "whitespace-nowrap")}
              >
                {t("app.account")}
              </Link>
            )}
            {!user && (
              <Link
                to="/login"
                className={buttonClasses("ghost", "sm", "whitespace-nowrap")}
              >
                {t("app.login")}
              </Link>
            )}
          </div>
        </div>
      </header>
      <main
        id="contenu"
        ref={mainRef}
        tabIndex={-1}
        className="focus:outline-none"
      >
        <AppRoutes />
      </main>
      <SiteFooter />
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <LocaleProvider>
          <AppShell />
        </LocaleProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
