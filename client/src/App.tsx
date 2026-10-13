import { useLocation } from "react-router-dom";
import { useAuth } from "./app/auth-context";
import { AuthProvider } from "./app/AuthProvider";
import { ThemeProvider } from "./app/ThemeProvider";
import { AppRoutes } from "./app/router";
import { Logo } from "./components/Logo";
import { NotificationBell } from "./components/NotificationBell";
import { ThemeToggle } from "./components/ThemeToggle";

// Sur ces routes, la coque AuthLayout porte elle-même Logo + ThemeToggle :
// le header global ne doit donc pas être rendu (aucun doublon).
const AUTH_ROUTES = new Set(["/login", "/register"]);

function AppShell() {
  const { pathname } = useLocation();
  const { user } = useAuth();
  const isAuthRoute = AUTH_ROUTES.has(pathname);

  return (
    <div className="bg-background text-foreground">
      {!isAuthRoute && (
        <header className="border-b border-border bg-surface">
          <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-3 px-4 py-3">
            <Logo />
            <div className="flex items-center gap-2">
              <ThemeToggle />
              {user && <NotificationBell />}
            </div>
          </div>
        </header>
      )}
      <AppRoutes />
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppShell />
      </AuthProvider>
    </ThemeProvider>
  );
}
