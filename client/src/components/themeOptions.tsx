import type { ReactNode } from "react";
import type { ThemePreference } from "../app/theme-context";
import i18n from "../i18n";

// Options de thème de la page Paramètres (issue #29). Depuis l'issue #30, le
// thème ne se choisit plus dans le header. Libellés traduits
// (`common:theme.*`) : à appeler au rendu, dans un composant qui utilise
// `useTranslation`, pour suivre le changement de langue.

export interface ThemeOption {
  value: ThemePreference;
  /** Libellé complet (aria-label du header). */
  label: string;
  /** Libellé court (tuiles de la page Paramètres). */
  shortLabel: string;
  description: string;
}

const THEME_VALUES: ThemePreference[] = ["system", "light", "dark"];

export function themeOptions(): ThemeOption[] {
  return THEME_VALUES.map((value) => ({
    value,
    label: i18n.t(`common:theme.${value}.label`),
    shortLabel: i18n.t(`common:theme.${value}.short`),
    description: i18n.t(`common:theme.${value}.description`),
  }));
}

const ICON_PATHS: Record<ThemePreference, ReactNode> = {
  system: (
    <>
      <rect x="3" y="4" width="18" height="12" rx="2" />
      <path d="M8 20h8M12 16v4" />
    </>
  ),
  light: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </>
  ),
  dark: <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />,
};

/** Icône décorative du thème (aria-hidden : le libellé porte le sens). */
export function themeIcon(value: ThemePreference, className = "h-4 w-4") {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {ICON_PATHS[value]}
    </svg>
  );
}
