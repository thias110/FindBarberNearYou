import type { BarberStatsResponse } from "@findbarber/shared/types";
import { formatCurrency } from "../lib/formatters";
import { formatCalendarDateRange } from "../lib/date";
import { Button } from "./ui/Button";
import { Card } from "./ui/Card";
import { Field } from "./ui/Field";
import { Input } from "./ui/Input";

export type StatsRange = "7d" | "30d" | "month" | "custom";

const STATS_RANGES: { value: StatsRange; label: string }[] = [
  { value: "7d", label: "7 jours" },
  { value: "30d", label: "30 jours" },
  { value: "month", label: "Ce mois" },
  { value: "custom", label: "Personnalisé" },
];

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
  return (
    <>
      <div
        role="group"
        aria-label="Période des statistiques"
        className="flex flex-wrap gap-2"
      >
        {STATS_RANGES.map((option) => {
          const isActive = range === option.value;
          return (
            <Button
              key={option.value}
              variant={isActive ? "primary" : "secondary"}
              size="sm"
              className="min-h-[44px]"
              aria-pressed={isActive}
              onClick={() => onRangeChange(option.value)}
            >
              {option.label}
            </Button>
          );
        })}
      </div>

      {range === "custom" && (
        <div className="flex flex-wrap items-end gap-3">
          <Field label="Du" className="w-40">
            {(control) => (
              <Input
                {...control}
                type="date"
                value={from}
                onChange={(event) => onFromChange(event.target.value)}
              />
            )}
          </Field>
          <Field label="Au" className="w-40">
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
function Bars({ data }: { data: BarDatum[] }) {
  const max = Math.max(1, ...data.map((item) => item.value));
  return (
    <dl className="space-y-2">
      {data.map((item) => (
        <div key={item.key} className="flex items-center gap-3">
          <dt className="w-32 shrink-0 text-sm text-foreground-muted">
            {item.label}
          </dt>
          <dd className="flex min-w-0 flex-1 items-center gap-2">
            <div
              aria-hidden="true"
              className="h-4 shrink-0 rounded bg-accent"
              style={{ width: `${(item.value / max) * 100}%` }}
            />
            <span className="shrink-0 text-sm text-foreground">
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
    <Card className="p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-foreground-muted">
        {label}
      </p>
      <p className="mt-1 text-xl font-semibold text-foreground">{value}</p>
    </Card>
  );
}

// Rendu complet des statistiques (cartes + graphiques). Présentation pure :
// les données proviennent du DTO partagé, quelle que soit la page appelante.
export function BarberStatsContent({ stats }: { stats: BarberStatsResponse }) {
  const rate = (value: number) => `${Math.round(value * 100)} %`;

  return (
    <>
      <Card className="p-4">
        <p className="text-sm text-foreground-muted">
          Période : {formatCalendarDateRange(stats.period.from, stats.period.to)}{" "}
          ({stats.period.timezone})
        </p>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard label="Rendez-vous" value={String(stats.totals.bookings)} />
        <StatCard label="Terminés" value={String(stats.totals.completed)} />
        <StatCard
          label="Revenus (terminés)"
          value={formatCurrency(stats.totals.revenueMinor, stats.currency)}
        />
        <StatCard label="Annulés" value={String(stats.totals.cancelled)} />
        <StatCard label="Refusés" value={String(stats.totals.refused)} />
        <StatCard
          label="Taux d'annulation"
          value={rate(stats.rates.cancellationRate)}
        />
        <StatCard
          label="Taux de refus"
          value={rate(stats.rates.refusalRate)}
        />
        <StatCard
          label="Note moyenne"
          value={
            stats.rating.averageRating === null
              ? "—"
              : `${stats.rating.averageRating.toFixed(2)} / 5`
          }
        />
        <StatCard label="Avis" value={String(stats.rating.totalReviews)} />
        <StatCard
          label="Nouveaux clients"
          value={String(stats.clients.newClients)}
        />
        <StatCard
          label="Clients réguliers"
          value={String(stats.clients.returningClients)}
        />
      </div>

      <Card className="p-4">
        <h2 className="mb-3 font-bold text-foreground">
          Rendez-vous par semaine
        </h2>
        <Bars
          data={stats.appointmentsByWeek.map((bucket) => ({
            key: bucket.key,
            label: bucket.label,
            value: bucket.count,
            display: String(bucket.count),
          }))}
        />
      </Card>

      <Card className="p-4">
        <h2 className="mb-3 font-bold text-foreground">
          Rendez-vous par mois
        </h2>
        <Bars
          data={stats.appointmentsByMonth.map((bucket) => ({
            key: bucket.key,
            label: bucket.label,
            value: bucket.count,
            display: String(bucket.count),
          }))}
        />
      </Card>

      <Card className="p-4">
        <h2 className="mb-3 font-bold text-foreground">
          Revenus par mois
        </h2>
        <Bars
          data={stats.revenueByMonth.map((bucket) => ({
            key: bucket.key,
            label: bucket.label,
            value: bucket.revenueMinor,
            display: formatCurrency(bucket.revenueMinor, stats.currency),
          }))}
        />
      </Card>

      <Card className="p-4">
        <h2 className="mb-3 font-bold text-foreground">
          Services les plus demandés
        </h2>
        <ul className="space-y-2">
          {stats.topServices.map((service) => (
            <li
              key={service.serviceName}
              className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border pb-2 text-sm last:border-0"
            >
              <span className="font-medium text-foreground">
                {service.serviceName}
              </span>
              <span className="text-foreground-muted">
                {service.count} rdv ·{" "}
                {formatCurrency(service.revenueMinor, stats.currency)}
              </span>
            </li>
          ))}
        </ul>
      </Card>

      <Card className="p-4">
        <h2 className="mb-3 font-bold text-foreground">
          Jours les plus chargés
        </h2>
        <Bars
          data={stats.busiestWeekdays.map((bucket) => ({
            key: bucket.key,
            label: bucket.label,
            value: bucket.count,
            display: String(bucket.count),
          }))}
        />
      </Card>

      <Card className="p-4">
        <h2 className="mb-3 font-bold text-foreground">
          Heures les plus chargées
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
