import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { ROLE_HOME } from "@findbarber/shared/constants";
import { useAuth } from "../../app/auth-context";
import { LanguageSelect } from "../LanguageSelect";
import { Logo } from "../Logo";
import { NotificationBell } from "../NotificationBell";

// Barre des espaces connectés (lot DS-4) : logo, langue et notifications. La
// navigation passe par la barre latérale (desktop) et la barre d'onglets
// (mobile) ; « Mon compte » y figure. Hauteur 4,5 rem.
export function AppHeader() {
  const { t } = useTranslation("common");
  const { user } = useAuth();
  if (!user) return null;
  return (
    <header className="sticky top-0 z-40 h-[4.5rem] border-b border-border bg-surface/95 backdrop-blur">
      <div className="flex h-full items-center justify-between gap-3 px-4 lg:px-6">
        <Link
          to={ROLE_HOME[user.role]}
          aria-label={t("app.homeLink")}
          className="focus-ring inline-flex min-h-11 min-w-11 items-center rounded-lg"
        >
          <Logo />
        </Link>
        <div className="flex min-w-0 items-center gap-2">
          {/* Langue accessible à tous (issue #37) ; le thème se choisit dans
              Paramètres (issue #30). */}
          <LanguageSelect compact />
          {/* L'API des notifications est réservée aux CLIENT et BARBER. */}
          {user.role !== "ADMIN" && <NotificationBell />}
        </div>
      </div>
    </header>
  );
}
