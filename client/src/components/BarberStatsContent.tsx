import { useTranslation } from "react-i18next";
import type { Weekday } from "@findbarber/shared/constants";
import type { BarberStatsResponse } from "@findbarber/shared/types";
import { intlLocale } from "../i18n";
import { formatCurrency } from "../lib/formatters";
import { formatCalendarDateRange } from "../lib/date";
import { label as businessLabel } from "../lib/labels";
import { Button } from "./ui/Button";
import { Card } from "./ui/Card";
import { Field } from "./ui/Field";
import { Input } from "./ui/Input";

export type StatsRange = "7d" | "30d" | "month" | "custom";

// Libellés : `stats.ranges.<valeur>` (espace barber).
const STATS_RANGES: StatsRange[] = ["7d", "30d", "month", "custom"];

// Les libellés des buckets calculés par le serveur sont en français : ils sont
// reconstruits ici depuis leur clé, dans la langue courante.
function monthBucketLabel(key: string, fallback: string): string {
  const match = /^(\d{4})-(\d{2})$/.exec(key);
  if (!match) return fallback;
  return new Intl.DateTimeFormat(intlLocale(), {
    timeZone: "UTC",
    month: "long",
    year: "numeric",
  }).format(Date.UTC(Number(match[1]), Number(match[2]) - 1, 1));
}

function weekdayBucketLabel(key: string, fallback: string): string {
  const day = Number(key);
  return Number.isInteger(day) && day >= 1 && day <= 7
    ? businessLabel("weekday", day as Weekday)
    : fallback;
}

// Sélecteur de période partagé entre l'espace barber et l'admin. Props et
// valeurs de `StatsRange` inchangées : seule la présentation utilise le design
// system (Button, Field, Input).
export function StatsRangeSelector({
  range,
  onRangeChange,
  from,
  to,
  onFromChange,
  onToChange,
}: {
  range: StatsRange;
  onRangeChange: (range: StatsRange) => void;
  from: string;
  to: string;
  onFromChange: (value: string) => void;
  onToChange: (value: string) => void;
}) {
  const { t } = useTranslation("barber");
  return (
    <>
      <div
        role="group"
        aria-label={t("stats.rangeGroupLabel")}
        className="flex flex-wrap gap-2"
      >
        {STATS_RANGES.map((value) => {
          const isActive = range === value;
          return (
            <Button
              key={value}
              variant={isActive ? "primary" : "secondary"}
              size="sm"
              className="min-h-[44px]"
              aria-pressed={isActive}
              onClick={() => onRangeChange(value)}
            >
              {t(`stats.ranges.${value}`)}
            </Button>
          );
        })}
      </div>

      {range === "custom" && (
        <div className="flex flex-wrap items-end gap-3">
          <Field label={t("stats.from")} className="w-40">
            {(control) => (
              <Input
                {...control}
                type="date"
                value={from}
                onChange={(event) => onFromChange(event.target.value)}
              />
            )}
          </Field>
          <Field label={t("stats.to")} className="w-40">
            {(control) => (
              <Input
                {...control}
                type="date"
                value={to}
                onChange={(event) => onToChange(event.target.value)}
              />
            )}
          </Field>
        </div>
      )}
    </>
  );
}

interface BarDatum {
  key: string;
  label: string;
  value: number;
  display: string;
}

// Graphique en barres CSS/Tailwind, sans dépendance. La valeur numérique reste
// toujours affichée en clair : c'est l'alternative textuelle accessible.
// La barre vit dans sa propre piste (`flex-1 min-w-0`) : à 100 % elle remplit
// la piste sans pousser la valeur hors de la carte (issue #46).
function Bars({ data }: { data: BarDatum[] }) {
  const max = Math.max(1, ...data.map((item) => item.value));
  return (
    <dl className="space-y-2">
      {data.map((item) => (
        <div
          key={item.key}
          className="grid grid-cols-[minmax(0,7rem)_minmax(0,1fr)] items-center gap-x-3 sm:grid-cols-[minmax(0,8rem)_minmax(0,1fr)]"
        >
          <dt className="break-words text-sm text-foreground-muted">
            {item.label}
          </dt>
          <dd className="flex min-w-0 items-center gap-2">
            <div aria-hidden="true" className="min-w-0 flex-1">
              <div
                className="h-4 rounded bg-accent"
                style={{ width: `${(item.value / max) * 100}%` }}
              />
            </div>
            <span className="shrink-0 whitespace-nowrap text-sm tabular-nums text-foreground">
              {item.display}
            </span>
          </dd>
        </div>
      ))}
    </dl>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <Card className="min-w-0 p-4">
      <p className="break-words text-xs font-medium uppercase tracking-wide text-foreground-muted">
        {label}
      </p>
      <p className="mt-1 break-words text-xl font-semibold tabular-nums text-foreground">
        {value}
      </p>
    </Card>
  );
}

