import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { AdminMetrics } from "@findbarber/shared/types";
import { adminApi } from "../../lib/apiClient";
import { AdminLayout } from "../../components/AdminLayout";

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white p-4 shadow">
      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
        {label}
      </p>
      <p className="mt-1 text-xl font-semibold text-brand-900">{value}</p>
    </div>
  );
}

export function AdminDashboardPage() {
  const [metrics, setMetrics] = useState<AdminMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    adminApi
      .getMetrics()
      .then((res) => {
        if (!cancelled) setMetrics(res);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
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
  }, [retryKey]);

  return (
    <AdminLayout>
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
      ) : metrics ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <MetricCard
              label="Utilisateurs"
              value={String(metrics.users.total)}
            />
            <MetricCard
              label="Barbiers actifs"
              value={String(metrics.barbers.active)}
            />
            <MetricCard
              label="Réservations"
              value={String(metrics.bookings.total)}
            />
            <MetricCard
              label="Utilisateurs suspendus"
              value={String(metrics.users.suspended)}
            />
            <MetricCard
              label="Réservations en attente"
              value={String(metrics.bookings.pending)}
            />
            <MetricCard
              label="Avis masqués"
              value={String(metrics.reviews.hidden)}
            />
          </div>

          <nav className="grid gap-3 sm:grid-cols-3">
            <Link
              to="/admin/users"
              className="rounded-2xl bg-white p-5 shadow transition hover:shadow-md"
            >
              <span className="font-semibold text-brand-900">Utilisateurs</span>
              <span className="mt-1 block text-sm text-gray-600">
                Liste, rôles et suspension des comptes
              </span>
            </Link>
            <Link
              to="/admin/bookings"
              className="rounded-2xl bg-white p-5 shadow transition hover:shadow-md"
            >
              <span className="font-semibold text-brand-900">Réservations</span>
              <span className="mt-1 block text-sm text-gray-600">
                Vue globale et filtrage par statut
              </span>
            </Link>
            <Link
              to="/admin/reviews"
              className="rounded-2xl bg-white p-5 shadow transition hover:shadow-md"
            >
              <span className="font-semibold text-brand-900">Avis</span>
              <span className="mt-1 block text-sm text-gray-600">
                Modération et masquage réversible
              </span>
            </Link>
          </nav>
        </>
      ) : null}
    </AdminLayout>
  );
}
