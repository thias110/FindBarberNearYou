// Configuration de la carte (MapLibre GL JS + MapTiler).
//
// Toutes les valeurs VITE_* sont PUBLIQUES : elles finissent dans le bundle
// navigateur. La clé MapTiler est une clé publique restreinte par origine HTTP ;
// elle n'est jamais un secret, et aucun service token / token d'administration
// ne doit transiter par le client.

const rawKey = (import.meta.env.VITE_MAP_API_KEY ?? "").trim();
const rawStyleId = (import.meta.env.VITE_MAP_STYLE_ID ?? "").trim();
const rawStyleUrl = (import.meta.env.VITE_MAP_STYLE_URL ?? "").trim();
// Style sombre OPTIONNEL : URL MapLibre complète fournie par l'opérateur.
// Vide → la carte conserve le style clair en thème sombre (aucune erreur).
const rawDarkStyleUrl = (
  import.meta.env.VITE_MAP_STYLE_DARK_URL ?? ""
).trim();

// Style clair et désaturé, vérifié dans le catalogue MapTiler (famille Dataviz).
// Identifiant réel du style actuel : `dataviz-v4` (alternative Basic : `base-v4`).
// Repli sûr si VITE_MAP_STYLE_ID est absent.
export const DEFAULT_MAP_STYLE_ID = "dataviz-v4";

// Attribution obligatoire (CGU MapTiler §6) : « © MapTiler » + « © OpenStreetMap ».
// Chaîne fixe maîtrisée par le code, jamais construite à partir de données utilisateur.
export const MAP_ATTRIBUTION =
  '© <a href="https://www.maptiler.com/copyright/" target="_blank" rel="noopener noreferrer">MapTiler</a> ' +
  '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors';

export interface MapSettings {
  /** URL de style MapLibre, ou `null` si aucune configuration exploitable. */
  styleUrl: string | null;
  /** `true` si une clé publique ou une URL de style explicite est fournie. */
  configured: boolean;
}

export function getMapSettings(theme: "light" | "dark" = "light"): MapSettings {
  // Thème sombre : uniquement si une URL dédiée est fournie. Sinon, on retombe
  // sur la configuration claire existante (jamais de style inventé).
  if (theme === "dark" && rawDarkStyleUrl) {
    return { styleUrl: rawDarkStyleUrl, configured: true };
  }
  if (rawStyleUrl) {
    return { styleUrl: rawStyleUrl, configured: true };
  }
  if (rawKey) {
    const styleId = rawStyleId || DEFAULT_MAP_STYLE_ID;
    return {
      styleUrl: `https://api.maptiler.com/maps/${encodeURIComponent(
        styleId,
      )}/style.json?key=${encodeURIComponent(rawKey)}`,
      configured: true,
    };
  }
  // Aucune clé : on ne contacte AUCUN fournisseur et on ne substitue jamais
  // une clé de démonstration ou un autre fournisseur.
  return { styleUrl: null, configured: false };
}
