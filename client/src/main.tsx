import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
// Traductions (issue #32) : initialisées avant le premier rendu.
import "./i18n";
// Polices auto-hébergées (issue #27) : servies depuis notre origine (CSP
// font-src 'self'). Figtree pour le texte, Bricolage Grotesque pour les titres
// (design system « Dégradé », --fb-font-display).
import "@fontsource-variable/figtree";
import "@fontsource-variable/bricolage-grotesque";
import "./styles/tokens.css";
import "./styles/index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
