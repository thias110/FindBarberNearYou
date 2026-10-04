import { fileURLToPath, URL } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  // Read the shared root .env so VITE_* variables are available to the client.
  envDir: fileURLToPath(new URL("..", import.meta.url)),
  server: {
    // Écoute sur toutes les interfaces (IPv4 + IPv6) : sinon Vite ne se lie
    // qu'à [::1] et http://127.0.0.1:5173 (ou un navigateur qui résout
    // localhost en IPv4) ne peut pas se connecter.
    host: true,
    port: 5173,
  },
});
