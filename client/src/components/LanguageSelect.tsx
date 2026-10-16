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
  className,
}: {
  /** Version header : libellé masqué visuellement, largeur réduite. */
  compact?: boolean;
  className?: string;
}) {
  const { t } = useTranslation("common");
  const { locale, setLocale } = useLocale();
  const id = useId();

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
      <Select
        id={id}
        value={locale}
        onChange={(event) => {
          const next = event.target.value;
          if (isLocale(next)) void setLocale(next as Locale);
        }}
        className={compact ? "w-auto py-1.5 pl-2 pr-8 text-sm" : undefined}
      >
        {LOCALES.map((code) => (
          <option key={code} value={code} lang={code}>
            {compact ? code.toUpperCase() : LOCALE_NAMES[code]}
          </option>
        ))}
      </Select>
    </div>
  );
}
