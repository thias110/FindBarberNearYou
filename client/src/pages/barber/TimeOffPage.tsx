import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { LIMITS } from "@findbarber/shared/constants";
import type { TimeOff } from "@findbarber/shared/types";
import { timeOffCreateSchema } from "@findbarber/shared/validation";
import { ApiError, barberApi } from "../../lib/apiClient";
import { formatCalendarDateRange } from "../../lib/date";

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
          setError(err instanceof Error ? err.message : "Chargement impossible.");
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
      setSuccess("Indisponibilité enregistrée.");
    } catch (err) {
      // Le formulaire et la liste affichée restent intacts en cas d'échec.
      setError(err instanceof Error ? err.message : "Enregistrement échoué.");
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
      setSuccess("Indisponibilité supprimée.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Suppression échouée.");
    } finally {
      setDeletingId(null);
      setConfirmingId(null);
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
          <h1 className="text-xl font-semibold text-brand-900">
            Mes indisponibilités
          </h1>
          <p className="mt-2 text-gray-700">
            Créez d'abord votre profil professionnel pour gérer vos
            indisponibilités.
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

  const busy = saving || deletingId !== null;

  return (
    <div className="min-h-screen bg-background p-4 sm:p-8">
      <div className="mx-auto max-w-2xl space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-brand-900">
            Mes indisponibilités
          </h1>
          <p className="mt-1 text-sm text-gray-600">
            Congés et fermetures exceptionnelles, en journées entières.{" "}
            <Link to="/pro/dashboard" className="text-brand-700 underline">
              Retour au tableau de bord
            </Link>
          </p>
        </div>

        {timezoneStatus === "loaded" && timezone ? (
          <p className="rounded-lg bg-brand-50 p-3 text-sm text-brand-800">
            Votre fuseau horaire : {timezone}. Les jours indisponibles sont des
            dates civiles dans ce fuseau.
          </p>
        ) : timezoneStatus === "loaded" ? (
          <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
            Votre fuseau horaire n'est pas renseigné : vous pouvez enregistrer
            vos jours indisponibles, mais ils ne seront interprétés qu'une fois
            votre fuseau défini.{" "}
            <Link to="/pro/profile" className="text-brand-700 underline">
              Définir mon fuseau
            </Link>
          </p>
        ) : timezoneStatus === "error" ? (
          <p className="rounded-lg bg-gray-50 p-3 text-sm text-gray-600">
            Votre fuseau horaire est indisponible pour le moment. Vos jours
            indisponibles restent enregistrés.{" "}
            <button
              type="button"
              onClick={() => void retryTimezone()}
              className="text-brand-700 underline"
            >
              Réessayer
            </button>
          </p>
        ) : null}

        {error && (
          <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>
        )}
        {success && (
          <p className="rounded-lg bg-green-50 p-3 text-sm text-green-700">
            {success}
          </p>
        )}

        <section className="space-y-3 rounded-xl bg-white p-4 shadow">
          <h2 className="font-semibold text-brand-900">
            Ajouter des jours indisponibles
          </h2>
          <div className="flex flex-wrap items-end gap-3">
            <label className="block">
              <span className="text-xs text-gray-600">Début</span>
              <input
                type="date"
                value={startDate}
                disabled={busy}
                onChange={(event) => {
                  setStartDate(event.target.value);
                  clearFieldError("startDate");
                }}
                className="mt-1 rounded-lg border border-gray-300 px-2 py-1.5 disabled:bg-gray-100"
              />
              {fieldErrors.startDate && (
                <p className="mt-1 text-xs text-red-600">
                  {fieldErrors.startDate}
                </p>
              )}
            </label>
            <label className="block">
              <span className="text-xs text-gray-600">Fin</span>
              <input
                type="date"
                value={endDate}
                disabled={busy}
                onChange={(event) => {
                  setEndDate(event.target.value);
                  clearFieldError("endDate");
                }}
                className="mt-1 rounded-lg border border-gray-300 px-2 py-1.5 disabled:bg-gray-100"
              />
              {fieldErrors.endDate && (
                <p className="mt-1 text-xs text-red-600">
                  {fieldErrors.endDate}
                </p>
              )}
            </label>
          </div>
          <label className="block">
            <span className="text-xs text-gray-600">
              Motif (facultatif, privé)
            </span>
            <input
              type="text"
              value={reason}
              disabled={busy}
              maxLength={LIMITS.timeOffReason}
              placeholder="Congés, fermeture exceptionnelle…"
              onChange={(event) => {
                setReason(event.target.value);
                clearFieldError("reason");
              }}
              className="mt-1 w-full rounded-lg border border-gray-300 px-2 py-1.5 disabled:bg-gray-100"
            />
            {fieldErrors.reason && (
              <p className="mt-1 text-xs text-red-600">{fieldErrors.reason}</p>
            )}
          </label>
          <p className="text-xs text-gray-500">
            Début et fin inclus. Une journée unique se saisit avec la même date.
            La période ne peut pas dépasser {LIMITS.timeOffMaxRangeDays} jours.
          </p>
          <button
            type="button"
            onClick={() => void handleCreate()}
            disabled={busy}
            className="rounded-lg bg-brand-700 px-4 py-2 text-white disabled:opacity-50"
          >
            {saving ? "Enregistrement…" : "Ajouter"}
          </button>
        </section>

        <section className="space-y-3 rounded-xl bg-white p-4 shadow">
          <h2 className="font-semibold text-brand-900">Jours indisponibles</h2>
          {timeOff.length === 0 ? (
            <p className="text-sm text-gray-500">
              Aucune indisponibilité enregistrée.
            </p>
          ) : (
            <ul className="space-y-2">
              {timeOff.map((item) => (
                <li
                  key={item.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-gray-200 bg-gray-50 p-3"
                >
                  <div>
                    <p className="text-sm font-medium text-brand-900">
                      {formatCalendarDateRange(item.startDate, item.endDate)}
                    </p>
                    {item.reason && (
                      <p className="text-xs text-gray-600">{item.reason}</p>
                    )}
                  </div>
                  {confirmingId === item.id ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs text-red-700">
                        Supprimer cette indisponibilité ?
                      </span>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => setConfirmingId(null)}
                        className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 disabled:opacity-50"
                      >
                        Annuler
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void handleDelete(item.id)}
                        className="rounded-lg bg-red-600 px-3 py-1.5 text-sm text-white disabled:opacity-50"
                      >
                        {deletingId === item.id ? "Suppression…" : "Confirmer"}
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => setConfirmingId(item.id)}
                      className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 disabled:opacity-50"
                    >
                      Supprimer
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
