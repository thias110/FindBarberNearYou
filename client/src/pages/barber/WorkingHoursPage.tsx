import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import {
  LIMITS,
  WEEKDAYS,
  type Weekday,
} from "@findbarber/shared/constants";
import type { WorkingHoursInterval } from "@findbarber/shared/types";
import { workingHoursSchema } from "@findbarber/shared/validation";
import { ApiError, barberApi } from "../../lib/apiClient";
import { label } from "../../lib/labels";
import { translateValidationMessage } from "../../lib/validationMessages";
import {
  extractIntervalIndex,
  formatIntervalError,
  formatMinutesRange,
  joinEndMinute,
  minutesToTimeValue,
  parseTimeToMinutes,
  splitEndMinute,
} from "../../lib/time";
import { Alert } from "../../components/ui/Alert";
import { StickyActionBar } from "../../components/ui/StickyActionBar";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { Field } from "../../components/ui/Field";
import { Input } from "../../components/ui/Input";
import { Skeleton } from "../../components/ui/Skeleton";
import { ProPageHeader } from "../../components/barber/ProPageHeader";
import { buttonClasses } from "../../components/ui/buttonStyles";

const CHECKBOX_CLASS = "h-5 w-5 shrink-0 accent-accent";

// Lien stylé comme le bouton primaire du design system (aucun `ButtonLink`).
const PRIMARY_LINK_CLASS = buttonClasses("primary");

interface IntervalDraft {
  key: string;
  start: string;
  end: string;
  endOfDay: boolean;
}

interface DayDraft {
  weekday: Weekday;
  enabled: boolean;
  intervals: IntervalDraft[];
}

interface PayloadMeta {
  key: string;
  weekday: Weekday;
  plageNo: number;
}

let nextKey = 0;

function emptyInterval(): IntervalDraft {
  nextKey += 1;
  return { key: `row-${nextKey}`, start: "", end: "", endOfDay: false };
}

function emptyDay(weekday: Weekday): DayDraft {
  return { weekday, enabled: false, intervals: [] };
}

