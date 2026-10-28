import { useTranslation } from "react-i18next";
import type { BookingSlotDto, BookingSlotsDay } from "@findbarber/shared/types";
import { cn } from "../../lib/cn";
import { formatMinutes } from "../../lib/time";
import { Button } from "../ui/Button";
import { EmptyState } from "../ui/EmptyState";
import { ErrorState } from "../ui/ErrorState";
import { Skeleton } from "../ui/Skeleton";
import {
  formatDayLong,
  formatDayNumber,
  formatWeekRange,
  formatWeekdayShort,
} from "./format";

export interface SelectedSlot {
  date: string;
  slot: BookingSlotDto;
}

export interface WeekGridProps {
  /** Les 7 jours civils de la semaine affichée, dans l'ordre. */
  dates: string[];
  today: string;
  /** `null` tant que la semaine n'est pas chargée. */
  days: BookingSlotsDay[] | null;
  loading: boolean;
  error: string | null;
  selected: SelectedSlot | null;
  disabled?: boolean;
  canPrevious: boolean;
  canNext: boolean;
  onPrevious: () => void;
  onNext: () => void;
  onRetry: () => void;
  onSelect: (selection: SelectedSlot) => void;
  /** Erreur de validation ou refus serveur : relie la grille à son message. */
  errorId?: string;
  invalid?: boolean;
}

function Chevron({ direction }: { direction: "left" | "right" }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 16 16"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={direction === "left" ? "M10 3.5L5.5 8l4.5 4.5" : "M6 3.5L10.5 8 6 12.5"} />
    </svg>
  );
}

function Check() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 16 16"
      className="h-3.5 w-3.5 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 8.5l3.2 3L13 4.5" />
    </svg>
  );
}

// Défilement horizontal avec accroche sur mobile (une colonne de 72 px par
// jour), 7 colonnes égales dès `sm:`.
const TRACK =
  "-mx-4 flex snap-x snap-mandatory gap-2 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-7 sm:overflow-visible sm:px-0 sm:pb-0";
const COLUMN = "w-[4.75rem] shrink-0 snap-start sm:w-auto";

