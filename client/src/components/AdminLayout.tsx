import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../app/auth-context";
import { cn } from "../lib/cn";
import { Button } from "./ui/Button";

// `key` : clé de traduction `admin:layout.nav.<key>`.
const NAV_ITEMS: { to: string; key: string; end?: boolean }[] = [
  { to: "/admin", key: "dashboard", end: true },
  { to: "/admin/users", key: "users" },
  { to: "/admin/bookings", key: "bookings" },
  { to: "/admin/reviews", key: "reviews" },
  { to: "/admin/audit", key: "audit" },
];

// Base commune des liens de navigation : cible tactile >= 44px, focus clavier
// visible et transition douce. Les états actif/inactif sont ajoutés par le
// NavLink et pilotés par les tokens sémantiques (jamais de couleurs en dur).
// Issue #28 : onglets en pilule, actif en bleu doux, pour ne pas se confondre
// avec les filtres (contour, sélection en noir).
const NAV_LINK_BASE =
  "inline-flex min-h-[44px] items-center justify-center rounded-full px-4 text-sm " +
  "font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 " +
  "focus-visible:ring-accent focus-visible:ring-offset-2 " +
  "focus-visible:ring-offset-background";

// Coque commune des pages d'administration : en-tête, navigation et logout.
// L'autorisation reste portée par RequireRole + le serveur, pas par ce layout.
export function AdminLayout({ children }: { children: ReactNode }) {
  const { t } = useTranslation("admin");
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
          <h1 className="text-2xl sm:text-3xl font-extrabold text-foreground">
            {t("layout.title")}
          </h1>
          <div className="flex flex-wrap items-center gap-3">
            <span className="min-w-0 break-all text-sm text-foreground-muted">
              {user?.email}
            </span>
            <Button
              variant="secondary"
              onClick={handleLogout}
              className="min-h-[44px]"
            >
              {t("layout.logout")}
            </Button>
          </div>
        </header>

        <nav
          aria-label={t("layout.navLabel")}
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
                    ? "bg-accent-soft text-accent-strong"
                    : "text-foreground-muted hover:bg-surface-muted hover:text-foreground",
                )
              }
            >
              {t(`layout.nav.${item.key}`)}
            </NavLink>
          ))}
        </nav>

        {children}
      </div>
    </div>
  );
}
