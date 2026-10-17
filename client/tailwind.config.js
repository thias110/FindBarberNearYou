/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  // Survols uniquement sur les appareils qui en ont (plan §2.6) : sur mobile,
  // un `hover:` ne reste plus « collé » après un tap.
  future: {
    hoverOnlyWhenSupported: true,
  },
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Tokens sémantiques (pilotés par client/src/styles/tokens.css).
        // Format `rgb(var(--fb-x) / <alpha-value>)` : canaux RGB séparés par
        // des espaces, ce qui autorise aussi les modificateurs d'opacité
        // (ex. `bg-surface/80`).
        background: "rgb(var(--fb-background) / <alpha-value>)",
        surface: "rgb(var(--fb-surface) / <alpha-value>)",
        "surface-muted": "rgb(var(--fb-surface-muted) / <alpha-value>)",
        foreground: "rgb(var(--fb-foreground) / <alpha-value>)",
        "foreground-muted": "rgb(var(--fb-foreground-muted) / <alpha-value>)",
        border: "rgb(var(--fb-border) / <alpha-value>)",
        "border-strong": "rgb(var(--fb-border-strong) / <alpha-value>)",
        accent: {
          DEFAULT: "rgb(var(--fb-accent) / <alpha-value>)",
          hover: "rgb(var(--fb-accent-hover) / <alpha-value>)",
          soft: "rgb(var(--fb-accent-soft) / <alpha-value>)",
          foreground: "rgb(var(--fb-accent-foreground) / <alpha-value>)",
          // Texte d'accent lisible (liens, mentions) ; `accent` reste pour les fonds.
          strong: "rgb(var(--fb-accent-strong) / <alpha-value>)",
        },
        // Laiton : confiance (étoiles, badge certifié). `brass-strong` est la
        // seule version admise en texte.
        brass: {
          DEFAULT: "rgb(var(--fb-brass) / <alpha-value>)",
          strong: "rgb(var(--fb-brass-strong) / <alpha-value>)",
          soft: "rgb(var(--fb-brass-soft) / <alpha-value>)",
        },
        // Sections « nuit » : identiques dans les deux thèmes.
        night: {
          DEFAULT: "rgb(var(--fb-night) / <alpha-value>)",
          2: "rgb(var(--fb-night-2) / <alpha-value>)",
          muted: "rgb(var(--fb-night-muted) / <alpha-value>)",
        },
        ring: {
          DEFAULT: "rgb(var(--fb-ring) / <alpha-value>)",
          "on-night": "rgb(var(--fb-ring-on-night) / <alpha-value>)",
        },
        // Statuts : le vert (success) est réservé aux états positifs.
        success: "rgb(var(--fb-success) / <alpha-value>)",
        warning: "rgb(var(--fb-warning) / <alpha-value>)",
        danger: {
          DEFAULT: "rgb(var(--fb-danger) / <alpha-value>)",
          foreground: "rgb(var(--fb-danger-foreground) / <alpha-value>)",
        },
        // Cobalt fixe des sections nuit (identique dans les deux thèmes).
        cobalt: "rgb(var(--fb-cobalt) / <alpha-value>)",
        info: "rgb(var(--fb-info) / <alpha-value>)",
      },
      fontFamily: {
        sans: ["var(--fb-font-sans)"],
        display: ["var(--fb-font-display)"],
      },
      // Échelle typographique (§2.2) : tailles fluides pour l'affichage.
      fontSize: {
        display: ["var(--fb-text-display)", { lineHeight: "1.02" }],
        h1: ["var(--fb-text-h1)", { lineHeight: "1.08" }],
        h2: ["var(--fb-text-h2)", { lineHeight: "1.12" }],
        h3: ["var(--fb-text-h3)", { lineHeight: "1.25" }],
        h4: ["var(--fb-text-h4)", { lineHeight: "1.3" }],
      },
      spacing: {
        section: "var(--fb-space-section)",
        block: "var(--fb-space-block)",
        stack: "var(--fb-space-stack)",
      },
      // Rayons pilotés par les tokens (`--fb-radius-*`) : les classes
      // existantes (`rounded-lg`, `rounded-2xl`…) suivent le design system.
      borderRadius: {
        md: "var(--fb-radius-xs)",
        lg: "var(--fb-radius-sm)",
        xl: "var(--fb-radius-md)",
        "2xl": "var(--fb-radius-lg)",
        "3xl": "var(--fb-radius-xl)",
        "4xl": "var(--fb-radius-2xl)",
      },
      // Ombres (§2.1). `card` et `card-sm` restent comme alias des niveaux 2
      // et 1 tant que les composants n'ont pas été migrés (lots DS-2, DS-3).
      boxShadow: {
        1: "var(--fb-shadow-1)",
        2: "var(--fb-shadow-2)",
        3: "var(--fb-shadow-3)",
        cta: "var(--fb-shadow-cta)",
        card: "var(--fb-shadow-2)",
        "card-sm": "var(--fb-shadow-1)",
      },
      // Mouvement (§2.5).
      transitionDuration: {
        instant: "var(--fb-motion-instant)",
        fast: "var(--fb-motion-fast)",
        base: "var(--fb-motion-base)",
        slow: "var(--fb-motion-slow)",
        exit: "var(--fb-motion-exit)",
        signature: "var(--fb-motion-signature)",
      },
      // Entrées des surfaces modales (§2.6.7). Toujours utilisées sous
      // `motion-safe:` : rien ne bouge si l'utilisateur réduit les animations.
      keyframes: {
        "dialog-in": {
          from: { opacity: "0", transform: "scale(.96)" },
          to: { opacity: "1", transform: "scale(1)" },
        },
        "sheet-up": {
          from: { transform: "translateY(100%)" },
          to: { transform: "translateY(0)" },
        },
        "panel-in": {
          from: { transform: "translateX(100%)" },
          to: { transform: "translateX(0)" },
        },
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
      },
      animation: {
        "dialog-in": "dialog-in var(--fb-motion-base) var(--fb-ease-out)",
        "sheet-up": "sheet-up var(--fb-motion-slow) var(--fb-ease-out)",
        "panel-in": "panel-in var(--fb-motion-slow) var(--fb-ease-out)",
        "fade-in": "fade-in var(--fb-motion-base) var(--fb-ease-out)",
      },
      transitionTimingFunction: {
        press: "var(--fb-ease-press)",
        out: "var(--fb-ease-out)",
        exit: "var(--fb-ease-exit)",
      },
    },
  },
  plugins: [],
};
