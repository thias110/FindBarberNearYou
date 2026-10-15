import { useTheme, type ThemePreference } from "../app/theme-context";
import { cn } from "../lib/cn";
import { THEME_OPTIONS, themeIcon } from "./themeOptions";

const OPTIONS = THEME_OPTIONS.map((option) => ({
  ...option,
  icon: themeIcon(option.value),
}));

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  const currentIndex = Math.max(
    0,
    OPTIONS.findIndex((option) => option.value === theme),
  );
  const current = OPTIONS[currentIndex];
  const next = OPTIONS[(currentIndex + 1) % OPTIONS.length];

  return (
    <>
      {/* Mobile (issue #28) : trois boutons de 44 px ne tiennent pas dans le
          header, donc un seul bouton de 44 x 44 px qui passe au thème suivant. */}
      <button
        type="button"
        aria-label={`${current.label}. Passer au ${next.label.toLowerCase()}`}
        title={`${current.label} (passer au ${next.label.toLowerCase()})`}
        onClick={() => setTheme(next.value)}
        className={cn(
          "inline-flex h-11 w-11 items-center justify-center rounded-full text-foreground-muted transition-colors hover:bg-surface-muted hover:text-foreground sm:hidden",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
          "focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          className,
        )}
      >
        {current.icon}
      </button>
      <ThemeGroup theme={theme} setTheme={setTheme} className={className} />
    </>
  );
}

function ThemeGroup({
  theme,
  setTheme,
  className,
}: {
  theme: ThemePreference;
  setTheme: (value: ThemePreference) => void;
  className?: string;
}) {
  return (
    <div
      role="group"
      aria-label="Choix du thème"
      className={cn(
        "hidden items-center gap-1 rounded-full border border-border bg-surface p-1 sm:inline-flex",
        className,
      )}
    >
      {OPTIONS.map((option) => {
        const isActive = theme === option.value;
        return (
          <button
            key={option.value}
            type="button"
            aria-label={option.label}
            aria-pressed={isActive}
            title={option.label}
            onClick={() => setTheme(option.value)}
            className={cn(
              "rounded-full p-1.5 transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
              "focus-visible:ring-offset-2 focus-visible:ring-offset-background",
              isActive
                ? "bg-accent-soft text-foreground"
                : "text-foreground-muted hover:bg-surface-muted",
            )}
          >
            {option.icon}
          </button>
        );
      })}
    </div>
  );
}
