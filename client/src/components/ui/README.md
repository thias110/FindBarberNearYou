# Design system FindBarber (`components/ui`)

Fondations visuelles de FindBarber (issue #16, palette V2 : issue #27 ; design
system « Dégradé », lot DS-1 : `docs/redesign/03-plan-refonte.md` §2).

## Tokens

- Source unique : `client/src/styles/tokens.css` (variables `--fb-*`, light et
  `.dark`). Les couleurs sont en **canaux RGB séparés par des espaces**
  (`--fb-accent: 35 80 245;`), consommées via
  `rgb(var(--fb-x) / <alpha-value>)`.
- Exposés à Tailwind (`client/tailwind.config.js`) sous des noms sémantiques :
  `bg-background`, `bg-surface`, `bg-surface-muted`, `text-foreground`,
  `text-foreground-muted`, `border-border`, `bg-accent`, `text-accent-foreground`,
  `hover:bg-accent-hover`, `bg-accent-soft`, `text-brass`, `text-brass-strong`,
  `bg-brass-soft`, `bg-night`, `bg-night-2`, `text-night-muted`, `ring-ring`,
  `ring-ring-on-night`, `success`, `warning`, `danger`, `info`.
- Direction « Dégradé » : encre (`foreground`), **cobalt** comme accent de
  marque et CTA (`accent`), **laiton** réservé à la confiance (étoiles, badge
  certifié), sections **nuit** identiques dans les deux thèmes. Le vert est
  réservé au statut `success`.
- Le laiton (`brass`) est un élément d'interface (≥ 3:1) : jamais du texte
  courant. Pour un texte en laiton, `text-brass-strong` (≥ 4.5:1).
- Ombres : `shadow-1` (repos), `shadow-2` (levée, menu), `shadow-3` (feuille,
  modale), `shadow-cta` (CTA du hero uniquement). `shadow-card-sm` et
  `shadow-card` restent des alias de `shadow-1` et `shadow-2` jusqu'à la
  migration des composants.
- Rayons (hiérarchie par rôle) : `rounded-md` 6 px, `rounded-lg` 10 px,
  `rounded-xl` 14 px, `rounded-2xl` 20 px, `rounded-3xl` 28 px,
  `rounded-4xl` 40 px, `rounded-full` pour les pilules.
- Mouvement : durées `duration-instant|fast|base|slow|exit|signature`
  (90/160/240/420/180/900 ms), courbes `ease-press`, `ease-out` (redéfinie en
  `cubic-bezier(.22,1,.36,1)`), `ease-exit`. `prefers-reduced-motion` reste
  neutralisé globalement (`index.css`).
- Espacements de section : `py-section`, `mb-block`, `gap-stack`.

## Palette et contrastes (WCAG 2.1 AA)

