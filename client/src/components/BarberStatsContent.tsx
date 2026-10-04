import type { BarberStatsResponse } from "@findbarber/shared/types";
import { formatCurrency } from "../lib/formatters";
import { formatCalendarDateRange } from "../lib/date";

export type StatsRange = "7d" | "30d" | "month" | "custom";

const STATS_RANGES: { value: StatsRange; label: string }[] = [
  { value: "7d", label: "7 jours" },
  { value: "30d", label: "30 jours" },
  { value: "month", label: "Ce mois" },
  { value: "custom", label: "Personnalisé" },
];

// Sélecteur de période partagé entre l'espace barber et l'admin.
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
      <div className="flex flex-wrap gap-2">
        {STATS_RANGES.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onRangeChange(option.value)}
            className={`rounded-lg px-3 py-1.5 text-sm ${
              range === option.value
                ? "bg-brand-700 text-white"
                : "border border-gray-300 text-gray-700"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      {range === "custom" && (
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-sm text-gray-700">
            Du
            <input
              type="date"
              value={from}
              onChange={(event) => onFromChange(event.target.value)}
              className="mt-1 block rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
            />
          </label>
          <label className="text-sm text-gray-700">
            Au
            <input
              type="date"
              value={to}
              onChange={(event) => onToChange(event.target.value)}
              className="mt-1 block rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
            />
          </label>
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
          <dt className="w-32 shrink-0 text-sm text-gray-600">{item.label}</dt>
          <dd className="flex min-w-0 flex-1 items-center gap-2">
            <div
              aria-hidden="true"
              className="h-4 shrink-0 rounded bg-brand-300"
              style={{ width: `${(item.value / max) * 100}%` }}
            />
            <span className="shrink-0 text-sm text-gray-800">{item.display}</span>
          </dd>
        </div>
      ))}
    </dl>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white p-4 shadow">
      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
        {label}
      </p>
      <p className="mt-1 text-xl font-semibold text-brand-900">{value}</p>
    </div>
  );
}

// Rendu complet des statistiques (cartes + graphiques). Présentation pure :
// les données proviennent du DTO partagé, quelle que soit la page appelante.
export function BarberStatsContent({ stats }: { stats: BarberStatsResponse }) {
  const rate = (value: number) => `${Math.round(value * 100)} %`;

  return (
    <>
      <div className="rounded-2xl bg-white p-4 shadow">
        <p className="text-sm text-gray-600">
          Période : {formatCalendarDateRange(stats.period.from, stats.period.to)}{" "}
          ({stats.period.timezone})
        </p>
      </div>

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

      <section className="rounded-2xl bg-white p-4 shadow">
        <h2 className="mb-3 font-semibold text-brand-900">
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
      </section>

      <section className="rounded-2xl bg-white p-4 shadow">
        <h2 className="mb-3 font-semibold text-brand-900">
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
      </section>

      <section className="rounded-2xl bg-white p-4 shadow">
        <h2 className="mb-3 font-semibold text-brand-900">Revenus par mois</h2>
        <Bars
          data={stats.revenueByMonth.map((bucket) => ({
            key: bucket.key,
            label: bucket.label,
            value: bucket.revenueMinor,
            display: formatCurrency(bucket.revenueMinor, stats.currency),
          }))}
        />
      </section>

      <section className="rounded-2xl bg-white p-4 shadow">
        <h2 className="mb-3 font-semibold text-brand-900">
          Services les plus demandés
        </h2>
        <ul className="space-y-2">
          {stats.topServices.map((service) => (
            <li
              key={service.serviceName}
              className="flex flex-wrap items-baseline justify-between gap-2 border-b border-gray-100 pb-2 text-sm"
            >
              <span className="font-medium text-gray-800">
                {service.serviceName}
              </span>
              <span className="text-gray-600">
                {service.count} rdv ·{" "}
                {formatCurrency(service.revenueMinor, stats.currency)}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-2xl bg-white p-4 shadow">
        <h2 className="mb-3 font-semibold text-brand-900">
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
      </section>

      <section className="rounded-2xl bg-white p-4 shadow">
        <h2 className="mb-3 font-semibold text-brand-900">
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
      </section>
    </>
  );
}
