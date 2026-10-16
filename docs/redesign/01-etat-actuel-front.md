# 01 — État actuel du front FindBarber (point de comparaison)

- **Rédaction** : sous-agent A, avec le skill codebase-design ; relu et contrôlé par le coordinateur.
- **Base** : commit `c85d06d`. Tous les chemins sont relatifs à `client/`, sauf mention contraire.
- **Méthode** : inventaire statique du code, sans rendu de l'application. Les valeurs « calculées » à l'écran n'ont pas été mesurées.
- **Contrôle du coordinateur** : relu en ouvrant `src/components/ui/buttonStyles.ts:9-31`, `src/styles/tokens.css:21-26` et `public/favicon.svg` (`#1463F3`). J'ai aussi refait deux comptages : `focus-visible:ring-2` revient dans 24 fichiers hors `ui/`, et `brand-` n'apparaît dans aucun `.tsx`.

## Constats

### 1. Design tokens (observé)

**Source unique.** Les variables `--fb-*` sont déclarées dans `src/styles/tokens.css` sous forme de canaux RGB. Elles sont branchées dans Tailwind avec `rgb(var(--fb-x) / <alpha-value>)` (`tailwind.config.js:20-46`).

**Thème sombre.** `darkMode: "class"` (`tailwind.config.js:3`), avec la classe `.dark` posée sur `<html>` avant le chargement de React. C'est le rôle de `public/theme-init.js:5-21` : clé `fb-theme`, valeurs `light`, `dark` ou `system`.

**Couleurs** (RGB clair → sombre, `tokens.css:21-45` et `:63-82`) :