Valeurs de `client/src/styles/tokens.css`. Les ratios sont vérifiés
automatiquement par `tests/src/contrast.test.ts` (texte ≥ 4.5:1, composants
d'interface ≥ 3:1), y compris badges (`/15`), alertes (`/10`), laiton et
sections nuit : toute modification de palette qui casse l'AA fait échouer la CI.

| Token | Usage | Clair | Sombre | Contraste clair / sombre |
|---|---|---|---|---|
| `background` | Fond de page | `#F6F7FB` | `#070B17` | — |
| `surface` | Cartes, champs | `#FFFFFF` | `#0E1528` | — |
| `surface-muted` | Fonds secondaires | `#EEF1F7` | `#16203A` | — |
| `foreground` | Texte principal | `#0C1428` | `#EDF1FA` | 17.1:1 / 17.4:1 (sur `background`) |
| `foreground-muted` | Texte secondaire | `#4A5672` | `#A3AEC8` | 7.3:1 / 8.2:1 (sur `surface`) |
| `accent` | Boutons primaires | `#2350F5` | `#7C9BFF` | — |
| `accent-strong` | Texte d'accent (liens) | `#1A3CC4` | `#8FA8FF` | 8.4:1 / 8.0:1 (sur `surface`) |
| `accent-foreground` | Texte des boutons primaires | `#FFFFFF` | `#050A1A` | 5.9:1 / 7.5:1 (sur `accent`) |
| `border` | Séparateurs, bordures de cartes | `#DCE1EB` | `#24304D` | — |
| `border-strong` | Bordures de champs (≥ 3:1) | `#7A859E` | `#5D6B8C` | 3.7:1 / 3.4:1 (sur `surface`) |
| `brass` | Étoiles, bordure du badge certifié | `#B07A22` | `#E2B66A` | 3.7:1 / 9.6:1 (sur `surface`) |
| `brass-strong` | Texte en laiton | `#8A5A12` | `#E2B66A` | 5.9:1 / 9.6:1 (sur `surface`) |
| `brass-soft` | Fond du badge certifié | `#F7EEDC` | `#2E2614` | — |
| `night` / `night-2` | Sections nuit (deux thèmes) | `#0A1024` / `#121A33` | idem | blanc 18.9:1 |
| `night-muted` | Texte secondaire sur nuit | `#A7B1CC` | idem | 8.8:1 (sur `night`) |
| `ring` | Anneau de focus | `#2350F5` | `#8FA8FF` | 5.5:1 / 8.6:1 (sur `background`) |
| `ring-on-night` | Focus sur section nuit | `#8FA8FF` | idem | 8.3:1 (sur `night`) |
| `success` | Statut positif | `#1E7148` | `#55C793` | 6.0:1 / 8.6:1 (sur `surface`) |
| `warning` | En attente | `#8A5A00` | `#EDB653` | 5.9:1 / 9.9:1 (sur `surface`) |
| `danger` | Erreur, action destructive | `#B8322A` | `#FF8077` | 6.0:1 / 7.4:1 (sur `surface`) |
| `info` | Information (= `accent-strong`) | `#1A3CC4` | `#8FA8FF` | 8.4:1 / 8.0:1 (sur `surface`) |

Règles : `text-accent-strong` pour du texte d'accent (jamais `text-accent`, réservé
aux fonds) ; `border-border-strong` pour les contrôles de formulaire ;
le laiton ne porte jamais de texte courant (sauf `brass-strong`) ; un statut est
toujours accompagné d'un libellé (jamais la couleur seule).

## Typographie

- Police : `--fb-font-sans`, **Figtree** auto-hébergée via
  `@fontsource-variable/figtree` (importée dans `main.tsx`, servie depuis notre
  origine car la CSP n'autorise que `font-src 'self'`), puis pile système.
  Titres `h1`/`h2`/`h3` en `--fb-font-display` (**Bricolage Grotesque**,
  repli sur Figtree tant que `@fontsource-variable/bricolage-grotesque` n'est
  pas installé et importé dans `main.tsx`) ; `h1`/`h2` resserrés
  (`-0.025em`), `h3`/`h4` à `-0.01em` (`index.css`). Classe `font-display`
  disponible.
- Échelle fluide d'affichage (DS-1) : `text-display`, `text-h1`, `text-h2`,
  `text-h3`, `text-h4` (tailles en `clamp()`, interlignes inclus).
- Échelle : celle de Tailwind, sans tailles arbitraires —
  `text-xs` (12 px, métadonnées), `text-sm` (14 px, corps d'interface, champs,
  boutons), `text-base` (16 px, texte courant), `text-lg` (18 px, titres de
  dialogue), `text-xl` (20 px, titres de section `h2`), `text-2xl`
  (24 px, titres de page `h1`). Graisses : `font-medium` (libellés, boutons),
  `font-semibold` (titres de carte `h3`). Issue #28 : titres de page `h1` en
  `font-extrabold` (`text-2xl sm:text-3xl`), titres de section `h2` en
  `font-bold`, comme la maquette validée en #27.
- Cases à cocher et boutons radio : couleur de marque via `accent-color`
  (`index.css`), `h-5 w-5`, ligne de libellé de 44 px (`min-h-11`).

## Espacements et rayons

- Espacements : échelle Tailwind (multiples de 4 px). Conventions : `p-4`
  dans les cartes de liste, `p-6` dans les cartes de contenu, `space-y-4` /
  `space-y-6` entre blocs, gouttière de page `p-4 sm:p-8`.
- Largeur des pages : `PageContainer` (`width` : `form` 560 px, `reading`
  720 px, `wide` 1040 px, `page` 1280 px ; `stack` : `none | md | lg`). Ne
  plus écrire `mx-auto max-w-* space-y-*` à la main.
- Cibles tactiles : au moins 44 x 44 px (`min-h-11 min-w-11`) pour tout
  élément interactif sur mobile. `Button` l'applique dans toutes les tailles ;
  `sm` ne se resserre (36 px) qu'à partir de `sm:`, les pastilles et segments
  (40 px) aussi.
- Rayons : voir la section Tokens (hiérarchie 6 → 40 px). Boutons, pastilles
  et badges en pilule, champs en `rounded-lg` (10 px).

## Navigation (lot DS-4, plan §2.6.6)

- `App.tsx` choisit la coque : visiteur → `PublicHeader` ; CLIENT ou BARBER
  connecté → `AppHeader` + `AppSidebar` (desktop, 248 px, dès `lg:`) +
  `BottomTabBar` (mobile, 64 px + zone de sécurité) ; ADMIN → `AppHeader` et
  la navigation propre d'`AdminLayout`. Les deux barres font 4,5 rem.
- `PublicHeader` : pilule flottante en verre, opaque avec `shadow-2` après
  80 px de défilement. Menu « Pour les pros » (`ProsMenu`, clic ou clavier,
  Échap rend le focus) ; sur mobile, burger et menu plein écran nuit
  (`MobileMenu`, `<dialog>` modal : focus piégé).
- Entrées des espaces connectés : `components/nav/navItems.ts` (une seule
  source pour la barre latérale et les onglets, routes existantes
  uniquement). Les libellés pro de la barre latérale sont ceux des cartes du
  tableau de bord ; ces cartes ne s'affichent plus qu'en mobile.
- Élément actif : `aria-current="page"` (NavLink) ; icône pleine
  (`NavIcon active`).
- `SiteFooter` : section nuit annoncée par le motif « dégradé », colonnes
  Rechercher, Pour les pros, Aide (si un email de support est configuré) et
  Légal ; liens `night-muted` → blanc, focus `focus-ring-on-night`.

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

- Anneau de focus : classes partagées `focus-ring` (cas général),
  `focus-ring-on-surface`, `focus-ring-inset` et `focus-ring-on-night`
  (`index.css`, couche `components`). Ne jamais recopier
  `focus-visible:ring-*` dans un composant : un test
  (`tests/src/ui-primitives.test.ts`) l'interdit.
- Survols : `hoverOnlyWhenSupported` (`tailwind.config.js`) — un `hover:` ne
  s'applique que sur les appareils qui survolent (pas de survol « collé »
  après un tap). Transformations (levée, pression) toujours sous
  `motion-safe:`.
