import { cn } from "../../lib/cn";
import type { CSSProperties } from "react";
import {
  FADE_LINE,
  fadeMotifLines,
  fadeMotifStartOffsets,
} from "./fadeMotifGeometry";

// Motif « dégradé » (design system, plan §2.4) : lignes horizontales de 2 px
// dont l'écart augmente (2, 3, 5, 8, 12, 18 px), du plein vers le vide, comme
// un dégradé de coupe. Décoratif, sans image à charger. La couleur suit
// `currentColor` : l'appelant la fixe (ex. `text-accent/20`).

const LINE = FADE_LINE;
const LINES = fadeMotifLines();
const HEIGHT = LINES[LINES.length - 1] + LINE;
const START = fadeMotifStartOffsets();
// Décalage entre deux lignes pendant la mise en paliers.
const STAGGER_MS = 40;

export function FadeMotif({
  className,
  animate = false,
}: {
  className?: string;
  /**
   * Joue la « mise en paliers » (moment signature, plan §2.5) : les lignes
   * partent serrées puis s'écartent. Seulement sans reduced-motion ; c'est à
   * l'appelant de ne la jouer qu'une fois par session.
   */
  animate?: boolean;
}) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox={`0 0 100 ${HEIGHT}`}
      preserveAspectRatio="none"
      className={cn("block", className)}
    >
      {LINES.map((y, i) => (
        <rect
          key={y}
          x="0"
          y={y}
          width="100"
          height={LINE}
          fill="currentColor"
          className={animate ? "motion-safe:animate-paliers" : undefined}
          style={
            animate
              ? ({
                  "--fb-from": `${START[i]}px`,
                  animationDelay: `${i * STAGGER_MS}ms`,
                } as CSSProperties)
              : undefined
          }
        />
      ))}
    </svg>
  );
}
