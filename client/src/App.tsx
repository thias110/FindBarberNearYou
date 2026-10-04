import { useLocation } from "react-router-dom";
import { AuthProvider } from "./app/AuthProvider";
import { ThemeProvider } from "./app/ThemeProvider";
import { AppRoutes } from "./app/router";
import { Logo } from "./components/Logo";
import { ThemeToggle } from "./components/ThemeToggle";

// Sur ces routes, la coque AuthLayout porte elle-même Logo + ThemeToggle :
// le header global ne doit donc pas être rendu (aucun doublon).
const AUTH_ROUTES = new Set(["/login", "/register"]);

export default function App() {
  const { pathname } = useLocation();
  const isAuthRoute = AUTH_ROUTES.has(pathname);

  return (
    <ThemeProvider>
      <AuthProvider>
        <div className="bg-background text-foreground">
          {!isAuthRoute && (
            <header className="border-b border-border bg-surface">
              <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-3 px-4 py-3">
                <Logo />
                <ThemeToggle />
              </div>
            </header>
          )}
          <AppRoutes />
        </div>
      </AuthProvider>
    </ThemeProvider>
  );
}
