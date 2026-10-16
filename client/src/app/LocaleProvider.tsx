import { useCallback, useEffect, useState, type ReactNode } from "react";
import type { Locale } from "@findbarber/shared/constants";
import i18n, { isLocale, rememberLocale, storedLocale } from "../i18n";
import { userApi } from "../lib/apiClient";
import { useAuth } from "./auth-context";
import { LocaleContext } from "./locale-context";

// Langue courante (issue #32). Visiteur : celle mémorisée dans le navigateur
// (français par défaut). Utilisateur connecté : celle de son compte, qui fait
// foi (elle sert aussi pour ses emails).
export function LocaleProvider({ children }: { children: ReactNode }) {
  const { user, updateUser } = useAuth();
  const [locale, setLocaleState] = useState<Locale>(storedLocale);

  const apply = useCallback((next: Locale) => {
    setLocaleState(next);
    rememberLocale(next);
    if (i18n.language !== next) void i18n.changeLanguage(next);
  }, []);

  // À la connexion (ou au rechargement), la langue du compte s'applique.
  useEffect(() => {
    if (user && isLocale(user.locale)) apply(user.locale);
  }, [user, apply]);

  const setLocale = useCallback(
    async (next: Locale) => {
      apply(next);
      if (user && user.locale !== next) {
        const res = await userApi.updateLocale(next);
        updateUser(res.user);
      }
    },
    [apply, user, updateUser],
  );

  return (
    <LocaleContext.Provider value={{ locale, setLocale }}>
      {children}
    </LocaleContext.Provider>
  );
}
