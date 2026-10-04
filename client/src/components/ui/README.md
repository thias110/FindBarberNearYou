# Design system FindBarber (`components/ui`)

Fondations visuelles de FindBarber (issue #16). Aucune dépendance npm ajoutée.

## Tokens

- Source unique : `client/src/styles/tokens.css` (variables `--fb-*`, light et
  `.dark`). Les couleurs sont en **canaux RGB séparés par des espaces**
  (`--fb-accent: 184 107 43;`), consommées via
  `rgb(var(--fb-x) / <alpha-value>)`.
- Exposés à Tailwind (`client/tailwind.config.js`) sous des noms sémantiques :
  `bg-background`, `bg-surface`, `bg-surface-muted`, `text-foreground`,
  `text-foreground-muted`, `border-border`, `bg-accent`, `text-accent-foreground`,
  `hover:bg-accent-hover`, `bg-accent-soft`, `border-gold`, `bg-gold-soft`,
  `success`, `warning`, `danger`, `info`, `shadow-card`, `shadow-card-sm`.
- Direction visuelle : **cuivre / ambre chaud** comme accent de marque et CTA
  (`accent`, `accent-hover`, `accent-soft`). Le vert n'est plus une couleur de
  marque : il est réservé au statut `success` (ex. réservation confirmée).
- `brand-*` est conservé comme **palette de compatibilité cuivrée**
  (`brand-50` → `#FBF4EC` … `brand-900` → `#5C3417`), sans renommage de classe.
- L'or (`gold`) est réservé aux badges, icônes et petites touches premium :
  jamais pour du texte courant.

## Thème

- `ThemeProvider` (`client/src/app/ThemeProvider.tsx`) gère la préférence
  `system` / `light` / `dark`, persistée dans `localStorage` sous `fb-theme`.
- `darkMode: "class"` : la classe `dark` est posée sur `<html>`.
- Un script anti-flash dans `client/index.html` applique le thème avant React.
- `useTheme()` (`client/src/app/theme-context.ts`) expose `theme`,
  `resolvedTheme` et `setTheme`.
- Le mode `system` suit `prefers-color-scheme` et réagit aux changements.

## Composants

- `Button` — variantes `primary | secondary | ghost | danger`, tailles `sm | md`,
  `isLoading`, `type="button"` par défaut, focus-visible et disabled gérés.
- `Input` — `forwardRef`, bordure d'erreur via `aria-invalid`.
- `Field` — label lié, aide et erreur accessibles (render prop qui fournit
  `id`, `aria-invalid`, `aria-describedby` au contrôle).
- `Card` — surface arrondie + ombre tokenisée (padding à la charge de l'appelant).
- `Badge` — variantes `neutral | accent | gold | success | warning | danger |
  info` (statuts en fond translucide tokenisé, `bg-{statut}/15`).
- `Skeleton` — placeholder décoratif (`aria-hidden`).

## Conventions

- A11y : focus-visible lisible (anneau accent), navigation clavier, état
  `disabled`, erreurs reliées par `aria-describedby`.
- Utiliser `cn()` (`client/src/lib/cn.ts`) pour composer les classes.
- Éviter les couleurs en dur : passer par les tokens sémantiques.
