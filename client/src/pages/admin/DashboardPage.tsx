import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { PENDING_FILTER_PARAM } from "./UsersPage";
import type { AdminMetrics } from "@findbarber/shared/types";
import { adminApi } from "../../lib/apiClient";
import { AdminLayout } from "../../components/AdminLayout";
import { Alert } from "../../components/ui/Alert";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { Skeleton } from "../../components/ui/Skeleton";

function MetricCard({ label, value }: { label: string; value: number }) {
  return (
    <Card className="p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-foreground-muted">
        {label}
      </p>
      <p className="mt-1 text-2xl font-semibold text-foreground">{value}</p>
    </Card>
  );
}

const SHORTCUTS = [
  {
    to: "/admin/users",
    title: "Utilisateurs",
    description: "Liste, rôles et suspension des comptes",
  },
  {
    to: "/admin/bookings",
    title: "Réservations",
    description: "Vue globale et filtrage par statut",
  },
  {
    to: "/admin/reviews",
    title: "Avis",
    description: "Modération et masquage des avis",
  },
] as const;

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
      <div className="space-y-6">
        <h2 className="text-xl font-bold text-foreground">Tableau de bord</h2>

        {loading ? (
          <div
            className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
            aria-busy="true"
          >
            <span className="sr-only" role="status">
              Chargement des indicateurs…
            </span>
            {[0, 1, 2, 3, 4, 5].map((key) => (
              <Card key={key} className="space-y-2 p-4">
                <Skeleton className="h-3 w-1/2" />
                <Skeleton className="h-7 w-1/4" />
              </Card>
            ))}
          </div>
        ) : error ? (
          <Alert variant="danger">
            <p>{error}</p>
            <Button
              variant="secondary"
              className="mt-3 min-h-11"
              onClick={() => setRetryKey((key) => key + 1)}
            >
              Réessayer
            </Button>
          </Alert>
        ) : metrics ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <MetricCard label="Utilisateurs" value={metrics.users.total} />
            <MetricCard label="Barbiers actifs" value={metrics.barbers.active} />
            <MetricCard
              label="Profils à approuver"
              value={metrics.barbers.pendingApproval}
            />
            <MetricCard label="Réservations" value={metrics.bookings.total} />
            <MetricCard
              label="Utilisateurs suspendus"
              value={metrics.users.suspended}
            />
            <MetricCard
              label="Réservations en attente"
              value={metrics.bookings.pending}
            />
            <MetricCard label="Avis masqués" value={metrics.reviews.hidden} />
          </div>
        ) : null}

        {metrics && metrics.barbers.pendingApproval > 0 && (
          <Alert variant="warning">
            <p>
              {metrics.barbers.pendingApproval === 1
                ? "1 nouveau profil barber attend votre approbation."
                : `${metrics.barbers.pendingApproval} nouveaux profils barber attendent votre approbation.`}
            </p>
            <Link
              to={`/admin/users?filtre=${PENDING_FILTER_PARAM}`}
              className="mt-2 inline-flex min-h-11 items-center font-semibold underline underline-offset-4"
            >
              Voir les profils à approuver
            </Link>
          </Alert>
        )}

        <nav aria-label="Raccourcis administration" className="grid gap-3 sm:grid-cols-3">
          {SHORTCUTS.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="block rounded-2xl border border-border bg-surface p-5 shadow-card transition-colors hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              <span className="font-semibold text-foreground">{item.title}</span>
              <span className="mt-1 block text-sm text-foreground-muted">
                {item.description}
              </span>
            </Link>
          ))}
        </nav>
      </div>
    </AdminLayout>
  );
}