export function WeekGrid({
  dates,
  today,
  days,
  loading,
  error,
  selected,
  disabled = false,
  canPrevious,
  canNext,
  onPrevious,
  onNext,
  onRetry,
  onSelect,
  errorId,
  invalid = false,
}: WeekGridProps) {
  const { t } = useTranslation("client");

  const slotsByDate = new Map<string, BookingSlotDto[]>(
    (days ?? []).map((day) => [day.date, day.slots]),
  );
  const weekHasSlots = dates.some((date) => (slotsByDate.get(date)?.length ?? 0) > 0);
  const weekLabel = formatWeekRange(dates[0], dates[dates.length - 1]);

  let body;
  if (loading) {
    body = (
      <div aria-busy="true">
        <span className="sr-only" role="status">
          {t("booking.flow.slots.loading")}
        </span>
        <div className={TRACK}>
          {dates.map((date) => (
            <div key={date} className={COLUMN}>
              <Skeleton className="h-16 w-full rounded-xl" />
              <div className="mt-2 space-y-2">
                {[0, 1, 2, 3].map((index) => (
                  <Skeleton key={index} className="h-11 w-full rounded-xl" />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  } else if (error) {
    body = (
      <ErrorState
        title={t("booking.flow.slots.errorTitle")}
        description={error}
        onRetry={onRetry}
        retryLabel={t("booking.flow.slots.retry")}
      />
    );
  } else if (days && !weekHasSlots) {
    body = (
      <EmptyState
        title={t("booking.flow.slots.emptyTitle")}
        description={
          canNext
            ? t("booking.flow.slots.emptyHint")
            : t("booking.flow.slots.emptyHintLast")
        }
        action={
          canNext ? (
            <Button variant="primary" onClick={onNext}>
              {t("booking.flow.slots.nextWeek")}
            </Button>
          ) : undefined
        }
      />
    );
  } else {
    body = (
      <div
        role="group"
        aria-label={t("booking.flow.slots.group")}
        aria-describedby={invalid && errorId ? errorId : undefined}
        data-invalid={invalid ? "true" : undefined}
        className={TRACK}
      >
        {dates.map((date) => {
          const slots = slotsByDate.get(date) ?? [];
          const empty = slots.length === 0;
          const isToday = date === today;
          const hasSelected = selected?.date === date;
          const longDate = formatDayLong(date);
          return (
            <div
              key={date}
              role="group"
              aria-label={cn(
                longDate,
                isToday && `(${t("booking.flow.slots.today")})`,
                empty && `- ${t("booking.flow.slots.dayEmpty")}`,
              )}
              aria-disabled={empty || undefined}
              className={COLUMN}
            >
              <div
                className={cn(
                  "rounded-xl border py-2 text-center transition-colors duration-fast",
                  hasSelected
                    ? "border-accent bg-accent-soft text-accent-strong"
                    : isToday
                      ? "border-accent/40 bg-accent-soft text-accent-strong"
                      : empty
                        ? "border-border/60 bg-surface-muted/50 text-foreground-muted"
                        : "border-border bg-surface-muted text-foreground",
                )}
              >
                <p
                  className={cn(
                    "text-xs font-semibold capitalize",
                    hasSelected || isToday ? "text-accent-strong" : "text-foreground-muted",
                  )}
                >
                  {formatWeekdayShort(date)}
                </p>
                <p
                  className={cn(
                    "font-display text-base font-extrabold tabular-nums",
                    empty && "line-through decoration-1",
                  )}
                >
                  {formatDayNumber(date)}
                </p>
                <span
                  aria-hidden="true"
                  className={cn(
                    "mx-auto mt-0.5 block h-1.5 w-1.5 rounded-full",
                    isToday ? "bg-accent" : "bg-transparent",
                  )}
                />
              </div>
              <div className="mt-2 space-y-2">
                {empty ? (
                  <span
                    aria-hidden="true"
                    className="block py-3 text-center text-foreground-muted/50"
                  >
                    –
                  </span>
                ) : (
                  slots.map((slot) => {
                    const isSelected =
                      selected?.date === date &&
                      selected.slot.startMinute === slot.startMinute;
                    const time = formatMinutes(slot.startMinute);
                    return (
                      <button
                        key={slot.startMinute}
                        type="button"
                        disabled={disabled}
                        aria-pressed={isSelected}
                        aria-label={`${longDate}, ${time}`}
                        onClick={() => onSelect({ date, slot })}
                        className={cn(
                          "focus-ring-on-surface inline-flex min-h-11 w-full items-center justify-center gap-1 rounded-xl border px-1 text-sm font-semibold tabular-nums",
                          "transition-[color,background-color,border-color,box-shadow] duration-fast ease-out disabled:cursor-not-allowed disabled:opacity-50",
                          isSelected
                            ? "border-accent bg-accent text-accent-foreground shadow-cta"
                            : "border-border bg-surface text-foreground shadow-1 hover:border-accent hover:bg-accent-soft hover:text-accent-strong",
                        )}
                      >
                        {isSelected && <Check />}
                        {time}
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-2 rounded-xl border border-border/70 bg-surface-muted/50 p-1.5">
        <Button
          variant="secondary"
          size="icon"
          aria-label={t("booking.flow.slots.previousWeek")}
          disabled={!canPrevious || disabled}
          onClick={onPrevious}
        >
          <Chevron direction="left" />
        </Button>
        <p aria-live="polite" className="text-sm font-bold tabular-nums text-foreground">
          {weekLabel}
        </p>
        <Button
          variant="secondary"
          size="icon"
          aria-label={t("booking.flow.slots.nextWeekAria")}
          disabled={!canNext || disabled}
          onClick={onNext}
        >
          <Chevron direction="right" />
        </Button>
      </div>
      {body}
    </div>
  );
}
