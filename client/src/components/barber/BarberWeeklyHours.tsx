import { useTranslation } from "react-i18next";
import { WEEKDAYS } from "@findbarber/shared/constants";
import type { PublicWeeklyHours } from "@findbarber/shared/types";
import { cn } from "../../lib/cn";
import { label } from "../../lib/labels";
import { formatMinutesRange } from "../../lib/time";
import { Badge } from "../ui/Badge";
import { Card } from "../ui/Card";

// Horaires publics de la fiche (lot N3) : une ligne par jour, du lundi au
// dimanche, « Fermé » sans plage, jour courant du salon mis en avant. Aucune
// absence affichée : elles restent privées (seuls les créneaux en tiennent
// compte).
export function BarberWeeklyHours({ hours }: { hours: PublicWeeklyHours }) {
  const { t } = useTranslation("client");
  const titleId = "barber-hours-title";

  return (
    <Card className="rounded-3xl border-border/80 p-6 shadow-card-sm">
      <section aria-labelledby={titleId}>
        <div className="flex items-center gap-2">
          <svg
            aria-hidden="true"
            viewBox="0 0 20 20"
            className="h-5 w-5 shrink-0 text-accent-strong"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="10" cy="10" r="7.5" />
            <path d="M10 6v4l2.8 1.8" />
          </svg>
          <h2 id={titleId} className="text-h3 font-bold text-foreground">
            {t("profile.hours.title")}
          </h2>
        </div>
        {hours.intervals.length === 0 ? (
          <p className="mt-2 text-sm text-foreground-muted">
            {t("profile.hours.empty")}
          </p>
        ) : (
          <>
            <dl className="mt-4 divide-y divide-border/70">
              {WEEKDAYS.map((weekday) => {
                const ranges = hours.intervals.filter((i) => i.weekday === weekday);
                const isToday = hours.today === weekday;
                return (
                  <div
                    key={weekday}
                    // Le jour courant porte `aria-current` en plus du badge.
                    aria-current={isToday ? "date" : undefined}
                    className={cn(
                      "flex items-start justify-between gap-4 py-2.5 text-sm",
                      isToday && "-mx-3 rounded-xl border border-accent/25 bg-accent-soft px-3",
                    )}
                  >
                    <dt
                      className={cn(
                        "flex items-center gap-2",
                        isToday ? "font-bold text-accent-strong" : "font-medium text-foreground",
                      )}
                    >
                      {label("weekday", weekday)}
                      {isToday && (
                        <Badge variant="accent" size="sm">
                          {t("profile.hours.today")}
                        </Badge>
                      )}
                    </dt>
                    <dd className="text-right tabular-nums">
                      {ranges.length === 0 ? (
                        <span className="text-foreground-muted">
                          {t("profile.hours.closed")}
                        </span>
                      ) : (
                        ranges.map((range) => (
                          <span
                            key={range.startMinute}
                            className={cn(
                              "block",
                              isToday ? "font-bold text-foreground" : "text-foreground",
                            )}
                          >
                            {formatMinutesRange(range.startMinute, range.endMinute)}
                          </span>
                        ))
                      )}
                    </dd>
                  </div>
                );
              })}
            </dl>
            <p className="mt-3 text-xs text-foreground-muted">
              {t("profile.hours.localTime")}
            </p>
          </>
        )}
      </section>
    </Card>
  );
}
