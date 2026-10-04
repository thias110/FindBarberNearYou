import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import type { BarberStatsResponse } from "@findbarber/shared/types";
import { ApiError, adminApi } from "../../lib/apiClient";
import { AdminLayout } from "../../components/AdminLayout";
import {
  BarberStatsContent,
  StatsRangeSelector,
  type StatsRange,
} from "../../components/BarberStatsContent";

export function AdminBarberStatsPage() {
  const { barberId } = useParams<{ barberId: string }>();
  const [range, setRange] = useState<StatsRange>("30d");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [stats, setStats] = useState<BarberStatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);

  const canFetch =
    Boolean(barberId) && (range !== "custom" || (from !== "" && to !== ""));

  useEffect(() => {
    if (!barberId || !canFetch) {
      setStats(null);
      setError(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    adminApi
      .getBarberStats(
        barberId,
        range === "custom" ? { range, from, to } : { range },
      )
      .then((res) => {
        if (!cancelled) setStats(res);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        if (err instanceof ApiError && err.code === "BARBER_PROFILE_NOT_FOUND") {
          setError("Profil professionnel introuvable.");
        } else if (
          err instanceof ApiError &&
          err.code === "BARBER_TIMEZONE_MISSING"
        ) {
          setError(
            "Ce professionnel n'a pas renseigné son fuseau horaire : statistiques indisponibles.",
          );
        } else {
          setError(
            err instanceof Error ? err.message : "Chargement impossible.",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [barberId, range, from, to, canFetch, retryKey]);

  return (
    <AdminLayout>
      <div className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold text-brand-900">
            Statistiques d'un professionnel
          </h2>
          <p className="mt-1 text-sm text-gray-600">
            <Link to="/admin/users" className="text-brand-700 underline">
              Retour aux utilisateurs
            </Link>
          </p>
        </div>

        <StatsRangeSelector
          range={range}
          onRangeChange={setRange}
          from={from}
          to={to}
          onFromChange={setFrom}
          onToChange={setTo}
        />

        {loading ? (
          <div className="rounded-2xl bg-white p-6 text-center text-gray-500">
            Chargement…
          </div>
        ) : error ? (
          <div className="rounded-lg bg-red-50 p-4 text-sm text-red-700">
            <p>{error}</p>
            <button
              type="button"
              onClick={() => setRetryKey((key) => key + 1)}
              className="mt-2 rounded-lg border border-brand-700 px-3 py-1 text-brand-700"
            >
              Réessayer
            </button>
          </div>
        ) : !canFetch ? (
          <div className="rounded-2xl bg-white p-6 text-center text-gray-600 shadow">
            Choisissez une plage de dates.
          </div>
        ) : stats ? (
          <BarberStatsContent stats={stats} />
        ) : null}
      </div>
    </AdminLayout>
  );
}
