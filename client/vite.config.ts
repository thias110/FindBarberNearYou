import { fileURLToPath, URL } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  const envDir = fileURLToPath(new URL("..", import.meta.url));
  // Adresse de l'API en développement (vide en production : same-origin).
  const apiUrl = loadEnv(mode, envDir, "VITE_").VITE_API_URL || "http://localhost:4000";

  return {
    plugins: [react()],
    // Read the shared root .env so VITE_* variables are available to the client.
    envDir,
    server: {
      // Écoute sur toutes les interfaces (IPv4 + IPv6) : sinon Vite ne se lie
      // qu'à [::1] et http://127.0.0.1:5173 (ou un navigateur qui résout
      // localhost en IPv4) ne peut pas se connecter.
      host: true,
      port: 5173,
      // Pages ville, plan du site et robots.txt (lot N9) : produits par l'API ;
      // en production Nginx les relaie (voir nginx.conf).
      proxy: {
        "/barbers/ville/": apiUrl,
        "/sitemap.xml": apiUrl,
        "/robots.txt": apiUrl,
      },
    },
    build: {
      // Budget de performance (Lot 0) :
      // - chunk principal (React + Router + app) : 500 Ko minifié (~113 Ko gzip)
      // - chunk carte (maplibre-gl, lazy-loadé via BarbersSearchPage) :
      //   1 100 Ko minifié (~285 Ko gzip) — accepté pour le lancement web,
      //   à revoir avant tout lancement mobile (voir README, section Performance).
      chunkSizeWarningLimit: 500,
    },
  };
});
