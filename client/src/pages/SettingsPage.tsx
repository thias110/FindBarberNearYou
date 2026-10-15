import { Link } from "react-router-dom";
import { useAuth } from "../app/auth-context";
import { useTheme } from "../app/theme-context";
import { DataExport } from "../components/account/DataExport";
import { THEME_OPTIONS, themeIcon } from "../components/themeOptions";
import { buttonClasses } from "../components/ui/buttonStyles";
import { Card } from "../components/ui/Card";

// Paramètres (issue #29) : préférences regroupées par section. Ouvert aux
// CLIENT et BARBER, comme Mon compte. Les sections portent un `id` pour y
// renvoyer directement (ex. /settings#confidentialite).
export function SettingsPage() {
  const { user } = useAuth();
  const { theme, setTheme } = useTheme();

  if (!user) return null;

  return (
    <div className="min-h-screen bg-background p-4 sm:p-8">
      <div className="mx-auto max-w-2xl space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-extrabold text-foreground sm:text-3xl">
              Paramètres
            </h1>
            <p className="mt-1 text-sm text-foreground-muted">
              Vos préférences sur FindBarber.
            </p>
          </div>
          <Link to="/account" className={buttonClasses("ghost", "md", "shrink-0")}>
            Mon compte
          </Link>
        </div>

        <section id="apparence" aria-labelledby="apparence-title">
          <Card className="space-y-4 p-6">
            <div>
              <h2
                id="apparence-title"
                className="text-lg font-bold text-foreground"
              >
                Apparence
              </h2>
              <p className="mt-1 text-sm text-foreground-muted">
                Choisissez l'affichage de FindBarber sur cet appareil.
              </p>
            </div>
            <fieldset>
              <legend className="sr-only">Thème</legend>
              <div className="grid gap-3 sm:grid-cols-3">
                {THEME_OPTIONS.map((option) => {
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

        <section id="confidentialite" aria-labelledby="confidentialite-title">
          <Card className="space-y-5 p-6">
            <h2
              id="confidentialite-title"
              className="text-lg font-bold text-foreground"
            >
              Confidentialité
            </h2>
            <div className="space-y-2">
              <h3 className="font-semibold text-foreground">Mes données</h3>
              <DataExport role={user.role} />
            </div>
            <p className="border-t border-border pt-4 text-sm text-foreground-muted">
              Pour supprimer votre compte, rendez-vous dans{" "}
              <Link
                to="/account"
                className="font-medium text-accent-strong underline underline-offset-2"
              >
                Mon compte
              </Link>
              .
            </p>
          </Card>
        </section>
      </div>
    </div>
  );
}
