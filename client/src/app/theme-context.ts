import { createContext, useContext } from "react";

// Préférence utilisateur persistée dans localStorage (clé `fb-theme`).
export type ThemePreference = "system" | "light" | "dark";

// Thème réellement appliqué (system résolu via prefers-color-scheme).
export type ResolvedTheme = "light" | "dark";

export interface ThemeContextValue {
  /** Préférence choisie : system, light ou dark. */
  theme: ThemePreference;
  /** Thème effectif appliqué à <html>. */
  resolvedTheme: ResolvedTheme;
  /** Change la préférence (persistée dans localStorage). */
  setTheme: (theme: ThemePreference) => void;
}

export const ThemeContext = createContext<ThemeContextValue | undefined>(
  undefined,
);

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return ctx;
}
