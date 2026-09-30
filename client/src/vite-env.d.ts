/// <reference types="vite/client" />

// Variables d'environnement publiques exposées au navigateur (préfixe VITE_).
// Vite ne charge QUE ces variables côté client : aucun secret ne doit y figurer.
interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  // Clé PUBLIQUE MapTiler, restreinte par "Allowed HTTP origins" dans le compte.
  // Ce n'est pas un secret : elle est visible dans le réseau. Jamais un service token.
  readonly VITE_MAP_API_KEY?: string;
  // Identifiant de style MapTiler (ex. dataviz-v4, base-v4).
  readonly VITE_MAP_STYLE_ID?: string;
  // URL de style MapLibre complète (prioritaire si renseignée) pour un style personnalisé.
  readonly VITE_MAP_STYLE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
