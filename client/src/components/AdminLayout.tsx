import type { ReactNode } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../app/auth-context";
import { cn } from "../lib/cn";
import { Button } from "./ui/Button";

const NAV_ITEMS: { to: string; label: string; end?: boolean }[] = [
  { to: "/admin", label: "Tableau de bord", end: true },
  { to: "/admin/users", label: "Utilisateurs" },
  { to: "/admin/bookings", label: "Réservations" },
  { to: "/admin/reviews", label: "Avis" },
];

// Base commune des liens de navigation : cible tactile >= 44px, focus clavier
// visible et transition douce. Les états actif/inactif sont ajoutés par le
// NavLink et pilotés par les tokens sémantiques (jamais de couleurs en dur).
const NAV_LINK_BASE =
  "inline-flex min-h-[44px] items-center justify-center rounded-lg px-4 text-sm " +
  "font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 " +
  "focus-visible:ring-accent focus-visible:ring-offset-2 " +
  "focus-visible:ring-offset-background";

// Coque commune des pages d'administration : en-tête, navigation et logout.
// L'autorisation reste portée par RequireRole + le serveur, pas par ce layout.
export function AdminLayout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate("/login", { replace: true });
  }

  return (
    <div className="min-h-screen bg-background p-4 sm:p-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold text-foreground">Espace admin</h1>
          <div className="flex flex-wrap items-center gap-3">
            <span className="min-w-0 break-all text-sm text-foreground-muted">
              {user?.email}
            </span>
            <Button
              variant="primary"
              onClick={handleLogout}
              className="min-h-[44px]"
            >
              Se déconnecter
            </Button>
          </div>
        </header>

        <nav
          aria-label="Navigation administration"
          className="flex flex-wrap gap-2"
        >
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  NAV_LINK_BASE,
                  isActive
                    ? "bg-accent text-accent-foreground hover:bg-accent-hover"
                    : "border border-border bg-surface text-foreground hover:bg-surface-muted",
                )
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        {children}
      </div>
    </div>
  );
}
