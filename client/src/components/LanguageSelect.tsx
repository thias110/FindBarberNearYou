import { useId } from "react";
import { useTranslation } from "react-i18next";
import { LOCALES, LOCALE_NAMES, type Locale } from "@findbarber/shared/constants";
import { useLocale } from "../app/locale-context";
import { isLocale } from "../i18n";
import { cn } from "../lib/cn";
import { Select } from "./ui/Select";

// Sélecteur de langue (issues #32, #37, #38) : même état partout (header,
// Paramètres, inscription). Chaque langue est écrite dans sa propre langue et
// porte son attribut `lang` pour être bien prononcée par un lecteur d'écran.
export function LanguageSelect({
  compact = false,
  tone = "default",
  className,
}: {
  /** Version header : libellé masqué visuellement, pilule compacte. */
  compact?: boolean;
  /** Ton « nuit » pour la barre flottante posée sur le hero sombre. */
  tone?: "default" | "onNight";
  className?: string;
}) {
  const { t } = useTranslation("common");
  const { locale, setLocale } = useLocale();
  const id = useId();

  const handleChange = (next: string) => {
    if (isLocale(next)) void setLocale(next as Locale);
  };

  return (
    <div className={cn(compact ? "shrink-0" : "space-y-1.5", className)}>
      <label
        htmlFor={id}
        className={
          compact ? "sr-only" : "block text-sm font-semibold text-foreground"
        }
      >
        {t("language.label")}
      </label>
      {compact ? (
        <select
          id={id}
          value={locale}
          onChange={(event) => handleChange(event.target.value)}
          className={cn(
            "block min-h-11 w-auto cursor-pointer rounded-full border px-3 py-1.5 text-sm font-semibold",
            tone === "onNight"
              ? "focus-ring-on-night border-white/20 bg-night/80 text-white hover:border-white/35 hover:bg-night"
              : "focus-ring border-border-strong bg-surface text-foreground hover:bg-surface-muted",
          )}
        >
          {LOCALES.map((code) => (
            <option
              key={code}
              value={code}
              lang={code}
              className="bg-surface text-foreground"
            >
              {code.toUpperCase()}
            </option>
          ))}
        </select>
      ) : (
        <Select
          id={id}
          value={locale}
          onChange={(event) => handleChange(event.target.value)}
        >
          {LOCALES.map((code) => (
            <option key={code} value={code} lang={code}>
              {LOCALE_NAMES[code]}
            </option>
          ))}
        </Select>
      )}
    </div>
  );
}
