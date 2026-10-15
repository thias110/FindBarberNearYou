// Contrastes WCAG 2.1 AA des tokens de design (issue #18). Lit directement
// client/src/styles/tokens.css : tout changement de palette qui casse l'AA
// fait échouer ce test. Texte normal >= 4.5:1, composants d'interface
// (bordure de champ, anneau de focus) >= 3:1.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

type Rgb = [number, number, number];

const css = readFileSync(
  fileURLToPath(new URL("../../client/src/styles/tokens.css", import.meta.url)),
  "utf8",
);

function parseTokens(block: string): Record<string, Rgb> {
  const tokens: Record<string, Rgb> = {};
  for (const [, name, value] of block.matchAll(
    /--fb-([\w-]+):\s*(\d+ \d+ \d+);/g,
  )) {
    tokens[name] = value.split(" ").map(Number) as Rgb;
  }
  return tokens;
}

const [lightBlock, darkBlock] = css.split(".dark");
const THEMES = {
  clair: parseTokens(lightBlock),
  sombre: parseTokens(darkBlock),
};

function luminance([r, g, b]: Rgb): number {
  const channel = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function contrast(a: Rgb, b: Rgb): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

// Couleur translucide (ex. `bg-warning/15`) aplatie sur son fond.
function over(fg: Rgb, bg: Rgb, alpha: number): Rgb {
  return fg.map((v, i) => Math.round(v * alpha + bg[i] * (1 - alpha))) as Rgb;
}

const STATUSES = ["success", "warning", "danger", "info"] as const;

describe.each(Object.entries(THEMES))("contrastes AA, thème %s", (_, t) => {
  const pairs: [string, Rgb, Rgb, number][] = [
    ["texte / fond", t.foreground, t.background, 4.5],
    ["texte / surface", t.foreground, t.surface, 4.5],
    ["texte secondaire / fond", t["foreground-muted"], t.background, 4.5],
    ["texte secondaire / surface", t["foreground-muted"], t.surface, 4.5],
    [
      "texte secondaire / surface-muted",
      t["foreground-muted"],
      t["surface-muted"],
      4.5,
    ],
    ["bouton primaire", t["accent-foreground"], t.accent, 4.5],
    ["bouton primaire survolé", t["accent-foreground"], t["accent-hover"], 4.5],
    ["texte d'accent / surface", t["accent-strong"], t.surface, 4.5],
    ["texte d'accent / fond", t["accent-strong"], t.background, 4.5],
    ["texte d'accent / accent-soft", t["accent-strong"], t["accent-soft"], 4.5],
    ["bordure de champ / surface", t["border-strong"], t.surface, 3],
    ["anneau de focus / fond", t.accent, t.background, 3],
    ...STATUSES.flatMap((s): [string, Rgb, Rgb, number][] => [
      [`${s} / surface`, t[s], t.surface, 4.5],
      [`badge ${s} (/15)`, t[s], over(t[s], t.surface, 0.15), 4.5],
      [`alerte ${s} (/10)`, t[s], over(t[s], t.background, 0.1), 4.5],
    ]),
  ];

  it.each(pairs)("%s", (_label, fg, bg, min) => {
    expect(fg, "token manquant").toBeDefined();
    expect(bg, "token manquant").toBeDefined();
    expect(contrast(fg, bg)).toBeGreaterThanOrEqual(min);
  });
});
