import { useRef, type KeyboardEvent } from "react";
import { segmentClasses, segmentRailClasses } from "./chipStyles";

// Sélecteur à options exclusives (lot DS-2, plan §2.6.1 « segmented ») :
// role="radiogroup" + role="radio", flèches ← → (et ↑ ↓) pour changer la
// sélection, un seul arrêt de tabulation (l'option sélectionnée).

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  disabled?: boolean;
}

export interface SegmentedControlProps<T extends string> {
  /** Nom accessible du groupe (ex. « Lieu du rendez-vous »). */
  label: string;
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}

export function SegmentedControl<T extends string>({
  label,
  options,
  value,
  onChange,
  className,
}: SegmentedControlProps<T>) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const enabled = options.filter((o) => !o.disabled);
  // Un seul arrêt de tabulation : l'option sélectionnée, sinon la première
  // option active.
  const tabStop = options.some((o) => o.value === value)
    ? value
    : enabled[0]?.value;

  function move(event: KeyboardEvent<HTMLDivElement>) {
    const step =
      event.key === "ArrowRight" || event.key === "ArrowDown"
        ? 1
        : event.key === "ArrowLeft" || event.key === "ArrowUp"
          ? -1
          : 0;
    if (step === 0 || enabled.length === 0) return;
    event.preventDefault();
    const current = enabled.findIndex((o) => o.value === value);
    const next = enabled[(current + step + enabled.length) % enabled.length];
    onChange(next.value);
    refs.current[options.indexOf(next)]?.focus();
  }

  return (
    <div
      role="radiogroup"
      aria-label={label}
      onKeyDown={move}
      className={segmentRailClasses(className)}
    >
      {options.map((option, index) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            ref={(el) => {
              refs.current[index] = el;
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={option.value === tabStop ? 0 : -1}
            disabled={option.disabled}
            onClick={() => onChange(option.value)}
            className={segmentClasses(selected)}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
