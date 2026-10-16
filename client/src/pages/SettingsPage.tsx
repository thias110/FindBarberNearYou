import { Link } from "react-router-dom";
import { useAuth } from "../app/auth-context";
import { useTheme } from "../app/theme-context";
import { DataExport } from "../components/account/DataExport";
import { useScrollToHash } from "../lib/useScrollToHash";
import { themeIcon, themeOptions } from "../components/themeOptions";
import { buttonClasses } from "../components/ui/buttonStyles";
import { Card } from "../components/ui/Card";
import { LanguageSelect } from "../components/LanguageSelect";
import { useTranslation } from "react-i18next";
import { PageContainer } from "../components/ui/PageContainer";

// Paramètres (issue #29) : préférences regroupées par section, dont l'export
// des données (issue #31). Ouvert aux CLIENT et BARBER, comme Mon compte. Les sections portent un `id` pour y
// renvoyer directement (ex. /settings#confidentialite).
export function SettingsPage() {
  const { user } = useAuth();
  const { theme, setTheme } = useTheme();
  const { t } = useTranslation("common");
  useScrollToHash();

  if (!user) return null;

  return (
    <div className="min-h-screen bg-background p-4 sm:p-8">
      <PageContainer width="reading">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-extrabold text-foreground sm:text-3xl">
              {t("settings.title")}
            </h1>
            <p className="mt-1 text-sm text-foreground-muted">
              {t("settings.subtitle")}
            </p>
          </div>
          <Link to="/account" className={buttonClasses("ghost", "md", "shrink-0")}>
            {t("settings.accountLink")}
          </Link>
        </div>

        <section
          id="apparence"
          aria-labelledby="apparence-title"
          className="scroll-mt-4 focus:outline-none"
        >
          <Card className="space-y-4 p-6">
            <div>
              <h2
                id="apparence-title"
                className="text-lg font-bold text-foreground"
              >
                {t("settings.appearance.title")}
              </h2>
              <p className="mt-1 text-sm text-foreground-muted">
                {t("settings.appearance.description")}
              </p>
            </div>
            <fieldset>
              <legend className="sr-only">{t("settings.appearance.legend")}</legend>
              <div className="grid gap-3 sm:grid-cols-3">
                {themeOptions().map((option) => {
                  const nameId = `theme-${option.value}-name`;
                  const descriptionId = `theme-${option.value}-description`;
                  return (
                    <label
                      key={option.value}
                      className={
                        "flex cursor-pointer flex-col gap-3 rounded-xl border border-border-strong bg-surface p-4 transition-colors hover:bg-surface-muted " +
                        "has-[:checked]:border-accent has-[:checked]:bg-accent-soft " +
                        "has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-accent " +
                        "has-[:focus-visible]:ring-offset-2 has-[:focus-visible]:ring-offset-background"
                      }
                    >
                      <span className="flex items-center justify-between gap-2">
                        <span className="grid h-10 w-10 place-items-center rounded-full bg-surface-muted text-foreground">
                          {themeIcon(option.value, "h-5 w-5")}
                        </span>
                        <input
                          type="radio"
                          name="theme"
                          value={option.value}
                          checked={theme === option.value}
                          onChange={() => setTheme(option.value)}
                          aria-labelledby={nameId}
                          aria-describedby={descriptionId}
                          className="h-5 w-5 shrink-0 focus-visible:outline-none"
                        />
                      </span>
                      <span>
                        <span
                          id={nameId}
                          className="block font-semibold text-foreground"
                        >
                          {option.shortLabel}
                        </span>
                        <span
                          id={descriptionId}
                          className="mt-0.5 block text-sm text-foreground-muted"
                        >
                          {option.description}
                        </span>
                      </span>
                    </label>
                  );
                })}
              </div>
            </fieldset>
          </Card>
        </section>

        <section
          id="langue"
          aria-labelledby="langue-title"
          className="scroll-mt-4 focus:outline-none"
        >
          <Card className="space-y-4 p-6">
            <div>
              <h2 id="langue-title" className="text-lg font-bold text-foreground">
                {t("settings.language.title")}
              </h2>
              <p className="mt-1 text-sm text-foreground-muted">
                {t("settings.language.description")}
              </p>
            </div>
            <LanguageSelect className="max-w-xs" />
          </Card>
        </section>

        <section
          id="confidentialite"
          aria-labelledby="confidentialite-title"
          className="scroll-mt-4 focus:outline-none"
        >
          <Card className="space-y-5 p-6">
            <h2
              id="confidentialite-title"
              className="text-lg font-bold text-foreground"
            >
              {t("settings.privacy.title")}
            </h2>
            <div className="space-y-2">
              <h3 className="font-semibold text-foreground">
                {t("settings.privacy.dataTitle")}
              </h3>
              <DataExport role={user.role} />
            </div>
            <p className="border-t border-border pt-4 text-sm text-foreground-muted">
              {t("settings.privacy.deleteTextBefore")}{" "}
              <Link
                to="/account"
                className="font-medium text-accent-strong underline underline-offset-2"
              >
                {t("settings.privacy.deleteLink")}
              </Link>
              {t("settings.privacy.deleteTextAfter")}
            </p>
          </Card>
        </section>
      </PageContainer>
    </div>
  );
}
