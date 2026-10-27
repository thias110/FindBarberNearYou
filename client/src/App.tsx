import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useLocation } from "react-router-dom";
import { useAuth } from "./app/auth-context";
import { AuthProvider } from "./app/AuthProvider";
import { FavoritesProvider } from "./app/FavoritesProvider";
import { LocaleProvider } from "./app/LocaleProvider";
import { ThemeProvider } from "./app/ThemeProvider";
import { AppRoutes } from "./app/router";
import { AppHeader } from "./components/nav/AppHeader";
import { AppSidebar } from "./components/nav/AppSidebar";
import { BottomTabBar, TAB_BAR_PADDING } from "./components/nav/BottomTabBar";
import { PublicHeader } from "./components/nav/PublicHeader";
import { SiteFooter } from "./components/SiteFooter";
import { cn } from "./lib/cn";
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

  // Espaces connectés CLIENT et BARBER : barre latérale (desktop) et barre
  // d'onglets (mobile). L'ADMIN garde sa propre navigation (AdminLayout).
  const appRole = user && user.role !== "ADMIN" ? user.role : null;

  return (
    <div className={cn("bg-background text-foreground", appRole && TAB_BAR_PADDING)}>
      <a
        href="#contenu"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-accent focus:px-4 focus:py-3 focus:text-sm focus:font-medium focus:text-accent-foreground focus:shadow-2"
      >
        {t("app.skipToContent")}
      </a>
      {user ? <AppHeader /> : <PublicHeader />}
      <div className={appRole ? "lg:flex" : undefined}>
        {appRole && <AppSidebar role={appRole} />}
        <main
          id="contenu"
          ref={mainRef}
          tabIndex={-1}
          className="min-w-0 flex-1 focus:outline-none"
        >
          <AppRoutes />
        </main>
      </div>
      <SiteFooter />
      {appRole && <BottomTabBar role={appRole} />}
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <LocaleProvider>
          <FavoritesProvider>
            <AppShell />
          </FavoritesProvider>
        </LocaleProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
