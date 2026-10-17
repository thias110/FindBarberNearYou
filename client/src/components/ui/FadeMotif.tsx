import { cn } from "../../lib/cn";
import { FADE_LINE, fadeMotifLines } from "./fadeMotifGeometry";

// Motif « dégradé » (design system, plan §2.4) : lignes horizontales de 2 px
// dont l'écart augmente (2, 3, 5, 8, 12, 18 px), du plein vers le vide, comme
// un dégradé de coupe. Décoratif, sans image à charger. La couleur suit
// `currentColor` : l'appelant la fixe (ex. `text-accent/20`).

const LINE = FADE_LINE;
const LINES = fadeMotifLines();
const HEIGHT = LINES[LINES.length - 1] + LINE;

export function FadeMotif({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox={`0 0 100 ${HEIGHT}`}
      preserveAspectRatio="none"
      className={cn("block", className)}
    >
      {LINES.map((y) => (
        <rect key={y} x="0" y={y} width="100" height={LINE} fill="currentColor" />
      ))}
    </svg>
  );
}