export function BarberWorkingHoursPage() {
  const { t } = useTranslation("barber");
  const [days, setDays] = useState<DayDraft[]>(
    WEEKDAYS.map((weekday) => emptyDay(weekday)),
  );
  const [loading, setLoading] = useState(true);
  const [profileMissing, setProfileMissing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmingClear, setConfirmingClear] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});
  // Fuseau du salon, chargé via GET /profile séparément (contrat de
  // /working-hours inchangé). "error" ≠ "absent" : en cas d'échec de la
  // requête, on n'affiche jamais « fuseau non renseigné ».
  const [timezone, setTimezone] = useState<string | null>(null);
  const [timezoneStatus, setTimezoneStatus] = useState<
    "loading" | "loaded" | "error"
  >("loading");

  // Synchronise le formulaire depuis la liste d'intervalles (chargement
  // initial, réponse d'un PUT réussi ou d'un effacement) — sans GET
  // systématique supplémentaire.
  const applyIntervals = useCallback((intervals: WorkingHoursInterval[]) => {
    const loaded = WEEKDAYS.map((weekday) => emptyDay(weekday));
    for (const interval of intervals) {
      const day = loaded.find((item) => item.weekday === interval.weekday);
      if (!day) continue;
      const { endOfDay, timeValue } = splitEndMinute(interval.endMinute);
      day.enabled = true;
      day.intervals.push({
        key: `row-${++nextKey}`,
        start: minutesToTimeValue(interval.startMinute) ?? "",
        end: timeValue,
        endOfDay,
      });
    }
    setDays(loaded);
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    setTimezoneStatus("loading");
    try {
      // Horaires (autorité de la page) et profil (bandeau fuseau) en parallèle,
      // avec des états d'erreur distincts.
      const [hoursRes, profileRes] = await Promise.allSettled([
        barberApi.getWorkingHours(),
        barberApi.getProfile(),
      ]);
      if (hoursRes.status === "rejected") {
        const err = hoursRes.reason;
        if (err instanceof ApiError && err.code === "BARBER_PROFILE_NOT_FOUND") {
          setProfileMissing(true);
        } else {
          setError(err instanceof Error ? err.message : t("common.loadFailed"));
        }
        return;
      }
      applyIntervals(hoursRes.value.intervals);
      setRowErrors({});
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
  }, [applyIntervals]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // Relance du seul bandeau fuseau : GET /profile uniquement. Ne touche ni au
  // brouillon (days), ni aux erreurs de ligne (rowErrors), ni aux messages du
  // planning (error/success), ni au loading global de la page. La garde
  // synchrone (ref) couvre le double-clic dans le même tick ; le passage à
  // timezoneStatus="loading" masque le bouton dès le rendu suivant.
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

  function clearRowError(key: string) {
    setRowErrors((current) => {
      if (!(key in current)) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });
  }

  function toggleDay(weekday: Weekday) {
    setDays((current) =>
      current.map((day) => {
        if (day.weekday !== weekday) return day;
        if (day.enabled) return { ...day, enabled: false };
        return {
          ...day,
          enabled: true,
          intervals: day.intervals.length > 0 ? day.intervals : [emptyInterval()],
        };
      }),
    );
  }

  function updateInterval(
    weekday: Weekday,
    key: string,
    patch: Partial<IntervalDraft>,
  ) {
    clearRowError(key);
    setDays((current) =>
      current.map((day) =>
        day.weekday === weekday
          ? {
              ...day,
              intervals: day.intervals.map((row) =>
                row.key === key ? { ...row, ...patch } : row,
              ),
            }
          : day,
      ),
    );
  }

  function addInterval(weekday: Weekday) {
    setDays((current) =>
      current.map((day) =>
        day.weekday === weekday &&
        day.intervals.length < LIMITS.workingHoursMaxIntervalsPerDay
          ? { ...day, intervals: [...day.intervals, emptyInterval()] }
          : day,
      ),
    );
  }

  function removeInterval(weekday: Weekday, key: string) {
    clearRowError(key);
    setDays((current) =>
      current.map((day) =>
        day.weekday === weekday
          ? {
              ...day,
              intervals: day.intervals.filter((row) => row.key !== key),
            }
          : day,
      ),
    );
  }

  // Construit le payload et sa correspondance payload→ligne (meta), pour
  // rattacher ensuite les erreurs Zod aux plages concernées. Les erreurs de
  // saisie locales sont rattachées aux lignes directement.
  function buildPayload(): {
    intervals: { weekday: Weekday; startMinute: number; endMinute: number }[];
    meta: PayloadMeta[];
  } | null {
    const intervals: {
      weekday: Weekday;
      startMinute: number;
      endMinute: number;
    }[] = [];
    const meta: PayloadMeta[] = [];
    const nextRowErrors: Record<string, string> = {};
    for (const day of days) {
      if (!day.enabled) continue;
      let plageNo = 0;
      for (const row of day.intervals) {
        plageNo += 1;
        const startMinute = parseTimeToMinutes(row.start);
        if (startMinute === null) {
          nextRowErrors[row.key] = formatIntervalError(
            day.weekday,
            plageNo,
            t("workingHours.errors.startInvalid"),
          );
          continue;
        }
        const endMinute = joinEndMinute(row.endOfDay, row.end);
        if (endMinute === null) {
          nextRowErrors[row.key] = formatIntervalError(
            day.weekday,
            plageNo,
            t("workingHours.errors.endInvalid"),
          );
          continue;
        }
        intervals.push({ weekday: day.weekday, startMinute, endMinute });
        meta.push({ key: row.key, weekday: day.weekday, plageNo });
      }
    }
    if (Object.keys(nextRowErrors).length > 0) {
      setRowErrors(nextRowErrors);
      return null;
    }
    return { intervals, meta };
  }

  // Rattache chaque issue Zod à sa ligne via le chemin (les indices d'origine
  // sont conservés dans le superRefine du schéma partagé). Les issues sans
  // index (racine) restent dans le bandeau global.
  function applySchemaErrors(
    issues: { path: (string | number)[]; message: string }[],
    meta: PayloadMeta[],
  ) {
    const nextRowErrors: Record<string, string> = {};
    const banner: string[] = [];
    for (const issue of issues) {
      const index = extractIntervalIndex(issue.path);
      const entry = index !== null ? meta[index] : undefined;
      if (entry) {
        if (!(entry.key in nextRowErrors)) {
          nextRowErrors[entry.key] = formatIntervalError(
            entry.weekday,
            entry.plageNo,
            translateValidationMessage(issue.message),
          );
        }
      } else {
        banner.push(translateValidationMessage(issue.message));
      }
    }
    setRowErrors(nextRowErrors);
    setError(banner.length > 0 ? banner.join(" ") : null);
  }

  async function handleSave() {
    setError(null);
    setSuccess(null);
    setRowErrors({});
    const payload = buildPayload();
    if (!payload) return;
    const parsed = workingHoursSchema.safeParse(payload);
    if (!parsed.success) {
      applySchemaErrors(parsed.error.issues, payload.meta);
      return;
    }
    setSaving(true);
    try {
      const res = await barberApi.replaceWorkingHours(parsed.data);
      setSuccess(t("workingHours.saved"));
      applyIntervals(res.intervals);
      setRowErrors({});
    } catch (err) {
      // Le brouillon n'est pas modifié en cas d'échec.
      setError(err instanceof Error ? err.message : t("workingHours.saveFailed"));
    } finally {
      setSaving(false);
    }
  }

  async function handleClearAll() {
    setError(null);
    setSuccess(null);
    setSaving(true);
    try {
      await barberApi.replaceWorkingHours({ intervals: [] });
      setSuccess(t("workingHours.cleared"));
      applyIntervals([]);
      setRowErrors({});
    } catch (err) {
      setError(err instanceof Error ? err.message : t("workingHours.clearFailed"));
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-4 sm:p-8">
        <div className="mx-auto max-w-2xl space-y-6">
          <div className="flex items-center justify-between gap-3">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-11 w-44" />
          </div>
          <Card className="space-y-4 p-6" aria-busy="true">
            <span className="sr-only" role="status">
              {t("workingHours.loading")}
            </span>
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </Card>
        </div>
      </div>
    );
  }

  if (profileMissing) {
    return (
      <div className="min-h-screen bg-background p-4 sm:p-8">
        <div className="mx-auto max-w-2xl space-y-6">
          <ProPageHeader title={t("workingHours.title")} />
          <Card className="p-6 text-center">
            <p className="text-foreground">
              {t("workingHours.profileMissing")}
            </p>
            <Link to="/pro/profile" className={`${PRIMARY_LINK_CLASS} mt-4`}>
              {t("common.createProfile")}
            </Link>
          </Card>
        </div>
      </div>
    );
  }

  const hasContent = days.some((day) => day.intervals.length > 0);

  return (
    <div className="min-h-screen bg-background p-4 sm:p-8">
      <div className="mx-auto max-w-2xl space-y-6">
        <ProPageHeader
          title={t("workingHours.title")}
          description={t("workingHours.description")}
        />

        {timezoneStatus === "loaded" && timezone ? (
          <Alert variant="info">
            {t("workingHours.timezone.known", { timezone })}
          </Alert>
        ) : timezoneStatus === "loaded" ? (
          <Alert variant="warning">
            {t("workingHours.timezone.missing")}{" "}
            <Link
              to="/pro/profile"
              className="font-medium text-foreground underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              {t("workingHours.timezone.setLink")}
            </Link>
          </Alert>
        ) : timezoneStatus === "error" ? (
          <Alert variant="warning">
            <p>
              {t("workingHours.timezone.error")}
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

        {!hasContent && (
          <Alert variant="info">
            {t("workingHours.empty")}
          </Alert>
        )}

        <div className="space-y-3">
          {days.map((day) => (
            <Card key={day.weekday} className="p-4">
              <label className="flex min-h-11 items-center gap-2.5">
                <input
                  type="checkbox"
                  className={CHECKBOX_CLASS}
                  checked={day.enabled}
                  disabled={saving}
                  onChange={() => toggleDay(day.weekday)}
                />
                <span className="font-semibold text-foreground">
                  {label("weekday", day.weekday)}
                </span>
              </label>

              {day.enabled && (
                <div className="mt-3 space-y-2">
                  {day.intervals.length === 0 && (
                    <p className="text-sm text-foreground-muted">
                      {t("workingHours.noSlotThisDay")}
                    </p>
                  )}
                  {day.intervals.map((row) => {
                    const startMinute = parseTimeToMinutes(row.start);
                    const endMinute = joinEndMinute(row.endOfDay, row.end);
                    const hasInput =
                      row.start !== "" || row.endOfDay || row.end !== "";
                    const preview =
                      hasInput && startMinute !== null && endMinute !== null
                        ? formatMinutesRange(startMinute, endMinute)
                        : null;
                    return (
                      <div
                        key={row.key}
                        className="rounded-lg border border-border bg-surface-muted p-3"
                      >
                        <div className="flex flex-wrap items-end gap-3">
                          <Field label={t("workingHours.start")} className="w-32">
                            {(control) => (
                              <Input
                                {...control}
                                type="time"
                                value={row.start}
                                disabled={saving}
                                onChange={(event) =>
                                  updateInterval(day.weekday, row.key, {
                                    start: event.target.value,
                                  })
                                }
                              />
                            )}
                          </Field>
                          <Field label={t("workingHours.end")} className="w-32">
                            {(control) => (
                              <Input
                                {...control}
                                type="time"
                                value={row.end}
                                disabled={saving || row.endOfDay}
                                onChange={(event) =>
                                  updateInterval(day.weekday, row.key, {
                                    end: event.target.value,
                                  })
                                }
                              />
                            )}
                          </Field>
                          <label className="flex min-h-11 items-center gap-2.5 text-sm text-foreground">
                            <input
                              type="checkbox"
                              className={CHECKBOX_CLASS}
                              checked={row.endOfDay}
                              disabled={saving}
                              onChange={(event) =>
                                updateInterval(day.weekday, row.key, {
                                  endOfDay: event.target.checked,
                                  end: "",
                                })
                              }
                            />
                            {t("workingHours.endOfDay")}
                          </label>
                          <Button
                            variant="ghost"
                            className="min-h-[44px]"
                            disabled={saving}
                            onClick={() => removeInterval(day.weekday, row.key)}
                          >
                            {t("workingHours.removeSlot")}
                          </Button>
                          {preview && (
                            <span className="pb-2 text-sm text-foreground-muted">
                              {preview}
                            </span>
                          )}
                        </div>
                        {rowErrors[row.key] && (
                          <p role="alert" className="mt-2 text-xs text-danger">
                            {rowErrors[row.key]}
                          </p>
                        )}
                      </div>
                    );
                  })}
                  {day.intervals.length <
                    LIMITS.workingHoursMaxIntervalsPerDay && (
                    <Button
                      variant="secondary"
                      className="min-h-[44px]"
                      disabled={saving}
                      onClick={() => addInterval(day.weekday)}
                    >
                      {t("workingHours.addSlot")}
                    </Button>
                  )}
                </div>
              )}
            </Card>
          ))}
        </div>

        {confirmingClear && (
          <Alert variant="danger">
            <p>{t("workingHours.clearQuestion")}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                variant="secondary"
                className="min-h-[44px]"
                onClick={() => setConfirmingClear(false)}
              >
                {t("workingHours.cancel")}
              </Button>
              <Button
                variant="danger"
                className="min-h-[44px]"
                disabled={saving}
                isLoading={saving}
                onClick={() => {
                  setConfirmingClear(false);
                  void handleClearAll();
                }}
              >
                {t("workingHours.confirm")}
              </Button>
            </div>
          </Alert>
        )}

        {/* Enregistrement et résultat toujours à portée (issue #56). */}
        <StickyActionBar error={error} success={success}>
          <Button
            className="min-h-[44px]"
            isLoading={saving}
            onClick={() => void handleSave()}
          >
            {saving ? t("workingHours.saving") : t("workingHours.save")}
          </Button>
          <Button
            variant="secondary"
            className="min-h-[44px]"
            disabled={saving || !hasContent}
            onClick={() => setConfirmingClear(true)}
          >
            {t("workingHours.clearAll")}
          </Button>
        </StickyActionBar>
      </div>
    </div>
  );
}
