// --- Fuseaux IANA (lot 6A) ---
// Liste canonique issue d'Intl.supportedValuesOf("timeZone"), partagée entre
// client (sélecteur) et serveur (validation). UTC est ajouté explicitement :
// supportedValuesOf l'exclut alors qu'Intl.DateTimeFormat l'accepte.
//
// Politique produit (restriction volontaire, pas une limite technique) :
// - "UTC" est accepté (casse insensible, normalisé en "UTC").
// - Les zones à offset fixe "Etc/…" sont REFUSÉES. Ce sont bien des
//   identifiants IANA : elles sont donc classées "restricted", jamais
//   présentées comme invalides.
// - Les offsets ("+01:00") et abréviations seules ("CET") sont refusés :
//   ce ne sont pas des identifiants IANA.
// - Un alias contenant "/" et reconnu par Intl.DateTimeFormat est conservé
//   tel quel : resolvedOptions().timeZone n'est JAMAIS stocké (sa valeur
//   dépend de la version d'ICU, ex. Europe/Kyiv → Europe/Kiev).

const canonicalTimeZones: readonly string[] | null = (() => {
  try {
    if (
      typeof Intl === "undefined" ||
      typeof Intl.supportedValuesOf !== "function"
    ) {
      return null;
    }
    return Intl.supportedValuesOf("timeZone");
  } catch {
    return null;
  }
})();

const canonicalIndex: ReadonlyMap<string, string> | null = canonicalTimeZones
  ? new Map(canonicalTimeZones.map((zone) => [zone.toLowerCase(), zone]))
  : null;

/** Liste canonique + "UTC". Vide si l'environnement ne fournit pas Intl. */
export function listIanaTimeZones(): readonly string[] {
  return canonicalTimeZones ? [...canonicalTimeZones, "UTC"] : [];
}

/** true si la liste canonique est disponible (Intl.supportedValuesOf). */
export function hasIanaTimeZoneList(): boolean {
  return canonicalTimeZones !== null;
}

export type IanaTimeZoneParse =
  | { kind: "empty" }
  | { kind: "valid"; value: string }
  | { kind: "invalid"; reason: "format" | "unknown" }
  | { kind: "restricted"; value: string };

/**
 * Classe une saisie brute (non encore trimée) en quatre états distincts :
 * vide (effacement), valide (normalisée), invalide (offsets, abréviations,
 * noms inconnus) ou restreinte (Etc/…). Ne convertit jamais une valeur
 * invalide en valeur vide : chaque état reste explicite.
 */
export function classifyIanaTimeZone(raw: string): IanaTimeZoneParse {
  const value = raw.trim();
  if (value === "") return { kind: "empty" };

  if (value.toUpperCase() === "UTC") return { kind: "valid", value: "UTC" };

  if (value.toLowerCase().startsWith("etc/")) {
    return { kind: "restricted", value };
  }

  if (!value.includes("/")) return { kind: "invalid", reason: "format" };

  // Correspondance (insensible à la casse) dans la liste canonique → casse
  // canonique stockée. Sans liste (environnement sans supportedValuesOf),
  // on passe directement à la validation Intl.
  if (canonicalIndex) {
    const canonical = canonicalIndex.get(value.toLowerCase());
    if (canonical) return { kind: "valid", value: canonical };
  }

  try {
    // Alias avec "/" reconnu par Intl : conservé tel quel.
    new Intl.DateTimeFormat("en-US", { timeZone: value });
    return { kind: "valid", value };
  } catch {
    return { kind: "invalid", reason: "unknown" };
  }
}
