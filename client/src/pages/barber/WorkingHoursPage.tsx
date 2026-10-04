import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  LIMITS,
  WEEKDAY_LABELS,
  WEEKDAYS,
  type Weekday,
} from "@findbarber/shared/constants";
import type { WorkingHoursInterval } from "@findbarber/shared/types";
import { workingHoursSchema } from "@findbarber/shared/validation";
import { ApiError, barberApi } from "../../lib/apiClient";
import {
  extractIntervalIndex,
  formatIntervalError,
  formatMinutesRange,
  joinEndMinute,
  minutesToTimeValue,
  parseTimeToMinutes,
  splitEndMinute,
} from "../../lib/time";

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
          setError(err instanceof Error ? err.message : "Chargement impossible.");
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
            "heure de début invalide (HH:MM attendue).",
          );
          continue;
        }
        const endMinute = joinEndMinute(row.endOfDay, row.end);
        if (endMinute === null) {
          nextRowErrors[row.key] = formatIntervalError(
            day.weekday,
            plageNo,
            "heure de fin invalide (HH:MM ou « Fin de journée »).",
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
            issue.message,
          );
        }
      } else {
        banner.push(issue.message);
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
      setSuccess("Planning enregistré.");
      applyIntervals(res.intervals);
      setRowErrors({});
    } catch (err) {
      // Le brouillon n'est pas modifié en cas d'échec.
      setError(err instanceof Error ? err.message : "Enregistrement échoué.");
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
      setSuccess("Planning effacé.");
      applyIntervals([]);
      setRowErrors({});
    } catch (err) {
      setError(err instanceof Error ? err.message : "Effacement échoué.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-8 text-center text-foreground-muted">
        Chargement…
      </div>
    );
  }

  if (profileMissing) {
    return (
      <div className="min-h-screen bg-background p-4 sm:p-8">
        <div className="mx-auto max-w-xl rounded-2xl bg-white p-6 text-center shadow">
          <h1 className="text-xl font-semibold text-brand-900">Mes horaires</h1>
          <p className="mt-2 text-gray-700">
            Créez d'abord votre profil professionnel pour définir vos horaires.
          </p>
          <Link
            to="/pro/profile"
            className="mt-4 inline-block rounded-lg bg-brand-700 px-4 py-2 text-white"
          >
            Créer mon profil
          </Link>
        </div>
      </div>
    );
  }

  const hasContent = days.some((day) => day.intervals.length > 0);

  return (
    <div className="min-h-screen bg-background p-4 sm:p-8">
      <div className="mx-auto max-w-2xl space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-brand-900">Mes horaires</h1>
          <p className="mt-1 text-sm text-gray-600">
            <Link to="/pro/dashboard" className="text-brand-700 underline">
              Retour au tableau de bord
            </Link>
          </p>
        </div>

        {timezoneStatus === "loaded" && timezone ? (
          <p className="rounded-lg bg-brand-50 p-3 text-sm text-brand-800">
            Heures locales du salon ({timezone}). Ce fuseau est choisi sur votre
            profil et servira à calculer vos créneaux de réservation.
          </p>
        ) : timezoneStatus === "loaded" ? (
          <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
            Fuseau non renseigné : la réservation en ligne restera indisponible
            tant que vous n'aurez pas choisi votre fuseau.{" "}
            <Link to="/pro/profile" className="text-brand-700 underline">
              Définir mon fuseau
            </Link>
          </p>
        ) : timezoneStatus === "error" ? (
          <p className="rounded-lg bg-gray-50 p-3 text-sm text-gray-600">
            Fuseau horaire indisponible pour le moment. Votre planning reste
            enregistré en heures murales.{" "}
            <button
              type="button"
              onClick={() => void retryTimezone()}
              className="text-brand-700 underline"
            >
              Réessayer
            </button>
          </p>
        ) : null}

        {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        {success && (
          <p className="rounded-lg bg-green-50 p-3 text-sm text-green-700">{success}</p>
        )}

        <div className="space-y-3">
          {days.map((day) => (
            <section key={day.weekday} className="rounded-xl bg-white p-4 shadow">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={day.enabled}
                  disabled={saving}
                  onChange={() => toggleDay(day.weekday)}
                />
                <span className="font-semibold text-brand-900">
                  {WEEKDAY_LABELS[day.weekday]}
                </span>
              </label>

              {day.enabled && (
                <div className="mt-3 space-y-2">
                  {day.intervals.length === 0 && (
                    <p className="text-sm text-gray-500">Aucune plage ce jour.</p>
                  )}
                  {day.intervals.map((row) => (
                    <div
                      key={row.key}
                      className="flex flex-wrap items-end gap-2 rounded-lg border border-gray-200 bg-gray-50 p-3"
                    >
                      <label className="block">
                        <span className="text-xs text-gray-600">Début</span>
                        <input
                          type="time"
                          value={row.start}
                          disabled={saving}
                          onChange={(event) =>
                            updateInterval(day.weekday, row.key, {
                              start: event.target.value,
                            })
                          }
                          className="mt-1 rounded-lg border border-gray-300 px-2 py-1.5 disabled:bg-gray-100"
                        />
                      </label>
                      <label className="flex items-center gap-1 pb-2 text-sm text-gray-700">
                        <input
                          type="checkbox"
                          checked={row.endOfDay}
                          disabled={saving}
                          onChange={(event) =>
                            updateInterval(day.weekday, row.key, {
                              endOfDay: event.target.checked,
                              end: "",
                            })
                          }
                        />
                        Fin de journée (24:00)
                      </label>
                      <label className="block">
                        <span className="text-xs text-gray-600">Fin</span>
                        <input
                          type="time"
                          disabled={saving || row.endOfDay}
                          value={row.end}
                          onChange={(event) =>
                            updateInterval(day.weekday, row.key, {
                              end: event.target.value,
                            })
                          }
                          className="mt-1 rounded-lg border border-gray-300 px-2 py-1.5 disabled:bg-gray-100"
                        />
                      </label>
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => removeInterval(day.weekday, row.key)}
                        className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm text-gray-700 disabled:opacity-50"
                      >
                        Supprimer
                      </button>
                      {(row.start !== "" || row.endOfDay || row.end !== "") &&
                        (() => {
                          const startMinute = parseTimeToMinutes(row.start);
                          const endMinute = joinEndMinute(row.endOfDay, row.end);
                          return startMinute !== null && endMinute !== null ? (
                            <span className="pb-2 text-sm text-gray-600">
                              {formatMinutesRange(startMinute, endMinute)}
                            </span>
                          ) : null;
                        })()}
                      {rowErrors[row.key] && (
                        <p className="w-full text-xs text-red-600">
                          {rowErrors[row.key]}
                        </p>
                      )}
                    </div>
                  ))}
                  {day.intervals.length < LIMITS.workingHoursMaxIntervalsPerDay && (
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => addInterval(day.weekday)}
                      className="rounded-lg border border-brand-700 px-3 py-1.5 text-sm text-brand-700 disabled:opacity-50"
                    >
                      Ajouter une plage
                    </button>
                  )}
                </div>
              )}
            </section>
          ))}
        </div>

        {confirmingClear && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4">
            <p className="text-sm text-red-800">
              Effacer tous vos horaires enregistrés ?
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setConfirmingClear(false)}
                className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700"
              >
                Annuler
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => {
                  setConfirmingClear(false);
                  void handleClearAll();
                }}
                className="rounded-lg bg-red-600 px-3 py-1.5 text-sm text-white disabled:opacity-50"
              >
                Confirmer
              </button>
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={saving}
            className="rounded-lg bg-brand-700 px-4 py-2 text-white disabled:opacity-50"
          >
            {saving ? "Enregistrement…" : "Enregistrer le planning"}
          </button>
          <button
            type="button"
            onClick={() => setConfirmingClear(true)}
            disabled={saving || !hasContent}
            className="rounded-lg border border-gray-300 px-4 py-2 text-gray-700 disabled:opacity-50"
          >
            Tout effacer
          </button>
        </div>
      </div>
    </div>
  );
}
