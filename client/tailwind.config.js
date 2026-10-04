/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Palette de compatibilité alignée sur l'accent cuivre (issue #16).
        brand: {
          50: "#FBF4EC",
          100: "#F5E4D4",
          300: "#E2B48C",
          500: "#C77C3E",
          700: "#955421",
          800: "#8A4E1F",
          900: "#5C3417",
        },
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
        accent: {
          DEFAULT: "rgb(var(--fb-accent) / <alpha-value>)",
          hover: "rgb(var(--fb-accent-hover) / <alpha-value>)",
          soft: "rgb(var(--fb-accent-soft) / <alpha-value>)",
          foreground: "rgb(var(--fb-accent-foreground) / <alpha-value>)",
        },
        gold: {
          DEFAULT: "rgb(var(--fb-gold) / <alpha-value>)",
          soft: "rgb(var(--fb-gold-soft) / <alpha-value>)",
        },
        // Statuts : le vert (success) est réservé aux états positifs.
        success: "rgb(var(--fb-success) / <alpha-value>)",
        warning: "rgb(var(--fb-warning) / <alpha-value>)",
        danger: "rgb(var(--fb-danger) / <alpha-value>)",
        info: "rgb(var(--fb-info) / <alpha-value>)",
      },
      fontFamily: {
        sans: ["var(--fb-font-sans)"],
      },
      boxShadow: {
        card: "var(--fb-shadow-md)",
        "card-sm": "var(--fb-shadow-sm)",
      },
    },
  },
  plugins: [],
};
