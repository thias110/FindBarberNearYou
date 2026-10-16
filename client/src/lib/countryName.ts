import { COUNTRY_NAME_BY_CODE } from "@findbarber/shared/countries";
import i18n, { intlLocale } from "../i18n";

// Nom du pays dans la langue courante (Intl) ; référence française en
// français ou si Intl ne connaît pas le code.
export function localizedCountryName(code: string): string {
  const french =
    COUNTRY_NAME_BY_CODE[code as keyof typeof COUNTRY_NAME_BY_CODE] ?? code;
  if (i18n.language.startsWith("fr")) return french;
  try {
    return (
      new Intl.DisplayNames([intlLocale()], { type: "region" }).of(code) ??
      french
    );
  } catch {
    return french;
  }
}
