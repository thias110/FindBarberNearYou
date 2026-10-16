import { createContext, useContext } from "react";
import type { Locale } from "@findbarber/shared/constants";

export interface LocaleContextValue {
  locale: Locale;
  /** Change la langue : interface immédiate, mémorisée dans le navigateur et,
   * si l'utilisateur est connecté, enregistrée sur son compte (emails). */
  setLocale: (locale: Locale) => Promise<void>;
}

export const LocaleContext = createContext<LocaleContextValue | undefined>(
  undefined,
);

export function useLocale(): LocaleContextValue {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error("useLocale must be used within LocaleProvider");
  return ctx;
}
