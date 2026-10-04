import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { BarberStatsResponse } from "@findbarber/shared/types";
import { ApiError, barberApi } from "../../lib/apiClient";
import {
  BarberStatsContent,
  StatsRangeSelector,
  type StatsRange,
} from "../../components/BarberStatsContent";

export function BarberStatsPage() {
  const [range, setRange] = useState<StatsRange>("30d");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [stats, setStats] = useState<BarberStatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [profileMissing, setProfileMissing] = useState(false);
  const [timezoneMissing, setTimezoneMissing] = useState(false);
  const [retryKey, setRetryKey] = useState(0);

  const canFetch = range !== "custom" || (from !== "" && to !== "");

  useEffect(() => {
    if (!canFetch) {
      setStats(null);
      setError(null);
      setProfileMissing(false);
      setTimezoneMissing(false);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);
    setProfileMissing(false);
    setTimezoneMissing(false);

    barberApi
      .getStats(range === "custom" ? { range, from, to } : { range })
      .then((res) => {
        if (!cancelled) setStats(res);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        if (err instanceof ApiError && err.code === "BARBER_PROFILE_NOT_FOUND") {
          setProfileMissing(true);
        } else if (
          err instanceof ApiError &&
          err.code === "BARBER_TIMEZONE_MISSING"
        ) {
          setTimezoneMissing(true);
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
  }, [range, from, to, canFetch, retryKey]);

  return (
    <div className="min-h-screen bg-background p-4 sm:p-8">
      <div className="mx-auto max-w-4xl space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-brand-900">
            Mes statistiques
          </h1>
          <p className="mt-1 text-sm text-gray-600">
            <Link to="/pro/dashboard" className="text-brand-700 underline">
              Retour au tableau de bord
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
        ) : profileMissing ? (
          <div className="rounded-2xl bg-white p-6 text-center shadow">
            <p className="text-gray-700">
              Créez d'abord votre profil professionnel pour consulter vos
              statistiques.
            </p>
            <Link
              to="/pro/profile"
              className="mt-4 inline-block rounded-lg bg-brand-700 px-4 py-2 text-white"
            >
              Créer mon profil
            </Link>
          </div>
        ) : timezoneMissing ? (
          <div className="rounded-2xl bg-white p-6 text-center shadow">
            <p className="text-gray-700">
              Renseignez votre fuseau horaire pour consulter vos statistiques.
            </p>
            <Link
              to="/pro/profile"
              className="mt-4 inline-block rounded-lg bg-brand-700 px-4 py-2 text-white"
            >
              Compléter mon profil
            </Link>
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
    </div>
  );
}
