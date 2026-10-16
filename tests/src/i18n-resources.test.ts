// Ressources de traduction (issues #32 à #35) : mêmes clés dans les quatre
// langues, aucune valeur vide, et chaque clé utilisée dans le code existe en
// français (la langue de repli) : jamais de clé brute à l'écran.
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { LOCALES } from "@findbarber/shared/constants";

const ROOT = path.resolve(__dirname, "../../client/src");
const LOCALES_DIR = path.join(ROOT, "i18n/locales");

type Tree = { [key: string]: string | Tree };

function flatten(tree: Tree, prefix = ""): Map<string, string> {
  const out = new Map<string, string>();
  for (const [key, value] of Object.entries(tree)) {
    const full = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "string") out.set(full, value);
    else for (const [k, v] of flatten(value, full)) out.set(k, v);
  }
  return out;
}

function load(locale: string): Map<string, string> {
  const all = new Map<string, string>();
  for (const file of readdirSync(path.join(LOCALES_DIR, locale))) {
    if (!file.endsWith(".json")) continue;
    const ns = file.replace(/\.json$/, "");
    const tree = JSON.parse(readFileSync(path.join(LOCALES_DIR, locale, file), "utf8"));
    for (const [k, v] of flatten(tree)) all.set(`${ns}:${k}`, v);
  }
  return all;
}

// Clés de pluriel i18next (`_one`, `_other`…) : la forme de base suffit.
function base(key: string): string {
  return key.replace(/_(zero|one|two|few|many|other)$/, "");
}

const resources = Object.fromEntries(LOCALES.map((l) => [l, load(l)]));
const frBases = new Set([...resources.fr.keys()].map(base));

describe("ressources de traduction", () => {
  it("ont les mêmes clés dans les quatre langues", () => {
    const fr = [...frBases].sort();
    for (const locale of LOCALES) {
      const keys = [...new Set([...resources[locale].keys()].map(base))].sort();
      expect(keys, locale).toEqual(fr);
    }
  });

  it("n'ont aucune valeur vide", () => {
    for (const locale of LOCALES) {
      for (const [key, value] of resources[locale]) {
        expect(value.trim(), `${locale} ${key}`).not.toBe("");
      }
    }
  });

  it("couvrent toutes les clés littérales utilisées dans le code", () => {
    const missing: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir)) {
        const full = path.join(dir, entry);
        if (statSync(full).isDirectory()) {
          if (entry !== "i18n") walk(full);
          continue;
        }
        if (!/\.(ts|tsx)$/.test(entry)) continue;
        const source = readFileSync(full, "utf8");
        const nsMatch = source.match(/useTranslation\(\s*(?:\[\s*)?"([\w-]+)"/);
        const defaultNs = nsMatch ? nsMatch[1] : "common";
        for (const m of source.matchAll(/\bt\(\s*"([\w.:-]+)"/g)) {
          const raw = m[1];
          const key = raw.includes(":") ? raw : `${defaultNs}:${raw}`;
          // Repli i18next : une clé absente de l'espace courant est cherchée
          // dans `common`.
          const fallback = `common:${raw}`;
          if (!frBases.has(key) && !frBases.has(fallback)) {
            missing.push(`${path.relative(ROOT, full)} → ${key}`);
          }
        }
      }
    };
    walk(ROOT);
    expect(missing).toEqual([]);
  });
});
