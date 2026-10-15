import { useEffect } from "react";
import { useLocation } from "react-router-dom";

// Ancres de section (issues #31 et #56) : React Router ne fait pas défiler
// vers `#section` lors d'une navigation SPA. On amène la section visée en vue
// et on y place le focus, pour le clavier et les lecteurs d'écran.
// `ready` permet d'attendre la fin d'un chargement avant de chercher la cible.
export function useScrollToHash(ready = true) {
  const { hash } = useLocation();

  useEffect(() => {
    if (!ready || !hash) return;
    // Image suivante : AppShell place d'abord le focus sur <main> après une
    // navigation (effet parent, exécuté après celui-ci).
    const frame = window.requestAnimationFrame(() => {
      const target = document.getElementById(
        decodeURIComponent(hash.slice(1)),
      );
      if (!target) return;
      target.scrollIntoView({ block: "start" });
      if (!target.hasAttribute("tabindex")) {
        target.setAttribute("tabindex", "-1");
      }
      target.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [hash, ready]);
}
