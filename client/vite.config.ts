import { fileURLToPath, URL } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  // Read the shared root .env so VITE_* variables are available to the client.
  envDir: fileURLToPath(new URL("..", import.meta.url)),
  server: {
    port: 5173,
  },
});
