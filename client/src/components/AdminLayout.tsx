import type { ReactNode } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../app/auth-context";

const NAV_ITEMS: { to: string; label: string; end?: boolean }[] = [
  { to: "/admin", label: "Tableau de bord", end: true },
  { to: "/admin/users", label: "Utilisateurs" },
  { to: "/admin/bookings", label: "Réservations" },
  { to: "/admin/reviews", label: "Avis" },
];

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
    <div className="min-h-screen bg-brand-50 p-4 sm:p-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold text-brand-900">Espace admin</h1>
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm text-gray-600">{user?.email}</span>
            <button
              type="button"
              onClick={handleLogout}
              className="rounded-lg bg-brand-700 px-4 py-2 text-white"
            >
              Se déconnecter
            </button>
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
                `rounded-lg px-3 py-1.5 text-sm ${
                  isActive
                    ? "bg-brand-700 text-white"
                    : "border border-gray-300 text-gray-700"
                }`
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
