import { intlLocale } from "../i18n";

export type NextSlotDay = "today" | "tomorrow" | "later";

/** Jour civil local (AAAA-MM-JJ) d'un instant, dans le fuseau du navigateur. */
function localDay(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Prochain créneau (lot N1), en heure locale du visiteur : jour relatif
 * (aujourd'hui, demain, sinon nom du jour) et heure. Pur, testable.
 */
export function describeNextSlot(
  iso: string,
  now: Date = new Date(),
  locale: string = intlLocale(),
): { day: NextSlotDay; weekday: string; time: string } {
  const slot = new Date(iso);
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  const day: NextSlotDay =
    localDay(slot) === localDay(now)
      ? "today"
      : localDay(slot) === localDay(tomorrow)
        ? "tomorrow"
        : "later";
  return {
    day,
    weekday: new Intl.DateTimeFormat(locale, { weekday: "long" }).format(slot),
    time: new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit" }).format(slot),
  };
}