// Rendu complet des statistiques (cartes + graphiques). Présentation pure :
// les données proviennent du DTO partagé, quelle que soit la page appelante.
export function BarberStatsContent({ stats }: { stats: BarberStatsResponse }) {
  const { t } = useTranslation("barber");
  const rate = (value: number) =>
    t("stats.rate", { value: Math.round(value * 100) });

  return (
    <>
      <Card className="p-4">
        <p className="text-sm text-foreground-muted">
          {t("stats.period", {
            range: formatCalendarDateRange(stats.period.from, stats.period.to),
          })}{" "}
          ({stats.period.timezone})
        </p>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard label={t("stats.cards.bookings")} value={String(stats.totals.bookings)} />
        <StatCard label={t("stats.cards.completed")} value={String(stats.totals.completed)} />
        <StatCard
          label={t("stats.cards.revenue")}
          value={formatCurrency(stats.totals.revenueMinor, stats.currency)}
        />
        <StatCard label={t("stats.cards.cancelled")} value={String(stats.totals.cancelled)} />
        <StatCard label={t("stats.cards.refused")} value={String(stats.totals.refused)} />
        <StatCard
          label={t("stats.cards.cancellationRate")}
          value={rate(stats.rates.cancellationRate)}
        />
        <StatCard
          label={t("stats.cards.refusalRate")}
          value={rate(stats.rates.refusalRate)}
        />
        <StatCard
          label={t("stats.cards.averageRating")}
          value={
            stats.rating.averageRating === null
              ? "—"
              : t("stats.ratingValue", {
                  value: stats.rating.averageRating.toFixed(2),
                })
          }
        />
        <StatCard label={t("stats.cards.reviews")} value={String(stats.rating.totalReviews)} />
        <StatCard
          label={t("stats.cards.newClients")}
          value={String(stats.clients.newClients)}
        />
        <StatCard
          label={t("stats.cards.returningClients")}
          value={String(stats.clients.returningClients)}
        />
      </div>

      <Card className="p-4">
        <h2 className="mb-3 font-bold text-foreground">
          {t("stats.charts.byWeek")}
        </h2>
        <Bars
          data={stats.appointmentsByWeek.map((bucket) => {
            const [year, week] = bucket.key.split("-W");
            return {
              key: bucket.key,
              label: week ? t("stats.weekLabel", { week, year }) : bucket.label,
              value: bucket.count,
              display: String(bucket.count),
            };
          })}
        />
      </Card>

      <Card className="p-4">
        <h2 className="mb-3 font-bold text-foreground">
          {t("stats.charts.byMonth")}
        </h2>
        <Bars
          data={stats.appointmentsByMonth.map((bucket) => ({
            key: bucket.key,
            label: monthBucketLabel(bucket.key, bucket.label),
            value: bucket.count,
            display: String(bucket.count),
          }))}
        />
      </Card>

      <Card className="p-4">
        <h2 className="mb-3 font-bold text-foreground">
          {t("stats.charts.revenueByMonth")}
        </h2>
        <Bars
          data={stats.revenueByMonth.map((bucket) => ({
            key: bucket.key,
            label: monthBucketLabel(bucket.key, bucket.label),
            value: bucket.revenueMinor,
            display: formatCurrency(bucket.revenueMinor, stats.currency),
          }))}
        />
      </Card>

      <Card className="p-4">
        <h2 className="mb-3 font-bold text-foreground">
          {t("stats.charts.topServices")}
        </h2>
        <ul className="space-y-2">
          {stats.topServices.map((service) => (
            <li
              key={service.serviceName}
              className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border pb-2 text-sm last:border-0"
            >
              <span className="min-w-0 break-words font-medium text-foreground">
                {service.serviceName}
              </span>
              <span className="text-foreground-muted">
                {t("stats.serviceCount", { count: service.count })} ·{" "}
                {formatCurrency(service.revenueMinor, stats.currency)}
              </span>
            </li>
          ))}
        </ul>
      </Card>

      <Card className="p-4">
        <h2 className="mb-3 font-bold text-foreground">
          {t("stats.charts.busiestWeekdays")}
        </h2>
        <Bars
          data={stats.busiestWeekdays.map((bucket) => ({
            key: bucket.key,
            label: weekdayBucketLabel(bucket.key, bucket.label),
            value: bucket.count,
            display: String(bucket.count),
          }))}
        />
      </Card>

      <Card className="p-4">
        <h2 className="mb-3 font-bold text-foreground">
          {t("stats.charts.busiestHours")}
        </h2>
        <Bars
          data={stats.busiestHours.map((bucket) => ({
            key: bucket.key,
            label: bucket.label,
            value: bucket.count,
            display: String(bucket.count),
          }))}
        />
      </Card>
    </>
  );
}
