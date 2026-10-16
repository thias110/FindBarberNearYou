import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { LIMITS } from "@findbarber/shared/constants";
import type { TimeOff } from "@findbarber/shared/types";
import { timeOffCreateSchema } from "@findbarber/shared/validation";
import { ApiError, barberApi } from "../../lib/apiClient";
import { formatCalendarDateRange } from "../../lib/date";
import { Alert } from "../../components/ui/Alert";
import { StickyActionBar } from "../../components/ui/StickyActionBar";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { Field } from "../../components/ui/Field";
import { Input } from "../../components/ui/Input";
import { Skeleton } from "../../components/ui/Skeleton";
import { ProPageHeader } from "../../components/barber/ProPageHeader";
import { buttonClasses } from "../../components/ui/buttonStyles";
import { focusFirstInvalid } from "../../lib/formErrors";

// Lien stylé comme le bouton primaire du design system (aucun `ButtonLink`).
const PRIMARY_LINK_CLASS = buttonClasses("primary");

function sortTimeOff(items: TimeOff[]): TimeOff[] {
  return [...items].sort((a, b) => {
    if (a.startDate !== b.startDate) return a.startDate < b.startDate ? -1 : 1;
    if (a.endDate !== b.endDate) return a.endDate < b.endDate ? -1 : 1;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
}

// Rattaché au premier segment du chemin Zod (`startDate`, `endDate`, `reason`).
function applyIssues(issues: { path: (string | number)[]; message: string }[]) {
  const next: Record<string, string> = {};
  for (const issue of issues) {
    const key = String(issue.path[0] ?? "form");
    if (!(key in next)) next[key] = issue.message;
  }
  return next;
}

export function BarberTimeOffPage() {
  const { t } = useTranslation("barber");
  const [timeOff, setTimeOff] = useState<TimeOff[]>([]);
  const [loading, setLoading] = useState(true);
  const [profileMissing, setProfileMissing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Fuseau du professionnel, chargé via GET /profile séparément. Trois états
  // distincts : renseigné / non renseigné / indisponible. La création reste
  // autorisée sans fuseau, avec un avertissement.
  const [timezone, setTimezone] = useState<string | null>(null);
  const [timezoneStatus, setTimezoneStatus] = useState<
    "loading" | "loaded" | "error"
  >("loading");

  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    setTimezoneStatus("loading");
    try {
      const [listRes, profileRes] = await Promise.allSettled([
        barberApi.getTimeOff(),
        barberApi.getProfile(),
      ]);
      if (listRes.status === "rejected") {
        const err = listRes.reason;
        if (err instanceof ApiError && err.code === "BARBER_PROFILE_NOT_FOUND") {
          setProfileMissing(true);
        } else {
          setError(err instanceof Error ? err.message : t("common.loadFailed"));
        }
        return;
      }
      setTimeOff(sortTimeOff(listRes.value.timeOff));
      setProfileMissing(false);
      if (profileRes.status === "fulfilled") {
        setTimezone(profileRes.value.profile.timezone);
        setTimezoneStatus("loaded");
      } else {
        setTimezone(null);
        setTimezoneStatus("error");
      }
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `t` : texte de repli seulement.
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // Relance du seul bandeau fuseau : GET /profile uniquement. Ne touche ni au
  // formulaire, ni à la liste, ni aux messages.
  const retryTimezoneRef = useRef(false);

  const retryTimezone = useCallback(async () => {
    if (retryTimezoneRef.current) return;
    retryTimezoneRef.current = true;
    setTimezoneStatus("loading");
    try {
      const res = await barberApi.getProfile();
      setTimezone(res.profile.timezone);
      setTimezoneStatus("loaded");
    } catch {
      setTimezone(null);
      setTimezoneStatus("error");
    } finally {
      retryTimezoneRef.current = false;
    }
  }, []);

  function clearFieldError(field: string) {
    setFieldErrors((current) => {
      if (!(field in current)) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  }

  async function handleCreate() {
    setError(null);
    setSuccess(null);
    const parsed = timeOffCreateSchema.safeParse({ startDate, endDate, reason });
    if (!parsed.success) {
      setFieldErrors(applyIssues(parsed.error.issues));
      // Seul le formulaire d'ajout porte des champs en erreur sur cette page.
      focusFirstInvalid(document.getElementById("contenu"));
      return;
    }
    setFieldErrors({});
    setSaving(true);
    try {
      const res = await barberApi.createTimeOff(parsed.data);
      setTimeOff((current) => sortTimeOff([...current, res.timeOff]));
      setStartDate("");
      setEndDate("");
      setReason("");
      setSuccess(t("timeOff.saved"));
    } catch (err) {
      // Le formulaire et la liste affichée restent intacts en cas d'échec.
      setError(err instanceof Error ? err.message : t("timeOff.saveFailed"));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(timeOffId: string) {
    setError(null);
    setSuccess(null);
    setDeletingId(timeOffId);
    try {
      await barberApi.deleteTimeOff(timeOffId);
      setTimeOff((current) => current.filter((item) => item.id !== timeOffId));
      setSuccess(t("timeOff.deleted"));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("timeOff.deleteFailed"));
    } finally {
      setDeletingId(null);
      setConfirmingId(null);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-4 sm:p-8">
        <div className="mx-auto max-w-2xl space-y-6">
          <div className="flex items-center justify-between gap-3">
            <Skeleton className="h-8 w-56" />
            <Skeleton className="h-11 w-44" />
          </div>
          <Card className="space-y-4 p-6" aria-busy="true">
            <span className="sr-only" role="status">
              {t("timeOff.loading")}
            </span>
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-2/3" />
          </Card>
        </div>
      </div>
    );
  }

  if (profileMissing) {
    return (
      <div className="min-h-screen bg-background p-4 sm:p-8">
        <div className="mx-auto max-w-2xl space-y-6">
          <ProPageHeader title={t("timeOff.title")} />
          <Card className="p-6 text-center">
            <p className="text-foreground">
              {t("timeOff.profileMissing")}
            </p>
            <Link to="/pro/profile" className={`${PRIMARY_LINK_CLASS} mt-4`}>
              {t("common.createProfile")}
            </Link>
          </Card>
        </div>
      </div>
    );
  }

  const busy = saving || deletingId !== null;

  return (
    <div className="min-h-screen bg-background p-4 sm:p-8">
      <div className="mx-auto max-w-2xl space-y-6">
        <ProPageHeader
          title={t("timeOff.title")}
          description={t("timeOff.description")}
        />

        {timezoneStatus === "loaded" && timezone ? (
          <Alert variant="info">
            {t("timeOff.timezone.known", { timezone })}
          </Alert>
        ) : timezoneStatus === "loaded" ? (
          <Alert variant="warning">
            {t("timeOff.timezone.missing")}{" "}
            <Link
              to="/pro/profile"
              className="font-medium text-foreground underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              {t("timeOff.timezone.setLink")}
            </Link>
          </Alert>
        ) : timezoneStatus === "error" ? (
          <Alert variant="warning">
            <p>
              {t("timeOff.timezone.error")}
            </p>
            <Button
              variant="secondary"
              className="mt-3 min-h-[44px]"
              onClick={() => void retryTimezone()}
            >
              {t("common.retry")}
            </Button>
          </Alert>
        ) : null}

        <Card className="space-y-4 p-6">
          <h2 className="text-lg font-bold text-foreground">
            {t("timeOff.form.title")}
          </h2>
          <div className="flex flex-wrap items-end gap-3">
            <Field label={t("timeOff.form.start")} className="w-40" error={fieldErrors.startDate}>
              {(control) => (
                <Input
                  {...control}
                  type="date"
                  value={startDate}
                  disabled={busy}
                  onChange={(event) => {
                    setStartDate(event.target.value);
                    clearFieldError("startDate");
                  }}
                />
              )}
            </Field>
            <Field label={t("timeOff.form.end")} className="w-40" error={fieldErrors.endDate}>
              {(control) => (
                <Input
                  {...control}
                  type="date"
                  value={endDate}
                  disabled={busy}
                  onChange={(event) => {
                    setEndDate(event.target.value);
                    clearFieldError("endDate");
                  }}
                />
              )}
            </Field>
          </div>
          <Field
            label={t("timeOff.form.reason")}
            error={fieldErrors.reason}
          >
            {(control) => (
              <Input
                {...control}
                type="text"
                value={reason}
                disabled={busy}
                maxLength={LIMITS.timeOffReason}
                placeholder={t("timeOff.form.reasonPlaceholder")}
                onChange={(event) => {
                  setReason(event.target.value);
                  clearFieldError("reason");
                }}
              />
            )}
          </Field>
          <p className="text-xs text-foreground-muted">
            {t("timeOff.form.hint", { max: LIMITS.timeOffMaxRangeDays })}
          </p>
          <Button
            className="min-h-[44px]"
            isLoading={saving}
            disabled={busy}
            onClick={() => void handleCreate()}
          >
            {saving ? t("timeOff.form.saving") : t("timeOff.form.submit")}
          </Button>
        </Card>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-foreground">
            {t("timeOff.list.title")}
          </h2>
          {timeOff.length === 0 ? (
            <Card className="p-6 text-center">
              <p className="text-foreground-muted">
                {t("timeOff.list.empty")}
              </p>
            </Card>
          ) : (
            <ul className="space-y-2">
              {timeOff.map((item) => (
                <li key={item.id}>
                  <Card className="p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-medium text-foreground">
                          {formatCalendarDateRange(item.startDate, item.endDate)}
                        </p>
                        {item.reason && (
                          <p className="mt-1 text-sm text-foreground-muted">
                            {item.reason}
                          </p>
                        )}
                      </div>
                      {confirmingId === item.id ? (
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm text-foreground">
                            {t("timeOff.list.deleteQuestion")}
                          </span>
                          <Button
                            variant="secondary"
                            className="min-h-[44px]"
                            disabled={busy}
                            onClick={() => setConfirmingId(null)}
                          >
                            {t("timeOff.list.cancel")}
                          </Button>
                          <Button
                            variant="danger"
                            className="min-h-[44px]"
                            disabled={busy}
                            isLoading={deletingId === item.id}
                            onClick={() => void handleDelete(item.id)}
                          >
                            {deletingId === item.id
                              ? t("timeOff.list.deleting")
                              : t("timeOff.list.confirm")}
                          </Button>
                        </div>
                      ) : (
                        <Button
                          variant="secondary"
                          className="min-h-[44px]"
                          disabled={busy}
                          onClick={() => setConfirmingId(item.id)}
                        >
                          {t("timeOff.list.delete")}
                        </Button>
                      )}
                    </div>
                  </Card>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Résultat affiché en bas de l'écran, là où l'utilisateur a agi
            (issue #56). */}
        <StickyActionBar error={error} success={success} />
      </div>
    </div>
  );
}
