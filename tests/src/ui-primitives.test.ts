// Primitives du design system (lot DS-2, plan docs/redesign/03-plan-refonte.md
// §2.6) : contrat des fonctions de classes partagées et garde-fous contre le
// retour des copies d'anneau de focus.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  buttonClasses,
  type ButtonSize,
  type ButtonVariant,
} from "../../client/src/components/ui/buttonStyles";
import {
  chipClasses,
  segmentClasses,
  segmentRailClasses,
} from "../../client/src/components/ui/chipStyles";
import { CONTROL_CLASS } from "../../client/src/components/ui/control";
import {
  FADE_GAPS,
  FADE_LINE,
  fadeMotifLines,
} from "../../client/src/components/ui/fadeMotifGeometry";

const VARIANTS: ButtonVariant[] = [
  "primary",
  "secondary",
  "ghost",
  "link",
  "danger",
  "danger-solid",
  "inverse",
  "outline-inverse",
  "fab-mobile",
];
const SIZES: ButtonSize[] = ["sm", "md", "lg", "xl", "icon"];

const tokens = (classes: string) => classes.split(/\s+/).filter(Boolean);

// Une transformation (translate/scale) hors `motion-safe:` bougerait même avec
// prefers-reduced-motion.
function unsafeTransforms(classes: string): string[] {
  return tokens(classes).filter(
    (c) => /(^|:)-?(translate|scale)-/.test(c) && !c.startsWith("motion-safe:"),
  );
}

describe("buttonClasses", () => {
  it("garde la signature historique (variante, taille, classes)", () => {
    const classes = buttonClasses("primary", "md", "w-full");
    expect(tokens(classes)).toContain("w-full");
    expect(buttonClasses()).toBe(buttonClasses("primary", "md"));
  });

  it.each(VARIANTS)("%s : anneau de focus partagé et désactivé natif", (v) => {
    const classes = buttonClasses(v);
    expect(classes).toMatch(/\bfocus-ring\b/);
    expect(classes).toContain("disabled:cursor-not-allowed");
  });

  it.each(VARIANTS.flatMap((v) => SIZES.map((s) => [v, s] as const)))(
    "%s / %s : aucune transformation hors motion-safe",
    (v, s) => {
      expect(unsafeTransforms(buttonClasses(v, s))).toEqual([]);
    },
  );

  it.each(["sm", "md", "icon"] as const)(
    "taille %s : cible tactile d'au moins 44 px sur mobile",
    (s) => {
      expect(buttonClasses("secondary", s)).toMatch(/\b(min-h-11|h-11)\b/);
    },
  );

  it("les sections nuit utilisent l'anneau sur nuit", () => {
    expect(buttonClasses("inverse")).toContain("focus-ring-on-night");
    expect(buttonClasses("outline-inverse")).toContain("focus-ring-on-night");
  });

  it("un lien n'impose ni pilule ni hauteur", () => {
    const classes = tokens(buttonClasses("link", "lg"));
    expect(classes).not.toContain("rounded-full");
    expect(classes.some((c) => c.startsWith("min-h-"))).toBe(false);
  });

  it("le CTA flottant mobile est toujours en taille xl", () => {
    expect(buttonClasses("fab-mobile", "sm")).toBe(
      buttonClasses("fab-mobile", "xl"),
    );
  });
});

describe("chips, segments et champs", () => {
  it("une pastille garde 44 px sur mobile", () => {
    expect(chipClasses(false)).toContain("min-h-11");
    expect(chipClasses(true, { tone: "accent" })).toContain("bg-accent");
    expect(unsafeTransforms(chipClasses(false))).toEqual([]);
  });

  it("le segment actif ressort sur le rail", () => {
    expect(segmentRailClasses()).toContain("bg-surface-muted");
    expect(segmentClasses(true)).toContain("bg-surface");
    expect(segmentClasses(false)).not.toContain("bg-surface ");
  });

  it("le champ fait 48 px et signale l'erreur par aria-invalid", () => {
    expect(CONTROL_CLASS).toContain("min-h-12");
    expect(CONTROL_CLASS).toContain("aria-[invalid=true]:border-danger");
    expect(CONTROL_CLASS).toMatch(/\bfocus-ring\b/);
  });
});

describe("anneau de focus partagé", () => {
  const root = fileURLToPath(new URL("../../client/src", import.meta.url));
  const files: string[] = [];
  (function walk(dir: string) {
    for (const name of readdirSync(dir)) {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) walk(path);
      else if (/\.(ts|tsx)$/.test(name)) files.push(path);
    }
  })(root);

  it("aucun composant ne recopie l'anneau `focus-visible:ring-2`", () => {
    const offenders = files.filter((f) =>
      readFileSync(f, "utf8").includes("focus-visible:ring-2"),
    );
    expect(offenders).toEqual([]);
  });
});

describe("motif « dégradé »", () => {
  it("espace ses lignes de 2, 3, 5, 8, 12 puis 18 px (plan §2.4)", () => {
    const ys = fadeMotifLines();
    expect(ys).toHaveLength(FADE_GAPS.length + 1);
    const gaps = ys.slice(1).map((y, i) => y - ys[i] - FADE_LINE);
    expect(gaps).toEqual([2, 3, 5, 8, 12, 18]);
  });
});
