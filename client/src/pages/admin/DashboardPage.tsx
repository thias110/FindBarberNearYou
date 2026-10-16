import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { PENDING_FILTER_PARAM } from "./UsersPage";
import type { AdminMetrics } from "@findbarber/shared/types";
import i18n from "../../i18n";
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

// `key` : clés `admin:dashboard.shortcuts.<key>.title|description`.
const SHORTCUTS = [
  { to: "/admin/users", key: "users" },
  { to: "/admin/bookings", key: "bookings" },
  { to: "/admin/reviews", key: "reviews" },
] as const;

export function AdminDashboardPage() {
  const { t } = useTranslation("admin");
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
            err instanceof Error ? err.message : i18n.t("admin:common.loadError"),
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
        <h2 className="text-xl font-bold text-foreground">
          {t("dashboard.title")}
        </h2>

        {loading ? (
          <div
            className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
            aria-busy="true"
          >
            <span className="sr-only" role="status">
              {t("dashboard.loading")}
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
              {t("common.retry")}
            </Button>
          </Alert>
        ) : metrics ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <MetricCard
              label={t("dashboard.metrics.users")}
              value={metrics.users.total}
            />
            <MetricCard
              label={t("dashboard.metrics.activeBarbers")}
              value={metrics.barbers.active}
            />
            <MetricCard
              label={t("dashboard.metrics.pendingProfiles")}
              value={metrics.barbers.pendingApproval}
            />
            <MetricCard
              label={t("dashboard.metrics.bookings")}
              value={metrics.bookings.total}
            />
            <MetricCard
              label={t("dashboard.metrics.suspendedUsers")}
              value={metrics.users.suspended}
            />
            <MetricCard
              label={t("dashboard.metrics.pendingBookings")}
              value={metrics.bookings.pending}
            />
            <MetricCard
              label={t("dashboard.metrics.hiddenReviews")}
              value={metrics.reviews.hidden}
            />
          </div>
        ) : null}

        {metrics && metrics.barbers.pendingApproval > 0 && (
          <Alert variant="warning">
            <p>
              {t("dashboard.pendingAlert", {
                count: metrics.barbers.pendingApproval,
              })}
            </p>
            <Link
              to={`/admin/users?filtre=${PENDING_FILTER_PARAM}`}
              className="mt-2 inline-flex min-h-11 items-center font-semibold underline underline-offset-4"
            >
              {t("dashboard.pendingLink")}
            </Link>
          </Alert>
        )}

        <nav
          aria-label={t("dashboard.shortcutsLabel")}
          className="grid gap-3 sm:grid-cols-3"
        >
          {SHORTCUTS.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="block rounded-2xl border border-border bg-surface p-5 shadow-card transition-colors hover:bg-surface-muted focus-ring"
            >
              <span className="font-semibold text-foreground">
                {t(`dashboard.shortcuts.${item.key}.title`)}
              </span>
              <span className="mt-1 block text-sm text-foreground-muted">
                {t(`dashboard.shortcuts.${item.key}.description`)}
              </span>
            </Link>
          ))}
        </nav>
      </div>
    </AdminLayout>
  );
}
