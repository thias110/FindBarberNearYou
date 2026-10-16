import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import {
  DEFAULT_LOCALE,
  LOCALE_INTL_TAGS,
  LOCALES,
  type Locale,
} from "@findbarber/shared/constants";

// Multilingue (issue #32). Les traductions sont des fichiers JSON par langue
// et par espace de noms : `locales/<langue>/<espace>.json`. Ils sont chargés
// automatiquement ; ajouter un écran revient à ajouter un fichier.
//
// Le français est la langue par défaut ET la langue de repli : une clé absente
// en EN/IT/ES affiche le texte français, jamais la clé brute.

const files = import.meta.glob<{ default: Record<string, unknown> }>(
  "./locales/*/*.json",
  { eager: true },
);

const resources: Record<string, Record<string, Record<string, unknown>>> = {};
for (const [path, module] of Object.entries(files)) {
  const match = path.match(/\.\/locales\/([a-z]{2})\/([\w-]+)\.json$/);
  if (!match) continue;
  const [, lng, ns] = match;
  resources[lng] ??= {};
  resources[lng][ns] = module.default;
}

export const STORAGE_KEY = "findbarber.locale";

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

/** Langue mémorisée dans ce navigateur (visiteur), sinon le français. */
export function storedLocale(): Locale {
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    return isLocale(value) ? value : DEFAULT_LOCALE;
  } catch {
    return DEFAULT_LOCALE;
  }
}

export function rememberLocale(locale: Locale): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, locale);
  } catch {
    // Stockage indisponible (navigation privée) : la langue vaut pour la session.
  }
}

/** Balise Intl de la langue courante, pour dates, heures et montants. */
export function intlLocale(): string {
  const lng = i18n.resolvedLanguage ?? i18n.language;
  return LOCALE_INTL_TAGS[isLocale(lng) ? lng : DEFAULT_LOCALE];
}

void i18n.use(initReactI18next).init({
  resources,
  lng: storedLocale(),
  fallbackLng: DEFAULT_LOCALE,
  supportedLngs: [...LOCALES],
  defaultNS: "common",
  fallbackNS: "common",
  ns: Object.keys(resources[DEFAULT_LOCALE] ?? { common: {} }),
  interpolation: { escapeValue: false }, // React échappe déjà.
  returnNull: false,
  returnEmptyString: false,
});

function syncDocument(lng: string): void {
  if (typeof document !== "undefined") document.documentElement.lang = lng;
}
syncDocument(i18n.language);
i18n.on("languageChanged", syncDocument);

export default i18n;
