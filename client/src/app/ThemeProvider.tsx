import { useCallback, useEffect, useState, type ReactNode } from "react";
import {
  ThemeContext,
  type ResolvedTheme,
  type ThemePreference,
} from "./theme-context";

export const THEME_STORAGE_KEY = "fb-theme";

const COLOR_SCHEME_QUERY = "(prefers-color-scheme: dark)";

function readStoredTheme(): ThemePreference {
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === "light" || stored === "dark" || stored === "system") {
      return stored;
    }
  } catch {
    // localStorage indisponible (mode privé) : préférence par défaut.
  }
  return "system";
}

function systemPrefersDark(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia(COLOR_SCHEME_QUERY).matches
  );
}

function resolveTheme(
  preference: ThemePreference,
  prefersDark: boolean,
): ResolvedTheme {
  if (preference === "system") return prefersDark ? "dark" : "light";
  // Le choix manuel light/dark est prioritaire sur le thème système.
  return preference;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemePreference>(() =>
    readStoredTheme(),
  );
  const [prefersDark, setPrefersDark] = useState<boolean>(() =>
    systemPrefersDark(),
  );

  const resolvedTheme = resolveTheme(theme, prefersDark);

  // Suit les changements du thème système (utile quand theme === "system").
  useEffect(() => {
    const media = window.matchMedia(COLOR_SCHEME_QUERY);
    const onChange = (event: MediaQueryListEvent) =>
      setPrefersDark(event.matches);
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  // Applique la classe `dark` sur <html> (cf. script anti-flash index.html).
  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", resolvedTheme === "dark");
    root.style.colorScheme = resolvedTheme;
  }, [resolvedTheme]);

  const setTheme = useCallback((next: ThemePreference) => {
    setThemeState(next);
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // Persistance impossible : le thème reste appliqué pour la session.
    }
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}
