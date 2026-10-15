import { chipClasses } from "../ui/chipStyles";

// Groupe de filtres exclusifs (boutons bascule) : état annoncé via
// `aria-pressed`, cibles >= 44 px et focus visible.
export function FilterChips<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(option.value)}
            className={chipClasses(active)}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
