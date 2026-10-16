import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useParams } from "react-router-dom";
import type { BarberStatsResponse } from "@findbarber/shared/types";
import i18n from "../../i18n";
import { ApiError, adminApi } from "../../lib/apiClient";
import { AdminLayout } from "../../components/AdminLayout";
import {
  BarberStatsContent,
  StatsRangeSelector,
  type StatsRange,
} from "../../components/BarberStatsContent";
import { Alert } from "../../components/ui/Alert";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { Skeleton } from "../../components/ui/Skeleton";

export function AdminBarberStatsPage() {
  const { t } = useTranslation("admin");
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
          setError(i18n.t("admin:barberStats.notFound"));
        } else if (
          err instanceof ApiError &&
          err.code === "BARBER_TIMEZONE_MISSING"
        ) {
          setError(i18n.t("admin:barberStats.timezoneMissing"));
        } else {
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
  }, [barberId, range, from, to, canFetch, retryKey]);

  return (
    <AdminLayout>
      <div className="space-y-4">
        <div>
          <h2 className="text-xl font-bold text-foreground">
            {t("barberStats.title")}
          </h2>
          <p className="mt-1 text-sm text-foreground-muted">
            <Link
              to="/admin/users"
              className="font-medium text-foreground underline underline-offset-4 focus-ring"
            >
              {t("barberStats.back")}
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
          <Card className="space-y-4 p-6" aria-busy="true">
            <span className="sr-only" role="status">
              {t("barberStats.loading")}
            </span>
            <Skeleton className="h-6 w-2/3" />
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </div>
          </Card>
        ) : error ? (
          <Alert variant="danger">
            <p>{error}</p>
            <Button
              variant="secondary"
              className="mt-3 min-h-[44px]"
              onClick={() => setRetryKey((key) => key + 1)}
            >
              {t("common.retry")}
            </Button>
          </Alert>
        ) : !canFetch ? (
          <Card className="p-6 text-center">
            <p className="text-foreground-muted">
              {t("barberStats.chooseRange")}
            </p>
          </Card>
        ) : stats ? (
          <BarberStatsContent stats={stats} />
        ) : null}
      </div>
    </AdminLayout>
  );
}
