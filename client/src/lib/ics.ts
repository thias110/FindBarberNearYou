export interface IcsEvent {
  uid: string;
  title: string;
  /** ISO 8601, e.g. "2026-10-20T07:00:00.000Z". */
  startAt: string;
  /** ISO 8601, e.g. "2026-10-20T07:30:00.000Z". */
  endAt: string;
  location?: string | null;
  description?: string | null;
}

const CRLF = "\r\n";
const MAX_OCTETS = 75;
const FALLBACK_SLUG = "rendez-vous";
const MAX_SLUG_LENGTH = 60;

function parseDate(value: string, label: string): Date {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`${label} : date invalide (${value})`);
  }
  return date;
}

/** Format YYYYMMDDTHHMMSSZ (UTC), as required by RFC 5545 for DATE-TIME. */
function formatUtc(date: Date): string {
  return date
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z");
}

function escapeText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r\n|\r|\n/g, "\\n");
}

function utf8Length(char: string): number {
  const cp = char.codePointAt(0) ?? 0;
  if (cp < 0x80) return 1;
  if (cp < 0x800) return 2;
  if (cp < 0x10000) return 3;
  return 4;
}

/**
 * Folds a content line so that no physical line exceeds 75 octets.
 * Continuation lines start with one space, which counts toward the limit,
 * so they carry at most 74 content octets. Characters are never split.
 */
function foldLine(line: string): string {
  const segments: string[] = [];
  let current = "";
  let used = 0;
  let limit = MAX_OCTETS;

  for (const char of line) {
    const size = utf8Length(char);
    if (used + size > limit) {
      segments.push(current);
      current = "";
      used = 0;
      limit = MAX_OCTETS - 1;
    }
    current += char;
    used += size;
  }
  segments.push(current);

  return segments.join(CRLF + " ");
}

export function buildIcs(event: IcsEvent, now: Date = new Date()): string {
  const start = parseDate(event.startAt, "startAt");
  const end = parseDate(event.endAt, "endAt");
  if (end.getTime() <= start.getTime()) {
    throw new Error("endAt doit être postérieur à startAt");
  }

  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//FindBarber//Reservation//FR",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${event.uid}@findbarber`,
    `DTSTAMP:${formatUtc(now)}`,
    `DTSTART:${formatUtc(start)}`,
    `DTEND:${formatUtc(end)}`,
    `SUMMARY:${escapeText(event.title)}`,
  ];
  if (event.location) {
    lines.push(`LOCATION:${escapeText(event.location)}`);
  }
  if (event.description) {
    lines.push(`DESCRIPTION:${escapeText(event.description)}`);
  }
  lines.push("END:VEVENT", "END:VCALENDAR");

  return lines.map(foldLine).join(CRLF) + CRLF;
}

export function icsFileName(title: string, startAt: string): string {
  const start = parseDate(startAt, "startAt");
  const slug = title
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, MAX_SLUG_LENGTH)
    .replace(/-+$/, "");
  const day = start.toISOString().slice(0, 10);
  return `${slug || FALLBACK_SLUG}-${day}.ics`;
}

export function downloadIcs(event: IcsEvent): void {
  const blob = new Blob([buildIcs(event)], {
    type: "text/calendar;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = icsFileName(event.title, event.startAt);
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