- `Button` — variantes `primary | secondary | ghost | link | danger |
  danger-solid | inverse | outline-inverse | fab-mobile`, tailles
  `sm | md | lg | xl | icon` (cercle de 44 px, avec `aria-label`).
  `inverse` et `outline-inverse` sont réservées aux sections nuit ;
  `fab-mobile` (CTA collant en bas d'écran) est toujours en `xl`.
  `icon` : icône de tête décorative. `isLoading` : le bouton garde sa couleur,
  refuse les clics (`aria-disabled`, `aria-busy`) et affiche un spinner après
  300 ms. `isSuccess` : coche à la place de l'icône (libellé et durée à la
  charge de l'appelant). `type="button"` par défaut.
- `buttonClasses(variant, size, className)` (`buttonStyles.ts`) — mêmes
  classes que `Button`, pour un lien présenté comme un bouton
  (`<Link className={buttonClasses("secondary")}>`). Ne jamais recopier ces
  classes à la main : `cn()` ne résout pas les conflits Tailwind, donc ne pas
  surcharger `px-*`, `min-h-*` ou `rounded-*` via `className`.
- `chipClasses(selected, { tone, square })` (`chipStyles.ts`) — pastilles de
  choix en pilule (44 px sur mobile, 40 px dès `sm:`) : `tone: "neutral"`
  pour un filtre ou une catégorie (sélection en encre), `tone: "accent"` pour
  un choix de formulaire (créneau, note).
- `SegmentedControl` — sélecteur exclusif (Salon / Chez le pro / Domicile,
  Liste / Carte) : `role="radiogroup"`, flèches du clavier, un seul arrêt de
  tabulation. Construit sur `segmentRailClasses()` et
  `segmentClasses(selected)`, réutilisables seuls si besoin.
- `CONTROL_CLASS` (`control.ts`) — à réutiliser pour tout `<select>`,
  `<textarea>` ou `<input>` natif qui n'utilise pas `Input`. 48 px de haut,
  bordure `accent` au focus, fond `surface-muted` si désactivé ou
  `readonly`.
- `Input` — `forwardRef`, bordure d'erreur (2 px) via `aria-invalid`. Texte
  16 px sur mobile (évite le zoom iOS au focus), 14 px à partir de `sm:`.
- `Field` — label lié, aide et erreur accessibles (render prop qui fournit
  `id`, `aria-invalid`, `aria-describedby` au contrôle). L'erreur s'affiche
  sous le champ avec une icône (pas la couleur seule).
- `Card` — surface arrondie, bordure et ombre légère `shadow-card-sm`
  (padding à la charge de l'appelant).
- `Badge` — variantes `neutral | accent | brass | success | warning | danger |
  info | live` (statuts en fond translucide tokenisé, `bg-{statut}/15` ;
  `live` ajoute un point qui pulse, sauf reduced-motion), tailles
  `sm | md | lg` (22, 26, 30 px). `CertifiedBadge` utilise `brass`.
- `Skeleton` — placeholder décoratif (`aria-hidden`).
- `Select` / `Textarea` — contrôles natifs stylés comme `Input` (classes
  partagées dans `control.ts`, bordure `danger` via `aria-invalid`).
  `Select` fait au moins 44 px de haut.
- `Alert` — `info | success | warning | danger` avec une icône par variante ;
  `role="alert"` pour `danger`, `status` sinon.
- États de page (plan §2.7) :
  - `EmptyState` — motif « dégradé », titre (`h3` par défaut, `headingLevel`),
    une phrase qui dit quoi faire, une action `primary` ;
  - `ErrorState` — icône, titre factuel, cause, « Réessayer » en `secondary`
    (`role="alert"`) ;
  - `useLoadingTimeout(loading)` (`lib/`) — vrai après 10 s de chargement :
    aucun squelette ne tourne sans fin, on bascule sur `ErrorState`
    (`common:state.timeout`). `AdminListState` l'applique déjà.
- `FadeMotif` — le motif « dégradé » en SVG (`currentColor`), géométrie dans
  `fadeMotifGeometry.ts` (testée). Une seule occurrence décorative par écran.
- `Dialog` — boîte modale sur `<dialog>` + `showModal()` (piège de focus,
  `Escape` et fond inerte natifs ; clic sur le fond pour fermer si
  `dismissible`), 440 px max, `shadow-3`, fond nuit flouté, entrée en
  `scale(.96)` sous `motion-safe`. `initialFocus` pour le focus de départ ;
  le focus revient au déclencheur (`useModalDialog`).
- `ConfirmDialog` — confirmation construite sur `Dialog` ; focus initial sur
  « Annuler ». Remplace `window.confirm`. `tone="danger"` confirme avec
  `danger-solid`.
- `Sheet` — feuille modale : monte du bas sur mobile (poignée, glissement vers
  le bas ou Échap pour fermer), panneau latéral de 440 px dès `sm:`. Pied
  collant optionnel (`footer`). Usages : filtres, ville, détail.
- `Accordion` — titres `button` avec `aria-expanded` / `aria-controls`,
  panneaux `region` (FAQ, lot N7).
- Cartes barber (plan §2.6.4), toutes avec lien étendu et levée au survol :
  `BarberPreviewCard` (vitrine, accueil : photo 4/5 voilée de nuit, bouton
  « Réserver » qui se déplie au survol, toujours visible sur mobile),
  `BarberResultCard` (liste de recherche), `BarberCompactCard` (popup,
  favoris). Sans avis : « Nouveau sur FindBarber », jamais « 0,0 ».
- `Button` transmet sa `ref` (`forwardRef`).

## Logo

Point d'insertion unique : `client/src/components/Logo.tsx` (header, écrans
d'authentification). Le favicon `client/public/favicon.svg` reprend le même
dessin avec des couleurs en dur : le mettre à jour en même temps, puis
régénérer `client/public/email-logo.png` (logo des emails, PNG car les clients
mail gèrent mal le SVG) :

```bash
cd server && node -e "require('sharp')('../client/public/favicon.svg',{density:600}).resize(96,96).png().toFile('../client/public/email-logo.png')"
```

## Conventions

- A11y : focus-visible lisible (anneau `focus-ring`), navigation clavier, état
  `disabled`, erreurs reliées par `aria-describedby`.
- Utiliser `cn()` (`client/src/lib/cn.ts`) pour composer les classes.
- Éviter les couleurs en dur : passer par les tokens sémantiques.
