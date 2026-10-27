import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
} from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import type { PlaceSuggestion } from "@findbarber/shared/types";
import { PLACE_QUERY_MIN } from "@findbarber/shared/validation";
import { placesApi } from "../../lib/apiClient";
import { cn } from "../../lib/cn";

const DEBOUNCE_MS = 250;

interface CityComboboxProps {
  /** `id` de l'`input`, pour le lier à son `label`. */
  id: string;
  value: string;
  onChange: (city: string) => void;
  placeholder?: string;
  /** Classes de l'`input` (le champ garde l'habillage de sa page). */
  className?: string;
  /** Classes du conteneur (largeur, flex). */
  wrapperClassName?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: true;
}

// Champ « Ville » avec suggestions (lot N4, plan §E21) : modèle ARIA
// « combobox + listbox » (le focus reste dans le champ), flèches, Entrée et
// Échap au clavier. Le champ reste un champ texte ordinaire : si le service
// est indisponible ou ne répond rien, aucune erreur n'est affichée et la
// saisie libre continue de fonctionner.
export function CityCombobox({
  id,
  value,
  onChange,
  placeholder,
  className,
  wrapperClassName,
  "aria-describedby": describedBy,
  "aria-invalid": invalid,
}: CityComboboxProps) {
  const { t } = useTranslation("client");
  const listId = useId();
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const [box, setBox] = useState<CSSProperties>({});

  // `query` ne suit que la frappe : choisir une suggestion ou changer la
  // valeur depuis l'extérieur (réinitialiser) ne relance pas de recherche.
  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < PLACE_QUERY_MIN) {
      setSuggestions([]);
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      placesApi
        .suggest(trimmed, controller.signal)
        .then((res) => {
          setSuggestions(res.suggestions);
          setActive(-1);
        })
        .catch(() => {
          if (!controller.signal.aborted) setSuggestions([]);
        });
    }, DEBOUNCE_MS);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  // Un clic ailleurs referme la liste.
  useEffect(() => {
    function onPointerDown(event: PointerEvent) {
      const target = event.target as Node;
      if (
        !wrapperRef.current?.contains(target) &&
        !listRef.current?.contains(target)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

  const expanded = open && suggestions.length > 0;

  // La liste est rendue dans <body> en position fixe, calée sous le champ : les
  // panneaux de recherche défilent ou rognent (overflow) tout ce qui dépasse.
  useLayoutEffect(() => {
    if (!expanded) return;
    function place() {
      const rect = wrapperRef.current?.getBoundingClientRect();
      if (!rect) return;
      setBox({
        position: "fixed",
        left: rect.left,
        top: rect.bottom + 8,
        width: rect.width,
      });
    }
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [expanded]);

  function choose(suggestion: PlaceSuggestion) {
    onChange(suggestion.name);
    setQuery("");
    setSuggestions([]);
    setOpen(false);
    setActive(-1);
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      if (expanded) {
        event.preventDefault();
        setOpen(false);
      }
      return;
    }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      if (suggestions.length === 0) return;
      event.preventDefault();
      if (!open) {
        setOpen(true);
        return;
      }
      const step = event.key === "ArrowDown" ? 1 : -1;
      setActive((current) => {
        const next = current + step;
        if (next < 0) return suggestions.length - 1;
        if (next >= suggestions.length) return 0;
        return next;
      });
      return;
    }
    // Entrée ne valide une suggestion que si l'utilisateur l'a désignée ;
    // sinon elle soumet le formulaire avec la saisie telle quelle.
    if (event.key === "Enter" && expanded && active >= 0) {
      event.preventDefault();
      choose(suggestions[active]!);
    }
  }

  return (
    <div ref={wrapperRef} className={cn("relative", wrapperClassName)}>
      <input
        id={id}
        type="text"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={expanded}
        aria-controls={listId}
        aria-activedescendant={
          expanded && active >= 0 ? `${listId}-${active}` : undefined
        }
        aria-describedby={describedBy}
        aria-invalid={invalid}
        autoComplete="off"
        value={value}
        placeholder={placeholder}
        className={className}
        onChange={(event) => {
          onChange(event.target.value);
          setQuery(event.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
      />
      {createPortal(
        <ul
          ref={listRef}
          id={listId}
          role="listbox"
          aria-label={t("cityField.listLabel")}
          hidden={!expanded}
          style={box}
          className="z-[60] max-h-64 overflow-y-auto rounded-xl border border-border bg-surface p-1 text-foreground shadow-2"
        >
          {suggestions.map((suggestion, index) => (
            <li
              key={suggestion.label}
              id={`${listId}-${index}`}
              role="option"
              aria-selected={index === active}
              // mousedown (et non click) : le champ ne perd pas le focus avant le choix.
              onMouseDown={(event) => {
                event.preventDefault();
                choose(suggestion);
              }}
              onMouseEnter={() => setActive(index)}
              className={cn(
                "flex min-h-11 cursor-pointer items-center rounded-lg px-3 py-2 text-left text-sm",
                index === active && "bg-accent-soft",
              )}
            >
              {suggestion.label}
            </li>
          ))}
        </ul>,
        document.body,
      )}
      <span role="status" className="sr-only">
        {expanded ? t("cityField.count", { count: suggestions.length }) : ""}
      </span>
    </div>
  );
}
