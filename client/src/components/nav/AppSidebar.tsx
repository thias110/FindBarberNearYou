import { useTranslation } from "react-i18next";
import { NavLink } from "react-router-dom";
import { cn } from "../../lib/cn";
import { NavIcon } from "./NavIcon";
import { SIDEBAR_ITEMS, type AppRole } from "./navItems";

// Barre latérale des espaces connectés (lot DS-4, plan §2.6.6), à partir de
// `lg:`. Entrée active : fond `accent-soft`, texte `accent-strong`, barre de
// 3 px à gauche, `aria-current="page"` (posé par NavLink).
export function AppSidebar({ role }: { role: AppRole }) {
  const { t } = useTranslation(["common", "barber"]);
  return (
    <nav
      aria-label={t("common:nav.appNav")}
      className="hidden w-[15.5rem] shrink-0 border-r border-border bg-surface lg:block"
    >
      <ul className="sticky top-[4.5rem] space-y-1 p-3">
        {SIDEBAR_ITEMS[role].map((item) => (
          <li key={item.to}>
            <NavLink
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  "focus-ring relative flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-semibold transition-colors duration-fast",
                  isActive
                    ? "bg-accent-soft text-accent-strong before:absolute before:inset-y-2 before:left-0 before:w-[3px] before:rounded-full before:bg-accent-strong"
                    : "text-foreground-muted hover:bg-surface-muted hover:text-foreground",
                )
              }
            >
              {({ isActive }) => (
                <>
                  <NavIcon name={item.icon} active={isActive} className="h-5 w-5" />
                  {t(item.label)}
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
