// --- Fuseaux IANA (lot 6A) ---
// Liste canonique issue d'Intl.supportedValuesOf("timeZone"), partagée entre
// client (sélecteur) et serveur (validation). UTC est ajouté explicitement :
// supportedValuesOf l'exclut alors qu'Intl.DateTimeFormat l'accepte.
//
// Politique produit (restriction volontaire, pas une limite technique) :
// - "UTC" est accepté (casse insensible, normalisé en "UTC").
// - Les zones à offset fixe "Etc/…" sont REFUSÉES. Ce sont bien des
//   identifiants IANA : elles sont donc classées "restricted", jamais
//   présentées comme invalides.
// - Les offsets ("+01:00") et abréviations seules ("CET") sont refusés :
//   ce ne sont pas des identifiants IANA.
// - Un alias contenant "/" et reconnu par Intl.DateTimeFormat est conservé
//   tel quel : resolvedOptions().timeZone n'est JAMAIS stocké (sa valeur
//   dépend de la version d'ICU, ex. Europe/Kyiv → Europe/Kiev).

import { calendarDateToUtcMillis } from "./dates";

const canonicalTimeZones: readonly string[] | null = (() => {
  try {
    if (
      typeof Intl === "undefined" ||
      typeof Intl.supportedValuesOf !== "function"
    ) {
      return null;
    }
    return Intl.supportedValuesOf("timeZone");
  } catch {
    return null;
  }
})();

const canonicalIndex: ReadonlyMap<string, string> | null = canonicalTimeZones
  ? new Map(canonicalTimeZones.map((zone) => [zone.toLowerCase(), zone]))
  : null;

/** Liste canonique + "UTC". Vide si l'environnement ne fournit pas Intl. */
export function listIanaTimeZones(): readonly string[] {
  return canonicalTimeZones ? [...canonicalTimeZones, "UTC"] : [];
}

/** true si la liste canonique est disponible (Intl.supportedValuesOf). */
export function hasIanaTimeZoneList(): boolean {
  return canonicalTimeZones !== null;
}

export type IanaTimeZoneParse =
  | { kind: "empty" }
  | { kind: "valid"; value: string }
  | { kind: "invalid"; reason: "format" | "unknown" }
  | { kind: "restricted"; value: string };

/**
 * Classe une saisie brute (non encore trimée) en quatre états distincts :
 * vide (effacement), valide (normalisée), invalide (offsets, abréviations,
 * noms inconnus) ou restreinte (Etc/…). Ne convertit jamais une valeur
 * invalide en valeur vide : chaque état reste explicite.
 */
export function classifyIanaTimeZone(raw: string): IanaTimeZoneParse {
  const value = raw.trim();
  if (value === "") return { kind: "empty" };

  if (value.toUpperCase() === "UTC") return { kind: "valid", value: "UTC" };

  if (value.toLowerCase().startsWith("etc/")) {
    return { kind: "restricted", value };
  }

  if (!value.includes("/")) return { kind: "invalid", reason: "format" };

  // Correspondance (insensible à la casse) dans la liste canonique → casse
  // canonique stockée. Sans liste (environnement sans supportedValuesOf),
  // on passe directement à la validation Intl.
  if (canonicalIndex) {
    const canonical = canonicalIndex.get(value.toLowerCase());
    if (canonical) return { kind: "valid", value: canonical };
  }

  try {
    // Alias avec "/" reconnu par Intl : conservé tel quel.
    new Intl.DateTimeFormat("en-US", { timeZone: value });
    return { kind: "valid", value };
  } catch {
    return { kind: "invalid", reason: "unknown" };
  }
}

// --- Conversion mural↔UTC (lot 9) ---
// Les horaires sont stockés en minutes murales locales ; les réservations en
// instants UTC. `Intl.DateTimeFormat` fournit l'offset réel (DST compris).
// Aucune dépendance externe (pas de date-fns/Temporal).

export interface ZonedParts {
  /** Date civile `AAAA-MM-JJ` dans le fuseau demandé. */
  date: string;
  /** Minutes depuis minuit local (0..1439). */
  minuteOfDay: number;
}

const formatterCache = new Map<string, Intl.DateTimeFormat>();

function getFormatter(timeZone: string): Intl.DateTimeFormat {
  let formatter = formatterCache.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    formatterCache.set(timeZone, formatter);
  }
  return formatter;
}

function partsToRecord(date: Date, timeZone: string): Record<string, string> {
  const record: Record<string, string> = {};
  for (const part of getFormatter(timeZone).formatToParts(date)) {
    if (part.type !== "literal") record[part.type] = part.value;
  }
  return record;
}

/** Décompose un instant UTC en date civile et minute locale d'un fuseau IANA. */
export function utcToZonedParts(date: Date, timeZone: string): ZonedParts {
  const record = partsToRecord(date, timeZone);
  const year = Number(record.year);
  const month = Number(record.month);
  const day = Number(record.day);
  const hour = Number(record.hour);
  const minute = Number(record.minute);
  return {
    date: `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
    minuteOfDay: hour * 60 + minute,
  };
}

/** Offset du fuseau (ms) à un instant donné : `wallClock - utc`. */
function getTimeZoneOffsetMs(date: Date, timeZone: string): number {
  const record = partsToRecord(date, timeZone);
  const asUtc = Date.UTC(
    Number(record.year),
    Number(record.month) - 1,
    Number(record.day),
    Number(record.hour),
    Number(record.minute),
    Number(record.second),
  );
  return asUtc - Math.floor(date.getTime() / 1000) * 1000;
}

/**
 * Convertit une date civile + minute murale d'un fuseau IANA en instant UTC.
 * Retourne `null` si le fuseau est invalide ou si l'heure murale n'existe pas
 * (heure supprimée par un passage à l'heure d'été). Pour les heures ambiguës
 * (répétées à l'automne), retient la première occurrence.
 */
export function zonedTimeToUtc(
  date: string,
  minuteOfDay: number,
  timeZone: string,
): Date | null {
  if (!Number.isInteger(minuteOfDay) || minuteOfDay < 0 || minuteOfDay > 1439) {
    return null;
  }
  try {
    const wallMs = calendarDateToUtcMillis(date) + minuteOfDay * 60_000;
    // Deux passes : la première estimation peut viser de l'autre côté d'une
    // transition DST ; la seconde utilise l'offset au bon instant.
    let candidate = wallMs - getTimeZoneOffsetMs(new Date(wallMs), timeZone);
    candidate = wallMs - getTimeZoneOffsetMs(new Date(candidate), timeZone);
    const check = utcToZonedParts(new Date(candidate), timeZone);
    if (check.date !== date || check.minuteOfDay !== minuteOfDay) {
      // Heure murale inexistante (ex. 02:30 le jour du passage à l'heure d'été).
      return null;
    }
    return new Date(candidate);
  } catch {
    return null;
  }
}
