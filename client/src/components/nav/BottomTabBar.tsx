import { useTranslation } from "react-i18next";
import { NavLink } from "react-router-dom";
import { cn } from "../../lib/cn";
import { NavIcon } from "./NavIcon";
import { TAB_ITEMS, type AppRole } from "./navItems";

// Hauteur de la barre (sans la zone de sécurité) : l'enveloppe de page réserve
// cet espace pour que rien ne passe dessous.
export const TAB_BAR_PADDING = "pb-[calc(4rem+env(safe-area-inset-bottom))] lg:pb-0";

// Barre d'onglets mobile des espaces connectés (lot DS-4, plan §2.6.6) :
// 64 px + zone de sécurité, cibles d'au moins 48 × 48 px. Onglet actif : icône
// pleine, libellé `accent-strong` 600, `aria-current="page"`.
export function BottomTabBar({ role }: { role: AppRole }) {
  const { t } = useTranslation(["common", "barber"]);
  return (
    <nav
      aria-label={t("common:nav.tabs")}
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
    >
      <ul className="mx-auto flex h-16 max-w-[35rem] items-stretch">
        {TAB_ITEMS[role].map((item) => (
          <li key={item.to} className="flex flex-1">
            <NavLink
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  "focus-ring-inset flex min-h-12 min-w-12 flex-1 flex-col items-center justify-center gap-0.5 rounded-lg text-xs leading-tight",
                  isActive
                    ? "font-semibold text-accent-strong"
                    : "font-medium text-foreground-muted",
                )
              }
            >
              {({ isActive }) => (
                <>
                  <NavIcon name={item.icon} active={isActive} />
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
