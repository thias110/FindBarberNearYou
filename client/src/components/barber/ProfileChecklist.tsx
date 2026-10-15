import { Link } from "react-router-dom";
import type { ProfileCompletionStep } from "@findbarber/shared/constants";
import type { ProfileCompletion } from "@findbarber/shared/types";
import { cn } from "../../lib/cn";
import { Alert } from "../ui/Alert";
import { Card } from "../ui/Card";

// Écran qui permet de compléter chaque étape (routes BARBER existantes).
const STEP_DETAILS: Record<
  ProfileCompletionStep,
  { to: string; title: string; todo: string }
> = {
  PROFILE: {
    to: "/pro/profile",
    title: "Renseigner votre profil",
    todo: "Nom, description, lieux de prestation et localisation.",
  },
  SERVICES: {
    to: "/pro/services",
    title: "Ajouter un service actif",
    todo: "Au moins une prestation avec sa durée et son prix.",
  },
  WORKING_HOURS: {
    to: "/pro/working-hours",
    title: "Définir vos horaires",
    todo: "Au moins une plage de travail dans la semaine.",
  },
  GALLERY: {
    to: "/pro/gallery",
    title: "Publier une photo",
    todo: "Au moins une réalisation dans votre galerie.",
  },
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
  if (completion.complete) {
    return (
      <Alert variant="success">
        Profil complet : toutes les étapes de finalisation sont faites.
      </Alert>
    );
  }

  return (
    <Card className="p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-bold text-foreground">
          Finaliser mon profil
        </h2>
        <p className="text-sm text-foreground-muted">
          {completion.completedCount} sur {completion.totalCount} étapes
        </p>
      </div>
      <div
        role="progressbar"
        aria-label="Progression de la finalisation du profil"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={completion.percent}
        aria-valuetext={`${completion.percent} %`}
        className="mt-3 h-2 overflow-hidden rounded-full bg-surface-muted"
      >
        <div
          className="h-full rounded-full bg-accent transition-[width]"
          style={{ width: `${completion.percent}%` }}
        />
      </div>
      <p className="mt-1 text-right text-xs font-semibold text-foreground">
        {completion.percent} %
      </p>
      <ol className="mt-3 space-y-2">
        {completion.steps.map(({ step, done }) => {
          const details = STEP_DETAILS[step];
          return (
            <li key={step}>
              <Link
                to={details.to}
                className={cn(
                  "flex min-h-11 items-center gap-3 rounded-xl border border-border p-3",
                  "transition-colors hover:border-accent/60",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
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
                    {details.title}
                  </span>
                  {!done && (
                    <span className="block text-xs text-foreground-muted">
                      {details.todo}
                    </span>
                  )}
                </span>
                <span className="sr-only">{done ? "(fait)" : "(à faire)"}</span>
              </Link>
            </li>
          );
        })}
      </ol>
    </Card>
  );
}
