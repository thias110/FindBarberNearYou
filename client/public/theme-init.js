// Anti-flash : applique le thème avant le chargement de React pour éviter
// tout clignotement clair/sombre. Clé localStorage : fb-theme.
// Fichier externe (et non script inline) pour permettre une CSP stricte
// `script-src 'self'` côté Nginx.
(function () {
  try {
    var stored = window.localStorage.getItem("fb-theme");
    var preference =
      stored === "light" || stored === "dark" || stored === "system"
        ? stored
        : "system";
    var prefersDark = window.matchMedia(
      "(prefers-color-scheme: dark)",
    ).matches;
    var isDark = preference === "dark" || (preference === "system" && prefersDark);
    var root = document.documentElement;
    root.classList.toggle("dark", isDark);
    root.style.colorScheme = isDark ? "dark" : "light";
  } catch {
    /* localStorage indisponible : on garde le thème par défaut. */
  }
})();
