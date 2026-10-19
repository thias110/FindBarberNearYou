import { cn } from "../../lib/cn";

// Icônes de navigation (24 px, trait 1,8). `active` : icône pleine pour
// l'onglet ou l'entrée courante (plan §2.6.6), sinon au trait. Décoratives :
// le libellé visible porte le nom.

export type NavIconName =
  | "home"
  | "search"
  | "calendar"
  | "user"
  | "today"
  | "clock"
  | "pause"
  | "scissors"
  | "store"
  | "image"
  | "card"
  | "chart";

// Formes fermées (remplies si actives) et détails (toujours au trait).
// `fill` : forme fermée, pleine si active. `detail` : traits à l'intérieur de la
// forme (en creux sur la forme pleine). `outer` : traits qui dépassent de la
// forme (manche de la loupe, lames des ciseaux, anses du calendrier) : ils
// gardent la couleur de l'icône, sinon ils disparaissent quand elle est pleine.
const SHAPES: Record<NavIconName, { fill: string; detail?: string; outer?: string }> = {
  home: { fill: "M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-4.5v-6h-5v6H5a1 1 0 0 1-1-1z" },
  search: { fill: "M10.5 4a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13z", outer: "M15.5 15.5 20 20" },
  calendar: { fill: "M4 6.5A1.5 1.5 0 0 1 5.5 5h13A1.5 1.5 0 0 1 20 6.5V19a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z", detail: "M4 10h16", outer: "M8 3v4M16 3v4" },
  user: { fill: "M12 4a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM4.5 20a7.5 6 0 0 1 15 0z" },
  today: { fill: "M4 6.5A1.5 1.5 0 0 1 5.5 5h13A1.5 1.5 0 0 1 20 6.5V19a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z", detail: "M9 14l2 2 4-4", outer: "M8 3v4M16 3v4" },
  clock: { fill: "M12 3.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 0 0 0-17z", detail: "M12 7.5V12l3 2" },
  pause: { fill: "M12 3.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 0 0 0-17z", detail: "M10 9v6M14 9v6" },
  scissors: { fill: "M6.5 4a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5zM6.5 15a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z", outer: "M8.6 8.2 20 18M8.6 15.8 20 6" },
  store: { fill: "M4 9h16v10a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z", detail: "M10 20v-5h4v5", outer: "M3 9l2-5h14l2 5" },
  image: { fill: "M4 5.5A1.5 1.5 0 0 1 5.5 4h13A1.5 1.5 0 0 1 20 5.5v13a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18.5z", detail: "M4 16l4.5-4.5 4 4 2.5-2.5L20 18M15.5 8.5v.01" },
  card: { fill: "M3.5 6.5A1.5 1.5 0 0 1 5 5h14a1.5 1.5 0 0 1 1.5 1.5v11A1.5 1.5 0 0 1 19 19H5a1.5 1.5 0 0 1-1.5-1.5z", detail: "M3.5 10h17M7 15h3" },
  chart: { fill: "M5 13h3v7H5zM10.5 8h3v12h-3zM16 4h3v16h-3z" },
};

export function NavIcon({
  name,
  active = false,
  className,
}: {
  name: NavIconName;
  active?: boolean;
  className?: string;
}) {
  const shape = SHAPES[name];
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 24 24"
      className={cn("h-6 w-6 shrink-0", className)}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={shape.fill} fill={active ? "currentColor" : "none"} />
      {shape.outer && <path d={shape.outer} />}
      {shape.detail && (
        // Détails en creux sur une forme pleine : trait couleur du fond.
        <path
          d={shape.detail}
          className={active ? "text-background" : undefined}
          stroke="currentColor"
        />
      )}
    </svg>
  );
}
