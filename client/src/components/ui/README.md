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

## Palette et contrastes (WCAG 2.1 AA)

Valeurs de `client/src/styles/tokens.css`. Les ratios sont vérifiés
automatiquement par `tests/src/contrast.test.ts` (texte ≥ 4.5:1, composants
d'interface ≥ 3:1), y compris badges (`/15`) et alertes (`/10`) : toute
modification de palette qui casse l'AA fait échouer la CI.

| Token | Usage | Clair | Sombre | Contraste clair / sombre |
|---|---|---|---|---|
| `background` | Fond de page | `#F7F6F2` | `#121212` | — |
| `surface` | Cartes, champs | `#FFFFFF` | `#1B1B1B` | — |
| `surface-muted` | Fonds secondaires | `#EFEDE7` | `#262626` | — |
| `foreground` | Texte principal | `#1C1B1A` | `#F5F3EE` | 15.9:1 / 16.9:1 (sur `background`) |
| `foreground-muted` | Texte secondaire | `#6F6A63` | `#AAA49C` | 5.4:1 / 7.0:1 (sur `surface`) |
| `accent` | Boutons primaires, anneau de focus | `#B86B2B` | `#D88745` | — |
| `accent-strong` | Texte cuivré (liens) | `#935622` | `#D88745` | 5.8:1 / 6.1:1 (sur `surface`) |
| `border` | Séparateurs, bordures de cartes | `#DEDAD2` | `#353535` | — |
| `border-strong` | Bordures de champs (≥ 3:1) | `#908C84` | `#6E6E6E` | 3.3:1 / 3.4:1 (sur `surface`) |
| `gold` | Touches premium (jamais du texte) | `#B9923B` | `#D3B260` | — |
| `success` | Statut positif | `#297052` | `#4CAF7A` | 5.9:1 / 6.3:1 (sur `surface`) |
| `warning` | En attente | `#895B17` | `#D6A33A` | 5.9:1 / 7.5:1 (sur `surface`) |
| `danger` | Erreur, action destructive | `#B83B3B` | `#E87676` | 5.6:1 / 6.0:1 (sur `surface`) |
| `info` | Information | `#3B68A0` | `#6E9ED6` | 5.7:1 / 6.2:1 (sur `surface`) |
| `accent-foreground` | Texte des boutons primaires | `#121212` | `#121212` | 4.6:1 / 6.7:1 (sur `accent`) |

Règles : `text-accent-strong` pour du texte cuivré (jamais `text-accent`, réservé
aux fonds) ; `border-border-strong` pour les contrôles de formulaire ;
l'or ne porte jamais de texte courant ; un statut est toujours accompagné
d'un libellé (jamais la couleur seule).

## Typographie

- Police : `--fb-font-sans` (Inter local si installé, puis pile système ; aucun
  téléchargement).
- Échelle : celle de Tailwind, sans tailles arbitraires —
  `text-xs` (12 px, métadonnées), `text-sm` (14 px, corps d'interface, champs,
  boutons), `text-base` (16 px, texte courant), `text-lg` (18 px, titres de
  dialogue), `text-xl` (20 px, titres de section `h2`), `text-2xl`
  (24 px, titres de page `h1`). Graisses : `font-medium` (libellés, boutons),
  `font-semibold` (titres).

## Espacements et rayons

- Espacements : échelle Tailwind (multiples de 4 px). Conventions : `p-4`
  dans les cartes de liste, `p-6` dans les cartes de contenu, `space-y-4` /
  `space-y-6` entre blocs, gouttière de page `p-4 sm:p-8`.
- Cibles tactiles : `min-h-11` (44 px) pour tout élément interactif
  (`Button` md l'applique par défaut).
- Rayons (tokens `--fb-radius-*`, appliqués via les classes Tailwind
  redéfinies) : `rounded-md` → `--fb-radius-sm`, `rounded-lg` →
  `--fb-radius-control` (boutons, champs), `rounded-xl` → `--fb-radius-panel`,
  `rounded-2xl` → `--fb-radius-card` (cartes, dialogues), `rounded-full`
  (pastilles, avatars).

## Thème

- `ThemeProvider` (`client/src/app/ThemeProvider.tsx`) gère la préférence
  `system` / `light` / `dark`, persistée dans `localStorage` sous `fb-theme`.
- `darkMode: "class"` : la classe `dark` est posée sur `<html>`.
- Un script anti-flash (`client/public/theme-init.js`, chargé en bloquant
  depuis `client/index.html`) applique le thème avant React. Il est externe
  pour rester compatible avec la CSP `script-src 'self'` de Nginx.
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
- `Select` / `Textarea` — contrôles natifs stylés comme `Input` (classes
  partagées dans `control.ts`, bordure `danger` via `aria-invalid`).
  `Select` fait au moins 44 px de haut.
- `Alert` — `info | success | warning | danger` ; `role="alert"` pour
  `danger`, `status` sinon.
- `EmptyState` — état vide d'une liste (titre, description, action optionnelle).
- `ConfirmDialog` — confirmation modale basée sur `<dialog>` + `showModal()`
  (piège de focus, `Escape` et fond inerte natifs ; focus initial sur
  « Annuler », retour du focus au déclencheur). Remplace `window.confirm`.
  `tone="danger"` pour les actions destructives.
- `Button` transmet sa `ref` (`forwardRef`).

## Logo

Point d'insertion unique : `client/src/components/Logo.tsx` (header, écrans
d'authentification). Le favicon `client/public/favicon.svg` reprend le même
dessin avec des couleurs en dur : le mettre à jour en même temps.

## Conventions

- A11y : focus-visible lisible (anneau accent), navigation clavier, état
  `disabled`, erreurs reliées par `aria-describedby`.
- Utiliser `cn()` (`client/src/lib/cn.ts`) pour composer les classes.
- Éviter les couleurs en dur : passer par les tokens sémantiques.
