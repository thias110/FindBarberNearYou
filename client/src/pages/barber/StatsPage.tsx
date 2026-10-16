import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import type { BarberStatsResponse } from "@findbarber/shared/types";
import { ApiError, barberApi } from "../../lib/apiClient";
import {
  BarberStatsContent,
  StatsRangeSelector,
  type StatsRange,
} from "../../components/BarberStatsContent";
import { Alert } from "../../components/ui/Alert";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { Skeleton } from "../../components/ui/Skeleton";
import { ProPageHeader } from "../../components/barber/ProPageHeader";
import { buttonClasses } from "../../components/ui/buttonStyles";

// Lien stylé comme le bouton primaire du design system (aucun `ButtonLink`).
const PRIMARY_LINK_CLASS = buttonClasses("primary");

export function BarberStatsPage() {
  const { t } = useTranslation("barber");
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
            err instanceof Error ? err.message : t("common.loadFailed"),
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `t` : texte de repli seulement.
  }, [range, from, to, canFetch, retryKey]);

  return (
    <div className="min-h-screen bg-background p-4 sm:p-8">
      <div className="mx-auto max-w-4xl space-y-6">
        <ProPageHeader
          title={t("stats.page.title")}
          description={t("stats.page.description")}
        />

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
              {t("stats.page.loading")}
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
        ) : profileMissing ? (
          <Card className="p-6 text-center">
            <p className="text-foreground">
              {t("stats.page.profileMissing")}
            </p>
            <Link to="/pro/profile" className={`${PRIMARY_LINK_CLASS} mt-4`}>
              {t("common.createProfile")}
            </Link>
          </Card>
        ) : timezoneMissing ? (
          <Card className="p-6 text-center">
            <p className="text-foreground">
              {t("stats.page.timezoneMissing")}
            </p>
            <Link to="/pro/profile" className={`${PRIMARY_LINK_CLASS} mt-4`}>
              {t("common.completeProfile")}
            </Link>
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
            <p className="text-foreground-muted">{t("stats.page.chooseRange")}</p>
          </Card>
        ) : stats ? (
          <BarberStatsContent stats={stats} />
        ) : null}
      </div>
    </div>
  );
}
