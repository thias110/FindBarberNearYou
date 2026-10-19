import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import type { ProfileCompletionStep } from "@findbarber/shared/constants";
import type { ProfileCompletion } from "@findbarber/shared/types";
import { cn } from "../../lib/cn";
import { Alert } from "../ui/Alert";
import { Card } from "../ui/Card";

// Écran qui permet de compléter chaque étape (routes BARBER existantes).
// Titre et consigne : `checklist.steps.<ÉTAPE>.title` / `.todo` (espace barber).
const STEP_ROUTES: Record<ProfileCompletionStep, string> = {
  AVATAR: "/pro/dashboard#photo-profil",
  PROFILE: "/pro/profile",
  SERVICES: "/pro/services",
  WORKING_HOURS: "/pro/working-hours",
  GALLERY: "/pro/gallery",
};

function StepIcon({ done }: { done: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs font-bold",
        done
          ? "border-success bg-success/15 text-success"
          : "border-border bg-surface text-foreground-muted",
      )}
    >
      {done ? "✓" : ""}
    </span>
  );
}

/**
 * Checklist de finalisation du profil (issue #42). La progression vient du
 * serveur (propriétaire uniquement) ; chaque étape mène à l'écran qui la
 * complète. Présentation pure : le chargement est géré par la page.
 */
export function ProfileChecklist({ completion }: { completion: ProfileCompletion }) {
  const { t } = useTranslation("barber");
  if (completion.complete) {
    return (
      <Alert variant="success">
        {t("checklist.complete")}
      </Alert>
    );
  }

  return (
    <Card className="p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-h3 font-bold text-foreground">
          {t("checklist.title")}
        </h2>
        <p className="text-sm text-foreground-muted">
          {t("checklist.progress", {
            done: completion.completedCount,
            total: completion.totalCount,
          })}
        </p>
      </div>
      <div
        role="progressbar"
        aria-label={t("checklist.progressLabel")}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={completion.percent}
        aria-valuetext={t("checklist.percent", { percent: completion.percent })}
        className="mt-3 h-2 overflow-hidden rounded-full bg-surface-muted"
      >
        <div
          className="h-full rounded-full bg-accent transition-[width]"
          style={{ width: `${completion.percent}%` }}
        />
      </div>
      <p className="mt-1 text-right text-xs font-semibold text-foreground">
        {t("checklist.percent", { percent: completion.percent })}
      </p>
      <ol className="mt-3 space-y-2">
        {completion.steps.map(({ step, done }) => {
          return (
            <li key={step}>
              <Link
                to={STEP_ROUTES[step]}
                className={cn(
                  "flex min-h-11 items-center gap-3 rounded-xl border border-border p-3",
                  "transition-colors hover:border-accent/60",
                  "focus-ring",
                )}
              >
                <StepIcon done={done} />
                <span className="min-w-0">
                  <span
                    className={cn(
                      "block text-sm font-semibold",
                      done ? "text-foreground-muted line-through" : "text-foreground",
                    )}
                  >
                    {t(`checklist.steps.${step}.title`)}
                  </span>
                  {!done && (
                    <span className="block text-xs text-foreground-muted">
                      {t(`checklist.steps.${step}.todo`)}
                    </span>
                  )}
                </span>
                <span className="sr-only">
                  {done ? t("checklist.done") : t("checklist.todo")}
                </span>
              </Link>
            </li>
          );
        })}
      </ol>
    </Card>
  );
}
