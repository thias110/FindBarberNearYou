import type { ReactNode } from "react";
import type { ThemePreference } from "../app/theme-context";

// Options de thème partagées par le sélecteur du header (ThemeToggle) et la
// page Paramètres (issue #29).

export interface ThemeOption {
  value: ThemePreference;
  /** Libellé complet (aria-label du header). */
  label: string;
  /** Libellé court (tuiles de la page Paramètres). */
  shortLabel: string;
  description: string;
}

export const THEME_OPTIONS: ThemeOption[] = [
  {
    value: "system",
    label: "Thème système",
    shortLabel: "Système",
    description: "Suit le réglage clair ou sombre de votre appareil.",
  },
  {
    value: "light",
    label: "Thème clair",
    shortLabel: "Clair",
    description: "Fond blanc, en toutes circonstances.",
  },
  {
    value: "dark",
    label: "Thème sombre",
    shortLabel: "Sombre",
    description: "Fond bleu nuit, plus doux le soir.",
  },
];

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
