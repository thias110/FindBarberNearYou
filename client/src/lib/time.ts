import {
  LIMITS,
  WEEKDAY_LABELS,
  type Weekday,
} from "@findbarber/shared/constants";

/**
 * Convertit une saisie « HH:MM » (00:00–23:59) en minutes depuis minuit.
 * « 24:00 » n'est PAS une valeur d'input valide : la fin de journée (1440)
 * passe par le contrôle explicite « Fin de journée (24:00) ».
 * Retourne `null` pour toute valeur invalide.
 */
export function parseTimeToMinutes(value: string): number | null {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  const total = hours * 60 + minutes;
  if (total > LIMITS.workingHoursStartMax) return null; // au plus 23:59
  return total;
}

/**
 * Inverse de `parseTimeToMinutes` pour un `<input type="time">` :
 * 0..1439 → « HH:MM ». `1440` n'est pas représentable par un input
 * type="time" : retourne `null` (utiliser « Fin de journée (24:00) »).
 */
export function minutesToTimeValue(minutes: number): string | null {
  if (!Number.isInteger(minutes) || minutes < 0 || minutes >= 1440) {
    return null;
  }
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
}

/** Affichage uniquement : 1440 → « 24:00 ». Jamais utilisé comme valeur d'input. */
export function formatMinutes(minutes: number): string {
  if (!Number.isInteger(minutes) || minutes < 0 || minutes > LIMITS.workingHoursEndMax) {
    throw new Error(`Minutes invalides : ${minutes}`);
  }
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
}

/** Affichage d'une plage « 09:00 – 12:00 » (ou « 20:00 – 24:00 »). */
export function formatMinutesRange(startMinute: number, endMinute: number): string {
  return `${formatMinutes(startMinute)} – ${formatMinutes(endMinute)}`;
}

/**
 * Sépare la fin de journée (1440) de la valeur éditable d'un input :
 * 1440 → { endOfDay: true, timeValue: "" }, sinon la valeur « HH:MM ».
 * Utilisé au chargement d'une plage pour peupler le formulaire.
 */
export function splitEndMinute(endMinute: number): {
  endOfDay: boolean;
  timeValue: string;
} {
  if (endMinute === LIMITS.workingHoursEndMax) {
    return { endOfDay: true, timeValue: "" };
  }
  return { endOfDay: false, timeValue: minutesToTimeValue(endMinute) ?? "" };
}

/**
 * Reconstruit la minute de fin depuis l'état du formulaire :
 * « Fin de journée » → 1440, sinon parse de l'input. `null` si invalide.
 */
export function joinEndMinute(
  endOfDay: boolean,
  timeValue: string,
): number | null {
  if (endOfDay) return LIMITS.workingHoursEndMax;
  return parseTimeToMinutes(timeValue);
}

/**
 * Extrait l'index d'intervalle d'un chemin d'issue Zod
 * (ex. `["intervals", 2, "endMinute"]` → 2). `null` si absent.
 */
export function extractIntervalIndex(path: (string | number)[]): number | null {
  const position = path.indexOf("intervals");
  if (position === -1) return null;
  const value = path[position + 1];
  return typeof value === "number" ? value : null;
}

/**
 * Préfixe un message d'erreur avec le jour et le numéro de plage
 * (1-based, dans l'ordre d'affichage du formulaire).
 */
export function formatIntervalError(
  weekday: Weekday,
  plageNo: number,
  message: string,
): string {
  return `${WEEKDAY_LABELS[weekday]}, plage ${plageNo} : ${message}`;
}