| Token | Clair | Sombre |
|---|---|---|
| background | 255 255 255 | 11 18 32 |
| surface | 255 255 255 | 17 26 46 |
| surface-muted | 242 245 250 | 24 35 59 |
| foreground | 14 27 61 | 234 240 251 |
| foreground-muted | 85 97 125 | 163 174 198 |
| border | 225 230 239 | 36 48 74 |
| border-strong | 126 136 160 | 104 117 148 |
| accent | 20 99 243 (#1463F3) | 91 147 255 |
| accent-hover | 15 79 196 | 122 168 255 |
| accent-soft | 232 240 254 | 23 42 82 |
| accent-foreground | 255 255 255 | 7 16 38 |
| accent-strong | 15 79 196 | 141 180 255 |
| gold / gold-soft | 185 146 59 / 246 237 216 | 211 178 96 / 46 39 22 |
| success / warning / danger / info | 41 112 82 / 137 91 23 / 184 59 59 / 59 104 160 | 76 175 122 / 214 163 58 / 232 118 118 / 110 158 214 |

- **Palette `brand-50…900`** en hexadécimal (`tailwind.config.js:9-17`) : **elle n'est plus utilisée** dans aucun `.tsx` (vérifié par grep). C'est un résidu.
- **Couleurs en dur** : aucun hexadécimal n'apparaît dans les `.ts` et `.tsx`.

**Typographie.**
- **Police** : une seule, Figtree Variable, auto-hébergée, avec la pile système en repli (`tokens.css:15-18`, `src/main.tsx:8`, `tailwind.config.js:48-50`).
- **Titres** : h1 et h2 en `letter-spacing: -0.02em` (`src/styles/index.css:23-27`).
- **Échelle** : aucune échelle en tokens, ce sont les tailles par défaut de Tailwind.
  - Tailles les plus utilisées : text-sm ×166, text-xs ×52, text-lg ×33, text-3xl ×21, text-2xl ×20, text-xl ×12, text-base ×8, text-4xl et text-5xl ×1 chacune.
  - Graisses : bold ×51, semibold ×47, medium ×38, extrabold ×19.

**Espacements.** Aucun token, échelle Tailwind par défaut.
- Les pages sont en `p-4 sm:p-8`, par exemple `pages/client/HomePage.tsx:116`.
- Le header est en `px-4 py-3`, le footer en `px-4 py-6`.

**Rayons** (`tokens.css:49-52`, remappés dans `tailwind.config.js:53-58`).
- Tokens : md 0.375rem, lg 0.5rem, xl 0.75rem, 2xl 1rem.
- `rounded-full` ×31 : boutons, chips, badges.
- `rounded-3xl` ×4, hors tokens : `BarberPreviewCard.tsx:48`, `BarbersMapCard.tsx:58`, `BarbersSearchPage.tsx:448`, `HomePage.tsx:161`.

**Ombres.**
- Tokens : `--fb-shadow-sm` et `--fb-shadow-md` (`tokens.css:54-56`, sombre `:84-86`), exposés en `shadow-card-sm` et `shadow-card`.
- Hors tokens : trois ombres par défaut de Tailwind, dont `hover:shadow-md` (`components/search/BarberResultCard.tsx:39`).

**Animations.**
- Le body fait une transition de couleur de 150ms ease au changement de thème (`index.css:31-37`). Tout est coupé si `prefers-reduced-motion` (`index.css:42-51`).
- Composants : `transition-colors` ×16, `duration-300` ×2 (zoom photo, `BarberPreviewCard.tsx:56`), `animate-spin`, `animate-pulse`.
- **Aucun token de durée ni de courbe d'animation.**

### 2. Composants (observé)

**Button** (`components/ui/Button.tsx`, `buttonStyles.ts`).
- **Variantes** : primary, secondary, ghost, danger (`buttonStyles.ts:23-31`).
- **Tailles** : sm et md (`:16-21`).
- **Base** : `rounded-full font-semibold transition-colors` (`:10`). Hauteur minimale de 44 px (`min-h-11`) ; `sm` descend à 36 px à partir du breakpoint `sm:`.
- **États** :
  - hover : fond propre à chaque variante ;
  - focus-visible : anneau accent de 2 px avec un décalage de 2 px ;
  - disabled : `opacity-50` et `pointer-events-none` (`:13`) ;
  - loading : spinner, `disabled` et `aria-busy` (`Button.tsx:34-44`).
  - **Il n'existe pas d'état active ou pressed.**
- **Liens** : `buttonClasses()` sert aussi à styler des `<Link>`, dans 18 fichiers.

**Champs** (`components/ui/control.ts:5-12`).
- `CONTROL_CLASS` est partagé par Input, Select et Textarea : `rounded-xl`, bordure `border-strong`, `min-h-11`, texte en 16 px puis 14 px à partir de `sm`.
- États : survol (bordure), focus (anneau), disabled, erreur via `aria-invalid` (bordure danger de 2 px).
- `Field` (`components/ui/Field.tsx`) relie le libellé, l'aide et l'erreur (icône + texte).

**Chips** (`components/ui/chipStyles.ts`).
- `chipClasses(selected, {tone, square})` : pilule de 44 px.
  - Au repos : contour `border-strong`.
  - Sélectionnée, ton neutral : fond foreground. Ton accent : fond bleu.
  - Variante `square` 44×44, utilisée pour les notes.
- `segmentClasses` sert au sélecteur Liste/Carte (`:44-53`).
- Utilisées par : SearchFilters, CategoryChips, les créneaux de BookingForm (`:433-436`), ReviewForm (`:72`) et admin `FilterChips.tsx:26`.

**Card** (`components/ui/Card.tsx:11`) : `rounded-2xl border bg-surface shadow-card-sm`, sans padding par défaut.

| Carte | Fichier | Particularités |
|---|---|---|
| Résultat de recherche | `components/search/BarberResultCard.tsx` | Sélection par `ring-2 ring-accent`. Photo 64 px en `rounded-2xl`. Un bouton invisible couvre toute la carte (`:43-49`). CTA secondaire. |
| Accueil | `components/home/BarberPreviewCard.tsx:46-88` | La carte entière est un lien `rounded-3xl`. Photo en 4/3, zoom ×1.02 au survol. Badge Certifié en surimpression. |
| Fiche sur la carte | `components/BarbersMapCard.tsx:58-112` | Panneau `rounded-3xl`, poignée sur mobile, photo 96 px, deux CTA. |
| Navigation pro | `components/barber/ProNavCard.tsx:35` | Au survol, bordure `accent/60`. |

**Badge** (`components/ui/Badge.tsx:13-24`).
- 7 variantes : neutral, accent, gold, success, warning, danger, info. Pilule `text-xs` en semibold.
- `CertifiedBadge` : variante accent avec une icône coche (`barber/CertifiedBadge.tsx:9-25`).
- **Doublon** : une pastille est recodée à la main dans `BarberResultCard.tsx:71-78`.

**Notes et étoiles** (`components/search/BarberHighlights.tsx:21-32, 67-98`).
- `StarIcon` en SVG 16 px, `text-gold`, suivi de la note en semibold et du nombre d'avis en couleur atténuée.
- Sans avis, un texte de remplacement s'affiche.

**Navigation.**
- **Header** (`App.tsx:58-91`) :
  - fond surface, bordure basse, `max-w-5xl` ;
  - contenu : logo, langue (compact), cloche de notifications, liens en `ghost sm` ;
  - lien d'évitement (`:52-57`).
  - **Il n'existe ni menu déroulant, ni menu mobile dédié.**
- **Admin** (`components/AdminLayout.tsx:22-26, 70-77`) : NavLink en pilules ; l'élément actif est en `accent-soft`.
- **Espace pro** : pas de barre de navigation. On a une grille de `ProNavCard` (`pages/barber/DashboardPage.tsx:173`) et un lien retour dans `ProPageHeader` (`barber/ProPageHeader.tsx:25-45`).
- **Connexion / inscription** : `components/auth/AuthLayout.tsx:14-29`, sur deux colonnes à partir de `lg`.

**Modale** (`components/ui/ConfirmDialog.tsx:40-63`) : `<dialog>` natif ouvert avec `showModal()`. Focus initial sur Annuler. Tons primary et danger. `max-w-md rounded-2xl shadow-card`, fond `black/50`.

**Créneaux** (`components/BookingForm.tsx`).
- **Il n'y a pas de calendrier visuel** : un select natif et un champ date natif (`:52, 280-338`).
- Les créneaux sont des chips accent en `tabular-nums` (`:412-438`).
- Pendant le chargement : Skeleton `h-11 w-20` (`:386-391`).

**Carte géographique.**
- Moteur et style : MapLibre avec un style MapTiler clair ou sombre (`lib/mapConfig.ts:35-55`).
- Marqueurs SVG `.fb-map-marker` de 30×38 : ×1.08 au survol, ×1.3 avec un anneau or quand le marqueur est sélectionné (`index.css:54-124`).
- Plein écran : `h-[calc(100dvh-4.5rem)]`, avec un panneau de liste flottant `w-[27rem] rounded-3xl backdrop-blur` (`pages/client/BarbersSearchPage.tsx:439-448`).
- Boutons de repli codés à la main (`BarbersMap.tsx:441, 463, 470`).

**Footer** (`components/SiteFooter.tsx:61-95`) : `max-w-5xl`, liens atténués, icônes sociales SVG de 20 px. Chaque élément n'apparaît que s'il est configuré.

### 3. Logo actuel (observé)

- **`components/Logo.tsx:17-45`** : carré de 32 px à coins arrondis (`rx=8`) en couleur accent, avec un « F » géométrique. À côté, le mot « FindBarber » en `text-lg semibold tracking-tight` (option `showWordmark`).
- **`public/favicon.svg`** : même dessin, couleurs en dur `#1463F3` et `#FFFFFF`. Référencé dans `index.html:6`.
- **`public/email-logo.png`** (96×96) : utilisé dans `server/src/lib/emailTemplates.ts:80`.
- **Usages de `<Logo />`** : `App.tsx:65`, `components/auth/AuthLayout.tsx:17` et `components/auth/AuthBrandPanel.tsx:35`.

### 4. Mise en page (observé)

**Largeurs max.**
- `max-w-5xl` : header, footer, accueil, dashboard pro, profil public.
- `max-w-2xl` ×15 : compte, paramètres, pages pro.
- `max-w-3xl` ×4, `max-w-4xl` ×2.
- `max-w-md` : connexion/inscription, modale, fiche sur la carte.

**Breakpoints.**
- Seuls les breakpoints par défaut `sm:` (×97) et `lg:` (×39) sont utilisés.
- Aucun `md:`, `xl:` ni `2xl:`.
- Une seule media query en CSS : `max-width: 1023px` (`styles/index.css:173`).

**Grilles.**
- `sm:grid-cols-2` ×11, `sm:grid-cols-3` ×7, `lg:grid-cols-3` ×7.
- Carrousel horizontal `snap-x` sur l'accueil (`HomePage.tsx:197`).

### 5. Profondeur des modules (vocabulaire codebase-design)

- **Modules profonds** : `buttonStyles.ts`, `chipStyles.ts` et `control.ts`. Une petite interface est reprise par 18 à 39 fichiers, ce qui donne un bon levier et une bonne localité.
- **Seam profonde** : les tokens, de `tokens.css` vers Tailwind, pour les couleurs, les rayons et les ombres.
- **Ce qui reste superficiel** :
  - Il manque un module pour la typographie, l'espacement, le conteneur de page et l'anneau de focus.
  - `focus-visible:ring-2` est recopié dans 24 fichiers hors `ui/`.
  - `min-h-[44px]` apparaît 101 fois, souvent sur des `Button` qui font déjà `min-h-11`.
  - `p-4 sm:p-8 … mx-auto max-w-*` est recopié dans chaque page.

## Preuves

Chemins et numéros de ligne cités dans chaque constat. Les comptages ont été obtenus avec `grep -rhoE … --include=*.tsx client/src | sort | uniq -c`, en lecture seule.

## Limites

- Inventaire statique : aucune mesure de pixels calculés, aucune capture de FindBarber.
- Les comptages par regex peuvent inclure des occurrences dans des commentaires.
- Non inspectés en détail : NotificationBell, LocationPicker, les pages admin et les pages pro.
- Le rendu des styles MapTiler (tuiles distantes) n'a pas été vérifié.

## Questions ouvertes

1. Le commentaire de `tokens.css:50` annonce « rounded-lg pour boutons, champs », alors que les boutons sont en `rounded-full` et les champs en `rounded-xl`. Le commentaire est obsolète, et la refonte doit trancher.
2. `rounded-3xl` et `shadow-md`, hors tokens : à intégrer aux tokens dans la refonte (cartes « vitrine »).
3. La palette `brand-*` n'est plus utilisée (vérifié par le coordinateur) : on peut la supprimer lors de la refonte.

**Skills** : sous-agent A, codebase-design lu, appliqué **partiellement**. Le vocabulaire (module, interface, profondeur, seam, levier, localité) a été appliqué. DEEPENING.md et DESIGN-IT-TWICE.md ne l'ont pas été : il n'y a pas de refonte d'interface dans cette phase.
