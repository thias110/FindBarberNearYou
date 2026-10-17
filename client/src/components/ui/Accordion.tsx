import { useId, useState, type ReactNode } from "react";
import { cn } from "../../lib/cn";

export interface AccordionItem {
  id: string;
  title: string;
  content: ReactNode;
}

export interface AccordionProps {
  items: AccordionItem[];
  /** Niveau des titres selon la hiérarchie de la page (h3 par défaut). */
  headingLevel?: 2 | 3 | 4;
  /** Autoriser plusieurs panneaux ouverts à la fois (vrai par défaut). */
  multiple?: boolean;
  className?: string;
}

// Accordéon accessible (lot DS-3, plan §2.6 et N7) : titre = `button` avec
// `aria-expanded` et `aria-controls`, panneau `region` nommé par son titre.
// Le panneau fermé est `hidden` (hors de l'ordre de tabulation) ; seule la
// flèche tourne, en `motion-base`.
export function Accordion({
  items,
  headingLevel = 3,
  multiple = true,
  className,
}: AccordionProps) {
  const [open, setOpen] = useState<Set<string>>(() => new Set());
  const baseId = useId();
  const Heading = `h${headingLevel}` as "h2" | "h3" | "h4";

  function toggle(id: string) {
    setOpen((current) => {
      const next = new Set(multiple ? current : []);
      if (current.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className={cn("divide-y divide-border rounded-2xl border border-border bg-surface", className)}>
      {items.map((item) => {
        const expanded = open.has(item.id);
        const buttonId = `${baseId}-${item.id}-button`;
        const panelId = `${baseId}-${item.id}-panel`;
        return (
          <div key={item.id}>
            <Heading className="m-0">
              <button
                type="button"
                id={buttonId}
                aria-expanded={expanded}
                aria-controls={panelId}
                onClick={() => toggle(item.id)}
                className="focus-ring-inset flex min-h-14 w-full items-center justify-between gap-4 px-5 py-3 text-left font-sans text-base font-semibold text-foreground transition-colors duration-fast hover:bg-surface-muted first:rounded-t-2xl"
              >
                {item.title}
                <svg
                  aria-hidden="true"
                  viewBox="0 0 20 20"
                  className={cn(
                    "h-5 w-5 shrink-0 text-foreground-muted transition-transform duration-base ease-out",
                    expanded && "rotate-180",
                  )}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.8}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M5 7.5l5 5 5-5" />
                </svg>
              </button>
            </Heading>
            <div
              id={panelId}
              role="region"
              aria-labelledby={buttonId}
              hidden={!expanded}
              className="px-5 pb-5 text-sm text-foreground-muted"
            >
              {item.content}
            </div>
          </div>
        );
      })}
    </div>
  );
}
