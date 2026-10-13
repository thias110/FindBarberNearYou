import { useEffect, useState } from "react";
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

// Lien stylé comme le bouton primaire du design system (aucun `ButtonLink`).
const PRIMARY_LINK_CLASS =
  "inline-flex min-h-[44px] items-center justify-center rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground transition-colors hover:bg-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background";

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
        <ProPageHeader
          title="Mes statistiques"
          description="Rendez-vous, revenus, services et avis."
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
              Chargement des statistiques…
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
              Créez d'abord votre profil professionnel pour consulter vos
              statistiques.
            </p>
            <Link to="/pro/profile" className={`${PRIMARY_LINK_CLASS} mt-4`}>
              Créer mon profil
            </Link>
          </Card>
        ) : timezoneMissing ? (
          <Card className="p-6 text-center">
            <p className="text-foreground">
              Renseignez votre fuseau horaire pour consulter vos statistiques.
            </p>
            <Link to="/pro/profile" className={`${PRIMARY_LINK_CLASS} mt-4`}>
              Compléter mon profil
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
              Réessayer
            </Button>
          </Alert>
        ) : !canFetch ? (
          <Card className="p-6 text-center">
            <p className="text-foreground-muted">Choisissez une plage de dates.</p>
          </Card>
        ) : stats ? (
          <BarberStatsContent stats={stats} />
        ) : null}
      </div>
    </div>
  );
}
