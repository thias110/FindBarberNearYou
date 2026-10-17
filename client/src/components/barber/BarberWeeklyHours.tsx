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
    <Card className="p-6">
      <section aria-labelledby={titleId}>
        <h2 id={titleId} className="text-h3 font-bold text-foreground">
          {t("profile.hours.title")}
        </h2>
        {hours.intervals.length === 0 ? (
          <p className="mt-2 text-sm text-foreground-muted">
            {t("profile.hours.empty")}
          </p>
        ) : (
          <>
            <dl className="mt-3 divide-y divide-border">
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
                      isToday && "-mx-3 rounded-lg bg-accent-soft px-3",
                    )}
                  >
                    <dt
                      className={cn(
                        "flex items-center gap-2",
                        isToday ? "font-semibold text-accent-strong" : "text-foreground",
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
                              isToday ? "font-semibold text-foreground" : "text-foreground",
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
