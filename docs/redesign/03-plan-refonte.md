# 03 — Plan de refonte FindBarber

- **Auteur** : coordinateur (Tech Lead).
- **Entrées** : `01-etat-actuel-front.md`, `01-etat-actuel-metier.md`, `02a-reference-design.md`, `02b-reference-fonctionnalites.md`.
- **Skills appliqués** :
  - frontend-design : plan de tokens en deux passes avec revue anti-générique ;
  - ui-ux-pro-max : grille d'audit, plus une recherche `--design-system` sans persistance, consultée puis non retenue (voir §2.0) ;
  - backend-architect et api-security-hardening : évaluation des nouvelles fonctionnalités.
- **Statut** : proposition. **Aucun code n'est modifié.** L'implémentation attend ta validation.

## Sommaire

1. Tableau d'écart
2. Nouveau design system FindBarber (« Dégradé »)
3. Nouvelles fonctionnalités, rédigées comme des lots
4. Découpage en lots et ordre recommandé

---

## 1. Tableau d'écart

Chaque proposition des sections 2 à 4 renvoie à un identifiant `Exx` de ce tableau.

**Effort** : S ≤ 1 jour, M = 2 à 4 jours, L = 5 jours ou plus.
**Impact** : ★ faible, ★★ moyen, ★★★ fort, du point de vue des clients et des barbers.

### Visuel et composants

| ID | Élément | Référence (02a) | FindBarber actuel (01-front) | Proposition | Effort | Impact |
|---|---|---|---|---|---|---|
| E01 | Identité couleur | Violet #BC31FC sur nuit #1B0733 ; ombres teintées violet | Bleu #1463F3 sur blanc ; or discret ; palette `brand-*` morte | Palette « nuit d'encre + cobalt + laiton » (§2.1), avec des sections nuit et jour qui alternent | M | ★★★ |
| E02 | Typographie | Archivo large 900 en majuscules (titres) + uberMove ; échelle fluide en `clamp()` | Figtree seule, échelle Tailwind par défaut, sans token | Titres en Bricolage Grotesque (nouvelle dépendance, à valider), texte courant en Figtree (conservée), échelle fluide en tokens (§2.2) | M | ★★★ |
| E03 | Rythme et mise en page | Sections de 96 à 128 px, hero arrondi de 48 px, largeur max 1280 px, alternance de panneaux sombres | `p-4 sm:p-8` copié dans chaque page, `max-w-5xl`, aucun `md:` | Tokens d'espacement de section, composant `PageContainer`, breakpoints sm / md / lg / xl (§2.3) | M | ★★ |
| E04 | Boutons | 29 variantes, pilules, survol `scale` et `translate`, active 0,97, **focus du navigateur** | 4 variantes, pilules, **pas d'état active**, bon anneau de focus | 11 variantes, chacune avec ses 7 états (§2.6.1). On garde notre focus, meilleur que celui de la référence | M | ★★★ |
| E05 | Champs et recherche | Capsule de 62 px, rayon 31, double ombre, **sans label** | `CONTROL_CLASS` à 44 px, labels liés | Capsule de recherche **avec label visible ou `aria-label`**, autocomplétion de ville (E21) (§2.6.2) | M | ★★★ |
| E06 | Chips et filtres | Pilules à bordure, chip active pleine | `chipClasses`, sans retour à l'appui | On garde le module et on ajoute les états active et désactivé, un compteur, et une feuille de filtres sur mobile (§2.6.3) | S | ★★ |
| E07 | Cartes barber | Bento à rayon 32, image plein cadre, barre « verre », puce « Réserver » qui se déploie, `card-lift` | Carte de résultat à photo 64 px ; carte d'accueil en 4/3 | Trois gabarits : « vitrine », « résultat » et « compacte », avec le **prochain créneau libre** (E19) (§2.6.4) | M | ★★★ |
| E08 | Badges et notes | Pastilles de verre, point pulsé, 5 étoiles | 7 variantes de Badge, étoile or, doublon recodé à la main | Badge avec 3 tailles et une variante « live » (point pulsé si `prefers-reduced-motion: no-preference`) ; suppression du doublon (§2.6.5) | S | ★★ |
| E09 | Navigation desktop | Pilule « liquid glass » flottante, menus déroulants | Header plat, sans menu déroulant | Barre flottante en verre, uniquement sur le hero de nuit (fond opaque au défilement), avec un menu « Pour les pros » (§2.6.6) | M | ★★ |
| E10 | Navigation mobile | Burger plein écran (marketing) ; **barre d'onglets en bas** (web app) | Aucune navigation mobile dédiée, pas de nav dans l'espace pro | Barre d'onglets en bas pour client et barber (≤ 5 entrées) ; burger pour le site public (§2.6.6) | M | ★★★ |
| E11 | Modales et feuilles | Feuilles mobiles qui montent, `panelIn` | `ConfirmDialog` natif | Composant `Sheet` (feuille du bas sur mobile, panneau latéral sur desktop) en plus de `Dialog` (§2.6.7) | M | ★★ |
| E12 | Calendrier et créneaux | Grille de 7 jours avec flèches, créneaux en grille, récapitulatif latéral, progression en 2 segments | Select natif et champ date natif, puis chips du jour | Réservation en étapes, grille de la semaine, récapitulatif collant (§2.6.8, lot N2) | L | ★★★ |
| E13 | Carte géographique | Épingles de prix (pilules), popup riche, survol 1,1 | Marqueurs SVG 30×38, panneau flottant | Épingles de prix au format pilule, **focalisables**, et cluster (§2.6.9) | M | ★★ |
| E14 | Micro-interactions | Splash « tondeuse », apparition floutée, carte pro inclinable, scrollytelling, **sans reduced-motion** | Quasi aucune animation (transition de couleurs, zoom de photo) | Un seul moment signature, la « mise en paliers » du motif sur le hero (distincte du splash de la référence, voir §2.5) ; levée des cartes au survol ; retours sur les actions. **Tout est désactivé si reduced-motion** (§2.5) | M | ★★★ |
| E15 | Footer | Dégradé profond, maillage des villes, réseaux sociaux | Footer simple et configurable | Footer « nuit » sur 4 colonnes, avec les pages ville si E24 est retenu (§2.6.10) | S | ★ |
| E16 | États vide, erreur et chargement | Squelette infini sans paramètres, erreur « Réessayer », 404 incohérente | Skeleton, `Alert`, `EmptyState` existants, 404 = redirection | Gabarits d'état unifiés, avec illustration du motif « dégradé » et une action claire (§2.7) ; vraie page 404 (E25) | S | ★★ |
| E17 | Thème sombre | Non proposé côté marketing | Thème clair / sombre / système complet | On garde. Chaque nouveau token a ses deux valeurs, avec un contraste AA vérifié (§2.1) | S | ★★ |
| E18 | Accessibilité | Focus du navigateur, placeholder seul, cibles de 28 à 32 px, pas de reduced-motion | Bon niveau : 44 px, `Field`, focus, tests axe | **On garde notre niveau** et on ne reprend aucun défaut de la référence (§2.8) | — | ★★★ |

### Fonctionnalités

| ID | Élément | Référence (02b) | FindBarber actuel (01-métier) | Proposition | Effort | Impact |
|---|---|---|---|---|---|---|
| E19 | Disponibilité dans les résultats | Bandeau sur 7 jours, « Dispo maintenant », « Ouvert aujourd'hui » | Aucune donnée de créneau dans la recherche | « Prochain créneau libre » et badge « Libre aujourd'hui » (lot N1) | M | ★★★ |
| E20 | Horaires publics et itinéraire | Horaires de la semaine sur la fiche, lien itinéraire | Horaires non publics, adresse privée | Horaires publics. Lien itinéraire **seulement après confirmation** (lot N3) | S | ★★ |
| E21 | Autocomplétion de ville côté client | Suggestions de géocodage | Réservée au barber | Suggestions de villes dans la recherche publique (lot N4) | M | ★★ |
| E22 | Favoris | Bouton cœur et liste « Favoris » | Absent | Lot N5 | M | ★★ |
| E23 | Réservation sans compte | Formulaire invité et compte créé automatiquement | Compte vérifié obligatoire | **Variante compatible** : création de compte intégrée au tunnel et confirmation par lien (lot N6) | L | ★★★ |
| E24 | Pages SEO par ville | 150 pages ville et un annuaire | Application monopage, sans sitemap | Prérendu statique des pages ville (lot N9, à arbitrer) | L | ★★ |
| E25 | Page 404 | Vraie 404 avec code HTTP 404 | Redirection silencieuse | Vraie page 404 (lot N7) | S | ★ |
| E26 | FAQ | Accordéons client et pro | Absente | Composant FAQ et contenu (lot N7) | S | ★★ |
| E27 | Absence du client (no-show) | Annoncée (Free et Pro) | Statut NO_SHOW sans transition | Transition CONFIRMED → NO_SHOW (lot N8) | S | ★★ |
| E28 | Frais de déplacement à domicile | Annoncés (« calculés ») | Absents | Forfait de déplacement fixé par le barber (lot N10) | M | ★★ |
| E29 | Plusieurs prestations par réservation | Bouton « + Ajouter une coupe » | Une seule prestation | Reporté (lot N11, schéma lourd) | L | ★★ |
| E30 | Formulaire de contact | Formulaire, WhatsApp, réseaux sociaux | Email configurable seulement | Reporté (anti-spam et file d'envoi) | M | ★ |
| E31 | Connexion Google / Apple | Boutons | Email et mot de passe | Reporté (nouvelle dépendance, authentification) | L | ★★ |
| E32 | Messagerie, codes promo, fidélité | Messagerie et promos annoncées, fidélité payante | Absents | **Non adopté** dans cette refonte (§3.3) | L | ★ |
| E33 | Badge « Certifié » payant, commission par nouveau client | Monétisation de la référence | Badge attribué par l'admin | **Non adopté** : contraire à nos règles (§3.3) | — | — |

---

## 2. Nouveau design system FindBarber — « Dégradé »

### 2.0 Démarche et revue anti-générique

Méthode frontend-design en deux passes : je propose un plan de tokens, je le confronte au brief, et je corrige tout ce qui ressemble à un réglage par défaut.

**Sujet.** Réserver un barber (salon, chez le pro ou à domicile), en Suisse romande en premier lieu (CHF, Genève dans la démo), sur mobile avant tout.

**Image propre au métier.** Le **dégradé** à la tondeuse, le *skin fade* : on passe du plein au vide en paliers réguliers. C'est l'élément mémorable de la marque, et on ne l'utilise **qu'à un seul endroit décoratif à la fois** (règle détaillée au §2.4) :
- le fond du hero ;
- les transitions de section ;
- le logo (voir 04).

**Ce qu'on prend à la référence** : le niveau de finition.
- Une hiérarchie typographique très forte.
- L'alternance de sections nuit et jour.
- Des rayons hiérarchisés.
- Des survols « physiques » (levée, pression).
- Un moment d'animation signature.
- Des cartes riches en informations utiles.
- Une réservation en étapes.

**Ce qu'on ne reprend pas** :
- **Rien de leur identité** : ni le violet, ni uberMove, ni Archivo, ni le logo, ni les textes, ni les images.
- **Ni leur moment de marque.** La référence ouvre sur un splash « coup de tondeuse » : le logo se dévoile derrière un trait-lame qui balaie l'écran, suivi d'un rideau (02a §5, point 1). Nous n'en reprenons ni l'outil (la tondeuse), ni le geste (un trait qui balaie), ni le dévoilement du logo, ni l'écran d'attente, ni sa courbe `(.65,0,.35,1)`. Notre image est le *résultat* de la coupe, le dégradé en paliers, sous forme de motif statique ; sa seule animation (§2.5) est verticale et ne touche pas au logo. La métaphore du barbier reste un terrain commun du métier, mais ce point de proximité est signalé au propriétaire (§4, décision 6).
- **Leurs défauts d'accessibilité** : focus du navigateur, placeholder seul, cibles de 28 px, aucune règle reduced-motion.
- **Leurs tics génériques** : eyebrows en majuscules au-dessus de chaque titre, verre partout, titres entièrement en majuscules, ombres colorées sous chaque élément.

**Corrections faites lors de la revue du premier plan** :
1. **Couleurs.** J'avais d'abord envisagé « fond quasi noir + un seul accent vif ». C'est un réglage générique, et c'est aussi la recette de la référence. J'ai corrigé en :
   - une nuit d'*encre bleue* (#0A1024) plutôt que du noir ;
   - **deux** couleurs de marque aux rôles distincts : le cobalt pour l'action, le laiton pour la confiance (notes, badge certifié).
2. **Titres.** Les titres larges en majuscules étaient trop proches de la référence. J'ai corrigé en titres en casse de phrase, dans une grotesque expressive qu'on reconnaît à ses formes, pas à ses majuscules.
3. **Eyebrows.** J'avais un eyebrow au-dessus de chaque titre. Je l'ai supprimé : le contexte est porté par le fil d'Ariane ou par le titre lui-même.

**Recherche ui-ux-pro-max** (`search.py "barber booking marketplace mobile" --design-system`, sans `--persist`).
- **Rejeté**, parce que hors sujet : la palette bleu/orange et le couple Inter + Playfair qu'elle propose.
- **Retenu** :
  - la checklist (focus visible, reduced-motion, contraste 4,5:1, SVG plutôt qu'emoji, tests à 375 / 768 / 1024 / 1440) ;
  - la règle tactile « 44 pt sur iOS / 48 dp sur Android, 24 px minimum en web », issue de la recherche `--domain ux`.

### 2.1 Couleurs (tokens sémantiques, clair et sombre)

**Principe.** On conserve le système actuel : variables `--fb-*` en canaux RGB, branchées dans Tailwind (`01-front` §1). On ne fait que **remplacer les valeurs et ajouter des tokens**. Aucun composant n'utilise d'hexadécimal en dur.

**Contraste.** Tous les ratios ont été calculés selon la formule WCAG 2.1. Le texte doit atteindre au moins 4,5:1, les éléments d'interface au moins 3:1.

| Token | Rôle | Clair | Sombre | Contraste vérifié |
|---|---|---|---|---|
| `background` | Fond de page | #F6F7FB | #070B17 | — |
| `surface` | Cartes, champs | #FFFFFF | #0E1528 | — |
| `surface-muted` | Zones secondaires, survol neutre | #EEF1F7 | #16203A | — |
| `foreground` | Texte principal | #0C1428 | #EDF1FA | 18,3 sur surface / 17,4 sur fond sombre |
| `foreground-muted` | Texte secondaire | #4A5672 | #A3AEC8 | 7,3 / 8,2 |
| `border` | Séparateurs | #DCE1EB | #24304D | décoratif |
| `border-strong` | Contour d'un contrôle | #7A859E | #5D6B8C | 3,7 / 3,4 (≥ 3) |
| `accent` | Action principale (cobalt) | #2350F5 | #7C9BFF | texte blanc sur accent : 5,9 ; texte sombre sur accent (mode sombre) : 7,5 |
| `accent-hover` | Survol de l'action | #1A3CC4 | #A3B8FF | blanc : 8,4 |
| `accent-strong` | Lien, texte accentué | #1A3CC4 | #8FA8FF | 7,2 sur accent-soft / 8,0 sur surface sombre |
| `accent-soft` | Fond teinté, élément actif | #E8EDFF | #18244A | — |
| `accent-foreground` | Texte sur accent | #FFFFFF | #050A1A | voir accent |
| `brass` | Confiance : étoiles, badge certifié (UI) | #B07A22 | #E2B66A | 3,7 (UI) / 9,6 |
| `brass-strong` | Texte en laiton | #8A5A12 | #E2B66A | 5,9 / 9,6 |
| `brass-soft` | Fond du badge certifié | #F7EEDC | #2E2614 | — |
| `night` | Sections nuit (identique dans les deux thèmes) | #0A1024 | #0A1024 | blanc sur night : 18,9 |
| `night-2` | Dégradé et cartes de nuit | #121A33 | #121A33 | — |
| `night-muted` | Texte secondaire sur fond de nuit | #A7B1CC | #A7B1CC | 8,8 |
| `success` | Succès | #1E7148 | #55C793 | 6,0 / 8,6 |
| `warning` | Avertissement | #8A5A00 | #EDB653 | 5,9 / 9,9 |
| `danger` | Erreur, destructif | #B8322A | #FF8077 | 6,0 / 7,4 |
| `info` | Information | = `accent-strong` | = `accent-strong` | — |
| `ring` | Anneau de focus | #2350F5 | #8FA8FF | 5,6 sur fond / 8,6 |
| `ring-on-night` | Focus sur une section de nuit | #8FA8FF | #8FA8FF | 8,3 |

**À supprimer** : la palette `brand-*` (aucun usage, voir `01-front`, question 3).

**Ombres** (tokens) : teintées encre et jamais de couleur vive, une seule ombre par élément.

| Token | Valeur | Usage |
|---|---|---|
| `shadow-1` | `0 1px 2px rgb(12 20 40 / .06), 0 1px 1px rgb(12 20 40 / .04)` | Repos |
| `shadow-2` | `0 8px 24px -12px rgb(12 20 40 / .22)` | Carte levée au survol, menu |
| `shadow-3` | `0 24px 60px -24px rgb(12 20 40 / .45)` | Feuille, modale, capsule de recherche |
| `shadow-cta` | `0 10px 24px -12px rgb(35 80 245 / .55)` | Uniquement le CTA principal du hero |

En mode sombre, l'élévation vient d'abord de la surface (`surface` → `surface-muted`). Les ombres sont seulement renforcées : opacité multipliée par 2.

### 2.2 Typographie

| Rôle | Famille | Graisses | Source |
|---|---|---|---|
| Titres et affichage | **Bricolage Grotesque** (variable, axes `wght` et `opsz`) | 600, 700, 800 | **Nouvelle dépendance à valider** : paquet Fontsource auto-hébergé, sur le modèle de Figtree (la CSP impose `font-src 'self'`) |
| Texte courant, interface | **Figtree** (déjà installée) | 400, 500, 600, 700 | `@fontsource-variable/figtree` |
| Chiffres (prix, heures) | Figtree avec `font-variant-numeric: tabular-nums` | 600 | — |

**Règles d'usage :**
- Titres en **casse de phrase**, jamais tout en majuscules. Interlettrage −0,025em pour les tailles d'affichage, −0,01em pour h3 et h4.
- **Pas d'eyebrow décoratif.** Une petite étiquette n'est admise que si elle donne une information (statut, étape « 2 sur 3 »). Dans ce cas, elle est en casse normale.
- Longueur de ligne ≤ 70 caractères pour le texte courant (`max-w-[65ch]`).

**Échelle fluide** (tokens `--fb-text-*`, de 360 px à 1440 px de largeur d'écran) :

| Token | Taille | Interligne | Famille / graisse | Usage |
|---|---|---|---|---|
| `display` | `clamp(2.25rem, 1.2rem + 4.6vw, 4.5rem)`, soit 36 à 72 px | 1,02 | Bricolage 800 | H1 du hero |
| `h1` | `clamp(1.875rem, 1.3rem + 2.4vw, 3rem)`, soit 30 à 48 px | 1,08 | Bricolage 800 | H1 de page |
| `h2` | `clamp(1.5rem, 1.15rem + 1.5vw, 2.25rem)`, soit 24 à 36 px | 1,12 | Bricolage 700 | Titre de section |
| `h3` | 1,25rem (20 px) | 1,25 | Bricolage 700 | Titre de carte |
| `h4` | 1,0625rem (17 px) | 1,3 | Figtree 700 | Sous-titre |
| `body-lg` | 1,125rem (18 px) | 1,6 | Figtree 400 | Introduction |
| `body` | 1rem (16 px) | 1,55 | Figtree 400 | Texte |
| `body-sm` | 0,875rem (14 px) | 1,5 | Figtree 500 | Métadonnées, aide |
| `caption` | 0,8125rem (13 px) | 1,4 | Figtree 600 | Badges, légendes |
| `button` | 0,9375rem (15 px) ; `sm` 14 px ; `lg` 16 px | 1 | Figtree 600 | Boutons |

Le texte courant ne descend jamais sous 13 px. Sur mobile, les champs restent en 16 px pour éviter le zoom automatique d'iOS.

### 2.3 Espacement, grille et rayons

**Espacements.** La base reste à 4 px. Les tokens de **section** sont nouveaux :

| Token | Valeur | Usage |
|---|---|---|
| `space-section` | `clamp(4rem, 2.5rem + 6vw, 8rem)`, soit 64 à 128 px | Espace vertical entre sections |
| `space-block` | 3rem (48 px) | Entre le titre et le contenu d'une section |
| `space-stack` | 1,5rem (24 px) | Entre éléments d'un même bloc |
| `gutter` | 16 px (mobile), 24 px (sm), 32 px (lg) | Marges latérales |

**Grille.** 4 colonnes sur mobile, 8 sur md, 12 sur lg. Gouttières de 16 / 24 / 24 px.

**Largeurs maximales** :

| Contenu | Largeur |
|---|---|
| Page | 1280 px (`max-w-7xl`) |
| Contenu de lecture | 720 px |
| Formulaires | 560 px |
| Tunnel de réservation | 1040 px (contenu + récapitulatif de 320 px) |

**Breakpoints** : sm 640, **md 768** (nouveau dans l'usage), lg 1024, **xl 1280**. Le composant `PageContainer` remplace les classes `p-4 sm:p-8 mx-auto max-w-*` aujourd'hui recopiées dans chaque page (`01-front` §5).

**Rayons.** La hiérarchie est fixée par rôle : plus un élément est grand et « vitrine », plus il est arrondi. Les boutons restent des pilules.

| Token | Valeur | Rôle |
|---|---|---|
| `radius-xs` | 6 px | Créneau, petit tag |
| `radius-sm` | 10 px | Champ, chip carrée, vignette |
| `radius-md` | 14 px | Carte compacte, menu, popup |
| `radius-lg` | 20 px | Carte de résultat, feuille, modale |
| `radius-xl` | 28 px | Carte vitrine, capsule de recherche, panneau de carte |
| `radius-2xl` | 40 px | Bas du hero de nuit, grands panneaux |
| `radius-pill` | 9999 px | Boutons, chips, badges |

**Conséquence.** Le commentaire obsolète de `tokens.css:50` disparaît (`01-front`, question 1), et `rounded-3xl`, utilisé hors tokens, devient `radius-xl`.

### 2.4 Bordures, verre et motif « dégradé »

**Bordures.** 1 px en `border`. Un contrôle au repos a une bordure `border-strong` (3:1). Un champ en erreur passe à 2 px en `danger`.

**Verre.** On n'en met qu'à **deux endroits** :
1. la barre de navigation au-dessus du hero de nuit ;
2. le panneau de liste posé sur la carte.

Recette : fond `night` à .72 (ou `surface` à .78 en mode jour), `backdrop-filter: blur(16px) saturate(150%)`, bordure blanche à .12, `shadow-3`. Si `backdrop-filter` n'est pas supporté, on revient à un fond opaque.

**Motif « dégradé »** (élément signature) :
- **Forme.** Une série de lignes horizontales de 2 px dont l'écart augmente : 2, 3, 5, 8, 12 et 18 px. On passe ainsi du plein au vide, comme un dégradé à la tondeuse.
- **Couleurs.** `night-2` sur `night`, ou `accent` à 18 % sur `accent-soft`.
- **Fabrication.** SVG en ligne ou `repeating-linear-gradient` calculé. **Aucune image** à charger.
- **Usages :**
  - le bas du hero, comme transition vers la section jour ;
  - le fond des états vides ;
  - le logo (voir 04).
- **Limite.** Une seule occurrence **décorative** par écran (bas du hero **ou** logo agrandi). Les usages **fonctionnels** de petite taille (illustration d'un état vide, repli d'une photo absente, §2.6.4) restent permis : ils signalent une absence de contenu et ne décorent pas.

### 2.5 Mouvement

| Token | Durée | Courbe | Usage |
|---|---|---|---|
| `motion-instant` | 90 ms | `cubic-bezier(.3,0,.5,1)` | Pression (`active`) |
| `motion-fast` | 160 ms | `cubic-bezier(.22,1,.36,1)` | Survol, focus, changement de couleur |
| `motion-base` | 240 ms | `cubic-bezier(.22,1,.36,1)` | Levée de carte, ouverture de menu, accordéon |
| `motion-slow` | 420 ms | `cubic-bezier(.22,1,.36,1)` | Montée d'une feuille, changement d'étape |
| `motion-exit` | 180 ms | `cubic-bezier(.4,0,1,1)` | Sorties (plus rapides que les entrées) |
| `motion-signature` | 900 ms | `cubic-bezier(.22,1,.36,1)` | Mise en paliers du motif du hero, **une seule fois par session** |

La courbe `(.22,1,.36,1)` est une courbe d'*ease-out* très répandue. Elle n'appartient pas à l'identité de la référence. On l'adopte parce que c'est elle qui donne la sensation « physique » mesurée en 02a.

**Le moment signature : la « mise en paliers ».** Au premier affichage de l'accueil :
1. les lignes du motif « dégradé » partent serrées en un bloc plein, puis leurs écarts s'ouvrent jusqu'aux valeurs finales (2, 3, 5, 8, 12, 18 px), par un `translateY` propre à chaque ligne, avec un décalage de 40 ms entre les lignes, sur 900 ms au total. Aucun trait ne balaie l'écran horizontalement et le logo n'est pas animé (différence voulue avec le splash de la référence, §2) ;
2. le titre du hero apparaît en `opacity` de 0 à 1 avec un `translateY` de 12 px à 0, en 420 ms, à partir de 300 ms.

Contraintes :
- **Pas d'écran d'attente** : le contenu reste lisible et cliquable pendant l'animation.
- L'animation est jouée **une seule fois par session** (mémorisé en `sessionStorage`).

**Réponses aux actions** (bienvenues, parce qu'elles montrent ce qui a changé) :
- **Levée de carte** : `translateY(-4px)` et `shadow-2`, en `motion-base`.
- **Pression** : `scale(.97)`.
- **Créneau choisi** : remplissage en `motion-fast`, puis apparition du récapitulatif.
- **Succès** : coche tracée en 240 ms.
- **Changement d'étape** : glissement horizontal de 24 px avec fondu, en `motion-slow`.

**Hors sujet, donc interdits :**
- les apparitions au défilement sur chaque section ;
- la parallaxe à la souris ;
- les boucles infinies, sauf le point « live » du badge E08 ;
- l'inclinaison 3D.

**Reduced motion** (obligatoire, et absent chez la référence). Si `prefers-reduced-motion: reduce` :
- toutes les transformations sont supprimées ;
- les transitions sont limitées à `opacity` et `color` en 120 ms ;
- la mise en paliers s'affiche directement dans son état final ;
- le point « live » ne pulse plus.

La règle globale actuelle de `index.css:42-51` est conservée et étendue.

### 2.6 Composants

Les états communs sont définis une seule fois. Chaque composant se contente de les préciser.

| État | Règle commune |
|---|---|
| **Survol** | Uniquement si `@media (hover: hover)`, pour éviter qu'un survol reste collé sur mobile. Transition en `motion-fast`. |
| **Focus** | `:focus-visible` uniquement. Anneau de 2 px en `ring`, décalé de 2 px sur `background` (`ring-on-night` sur les sections nuit). **Jamais supprimé.** Un module `focusRing` partagé remplace les 24 copies actuelles (`01-front` §5). |
| **Actif (pression)** | `scale(.97)` en `motion-instant`. |
| **Désactivé** | Attribut `disabled` natif, fond `surface-muted`, texte `foreground-muted` à 70 % (le WCAG n'impose pas de contraste pour un élément inactif), `cursor: not-allowed`, plus aucune ombre ni transformation. Si la raison n'est pas évidente, une aide liée par `aria-describedby` l'explique, par exemple « Choisissez un créneau ». |
| **Chargement** | `aria-busy="true"`. Le libellé reste visible, un spinner de 16 px remplace l'icône de tête, la largeur est verrouillée (pas de saut de mise en page) et les clics sont bloqués. Le chargement n'est annoncé qu'après 300 ms, pour éviter le clignotement. |
| **Erreur** | Message sous le champ ou près de l'action (déjà fait dans #57), avec une icône en plus de la couleur. |
| **Succès** | Retour en place : coche, libellé « Enregistré » pendant 2 s, puis retour à l'état normal. Annoncé par `role="status"`. |

#### 2.6.1 Boutons (prioritaires) — module `buttonStyles` étendu

**Tailles :**

| Taille | Hauteur | Padding horizontal | Texte | Icône | Usage |
|---|---|---|---|---|---|
| `sm` | 44 px sur mobile, 36 px à partir de sm (souris) | 14 px | 14 px / 600 | 16 px | Barres d'outils, tableaux |
| `md` (défaut) | 44 px | 20 px | 15 px / 600 | 18 px | Formulaires, cartes |
| `lg` | 52 px | 24 px | 16 px / 600 | 20 px | CTA de page, feuilles |
| `xl` | 60 px | 28 px | 16 px / 700 | 20 px | CTA du hero, CTA flottant mobile |

Forme : `radius-pill` pour toutes les variantes, sauf `icon` (cercle) et `link`. Écart icône–texte : 8 px (10 px en `lg`/`xl`).

**Variantes et états.** Les règles communes de focus, désactivé et chargement s'appliquent partout ; le tableau ne précise que les différences.

| Variante | Usage | Repos | Survol | Focus | Actif | Désactivé | Chargement |
|---|---|---|---|---|---|---|---|
| `primary` | Action principale (une par zone) | Fond `accent`, texte `accent-foreground` | Fond `accent-hover`, `translateY(-1px)`, `shadow-1` | Commun | `scale(.97)`, translateY(0) | Commun | Spinner `accent-foreground` |
| `secondary` | Action secondaire | Fond `surface`, bordure 1 px `border-strong`, texte `foreground` | Fond `surface-muted`, bordure `foreground-muted` | Commun | `scale(.97)` | Commun, sans bordure | Spinner `foreground` |
| `ghost` | Action tertiaire, navigation | Transparent, texte `foreground` | Fond `surface-muted` | Commun | Fond `border` | Texte `foreground-muted` à 60 % | Spinner |
| `link` | Lien dans un texte ou une carte | Texte `accent-strong`, soulignement 1 px décalé de 3 px, épaissi à 2 px au survol | Texte `accent-hover` | Anneau à 2 px de rayon | Opacité .8 | Texte muted, sans soulignement | — |
| `danger` | Action destructive | Bordure 1 px `danger`, texte `danger`, fond transparent | Fond `danger` à 10 % | Commun (anneau `danger`) | `scale(.97)` | Commun | Spinner `danger` |
| `danger-solid` | Confirmation dans une modale | Fond `danger`, texte blanc (6,0:1) | Fond `danger` assombri de 8 % | Commun | `scale(.97)` | Commun | Spinner blanc |
| `inverse` | CTA sur une section de nuit | Fond blanc, texte `night` | Fond `accent`, texte blanc, `translateY(-1px)` | `ring-on-night` | `scale(.97)` | Fond blanc à 30 %, texte blanc à 60 % | Spinner `night` |
| `outline-inverse` | Action secondaire sur la nuit | Bordure 1 px blanc à 40 %, texte blanc | Fond blanc, texte `night` | `ring-on-night` | `scale(.97)` | Bordure blanc à 20 %, texte blanc à 50 % | Spinner blanc |
| `icon` | Action réduite à une icône (favori, fermer, zoom) | Cercle de 44 px, `ghost` ou `secondary` | Comme la variante parente | Commun | `scale(.94)` | Commun | Spinner à la place de l'icône |
| `segmented` | Bascule « Salon / Chez le pro / Domicile », « Liste / Carte » | Rail : fond `surface-muted`, padding 4, `radius-pill`. Segment : 40 px de haut, texte `foreground-muted` 600. Segment actif : fond `surface`, `shadow-1`, texte `foreground` | Segment inactif : texte `foreground` | Commun, sur le segment | — | Segment désactivé : muted à 50 % | — |
| `fab-mobile` | CTA collant en bas d'écran sur mobile (« Réserver ») | `xl`, fond `accent`, largeur `calc(100% - 32px)` (max 560 px), à 16 px du bas plus `safe-area-inset-bottom`, `shadow-3` | Comme `primary` | Commun | `scale(.98)` | Commun, avec l'aide visible au-dessus | Commun |

**Variante `segmented` : accessibilité.**
- Rôles ARIA : `role="radiogroup"` et `role="radio"` avec `aria-checked`. Ce n'est pas le cas chez la référence.
- Clavier : les flèches ← et → déplacent la sélection.
- Animation : l'indicateur glisse en `motion-base` (une simple transition de `transform`, aucune bibliothèque d'animation).

**Variante `fab-mobile`.** Elle masque tout autre CTA en double dans la page.

**CTA de recherche du hero.** C'est le bouton `primary` en taille `xl`, avec `shadow-cta` et une flèche. Au survol, la flèche avance de 3 px, rien de plus. (Une première version faisait traverser le motif sur le bouton : retirée à la relecture, car proche du « reflet qui balaie » du CTA de la référence, 02a §5 point 8, et contraire à la limite d'une occurrence décorative du motif par écran.) La flèche reste immobile si reduced-motion.

**Règles d'usage :**
- **Hiérarchie** : un seul `primary` par zone visuelle.
- **Libellés** : un libellé dit l'action. On écrit « Réserver ce créneau », jamais « Valider ».
- **Pas de « → » ajouté au texte** : la flèche est une icône SVG avec `aria-hidden`.
- **Cible tactile** : 44 × 44 px au minimum, et 8 px entre deux cibles.

**Écart avec l'existant.** On ajoute les variantes `link`, `danger-solid`, `inverse`, `outline-inverse`, `icon`, `segmented` et `fab-mobile`, les tailles `lg` et `xl`, l'état actif, l'annonce de chargement retardée et l'état succès. Les variantes `primary`, `secondary`, `ghost` et `danger` restent compatibles : **l'interface de `buttonClasses()` ne change pas** (module profond, `01-front` §5).

**Pas de doublon pour `segmented`.** Un sélecteur segmenté existe déjà : `segmentClasses(selected)` (`components/ui/chipStyles.ts:44`, documenté dans `ui/README.md`). La variante `segmented` décrite ici est une **évolution de ce module** (nouveau rail, hauteur 40 px, `radiogroup`), pas une seconde implémentation dans `buttonStyles`.

**Renommages de tokens à prévoir (lot DS-1).** Ils touchent l'existant et doivent être faits en une fois, avec un alias temporaire :

| Aujourd'hui | Proposé | Fichiers concernés (à mettre à jour ensemble) |
|---|---|---|
| `gold`, `gold-soft` (`tokens.css:37-38`, `:75-76`) | `brass`, `brass-soft` | `tokens.css`, `tailwind.config.js:37`, variante `gold` de `Badge`, `ui/README.md`, `tests/src/contrast.test.ts` |
| `rounded-3xl` (hors tokens, 4 usages, `01-front`) | `radius-xl` | les 4 fichiers cités dans `01-front` |
| Rayons actuels de `tailwind.config.js` | `radius-xs` à `radius-2xl` et `radius-pill` (§2.3) | `tailwind.config.js` et usages |

Si le propriétaire préfère éviter ces renommages, garder `gold` comme nom de token avec les nouvelles valeurs est une option sans perte.

#### 2.6.2 Champs et capsule de recherche

**Champ** (`CONTROL_CLASS`) :
- 48 px de haut (44 px en `sm`), `radius-sm`, bordure `border-strong`, fond `surface`, padding horizontal 14 px.
- **Survol** : bordure `foreground-muted`.
- **Focus** : bordure `accent` et anneau commun.
- **Erreur** : bordure 2 px `danger` et message.
- **Désactivé** : fond `surface-muted`.
- **Lecture seule** : sans bordure, fond `surface-muted`.
- **Label toujours visible** (ce que la référence ne fait pas). Placeholder seulement pour donner un exemple de format.

**Capsule de recherche du hero.**
- **Forme.** 64 px de haut, `radius-xl`, fond `surface`, `shadow-3` et liseré `border`.
- **Contenu, de gauche à droite.** Icône de lieu, champ « Ville ou adresse » (avec `aria-label` et un label visible pour les lecteurs d'écran), sélecteur `segmented` du lieu, puis le CTA `xl`.
- **Mobile.** Les éléments s'empilent : champ, sélecteur, puis CTA pleine largeur.
- **Focus.** Toute la capsule reçoit l'anneau (`:focus-within`) et `shadow-3` se renforce.
- **Autocomplétion (lot N4).** Liste en `radius-md`, chaque option fait 48 px. Clavier : ↑, ↓ et Entrée. Rôles `combobox` / `listbox`. Un état « aucune ville trouvée » est prévu.

#### 2.6.3 Chips et filtres (module `chipClasses` étendu)

- **Forme.** 40 px de haut sur desktop, 44 px sur mobile, `radius-pill`, padding de 14 px.
- **États :**
  - repos : bordure `border-strong` ;
  - survol : fond `surface-muted` ;
  - sélectionnée : fond `foreground`, texte `background`, ou en ton accent : fond `accent`, texte `accent-foreground` ;
  - actif : `scale(.97)` ;
  - désactivé : 50 % ;
  - focus : commun.
- **Compteur.** Une chip peut porter un compteur, par exemple « Note 4+ (12) ».
- **Feuille de filtres sur mobile (Sheet).** Elle regroupe le lieu, le prix, la note, la distance et la disponibilité (lot N1). En bas, un bouton « Afficher 24 barbers » : un `primary` qui affiche le nombre de résultats en direct, et « Réinitialiser » en `link`.

#### 2.6.4 Cartes barber

**Commun à tous les gabarits :**
- La carte entière est cliquable grâce à un lien étendu, mais les boutons internes restent focalisables séparément.
- Survol (`hover: hover`) : levée de −4 px et `shadow-2` en `motion-base` ; l'image zoome à `scale(1.04)` en 600 ms.
- Focus : anneau sur toute la carte.

**Les trois gabarits :**

| Gabarit | Usage | Spécifications |
|---|---|---|
| **Vitrine** | Accueil (grille de type bento) | `radius-xl`, image plein cadre en 4/5, voile en dégradé `night` vers le bas. Tout en haut, la note et le badge « Libre aujourd'hui » (lot N1) ; en bas, le nom en Bricolage 700 20 px, le quartier et « dès 35 CHF ». Le bouton `icon` « Réserver » s'élargit pour révéler son libellé au survol de la carte, comme le fait la référence, mais il reste **toujours visible** sur mobile et au clavier. |
| **Résultat** | Liste de recherche et liste sur la carte | `radius-lg`, photo carrée de 80 px (`radius-md`), nom en `h3`, note, distance et lieux. Ligne **« Prochain créneau : aujourd'hui 14:30 »** en `accent-strong` (lot N1), deux prestations avec leur prix, un bouton `icon` favori (lot N5) et un CTA `secondary sm`. Sélection : anneau `accent` de 2 px. |
| **Compacte** | Popup de carte, favoris, « déjà visité » | `radius-md`, photo de 56 px, une ligne d'information et un CTA `link`. |

Si l'image ne charge pas, on affiche les initiales sur le motif « dégradé ». L'image est `lazy` et ses dimensions sont réservées, pour éviter un saut de mise en page (CLS).

#### 2.6.5 Badges et notes

**Badge :**
- 3 tailles : 22, 26 et 30 px. Texte `caption`, `radius-pill`.
- Variantes : `neutral`, `accent`, `brass`, `success`, `warning`, `danger`, `info` et **`live`** : point vert de 6 px qui pulse en 2 s, seulement si `prefers-reduced-motion: no-preference`.
- Le badge « Certifié » est en `brass-soft` / `brass-strong`, avec une coche.
- On supprime la pastille recodée à la main dans `BarberResultCard.tsx:71-78`.

**Note :**
- Étoile SVG de 16 px en `brass`, la note en 600, puis « (128) » en `foreground-muted`.
- Sur la fiche : un bloc de 56 × 56 px (`radius-md`) avec la note en Bricolage 800 24 px, et la répartition des notes de 5 à 1 en barres.
- Sans avis : « Nouveau sur FindBarber ». **On n'affiche jamais « 0,0 »**, l'incohérence relevée chez la référence (02b §2).

#### 2.6.6 Navigation

**Desktop (site public) :**
- **Sur le hero de nuit** : barre flottante en verre, centrée, 64 px de haut, à 16 px du haut, `radius-pill`.
- **Au défilement** (au-delà de 80 px) : la barre devient opaque (`surface`, ou `night` sur les sections nuit) et reçoit `shadow-2`.
- **Contenu** : logo, Rechercher, menu « Pour les pros » (tuile illustrée et 3 liens), langue, Connexion, puis le CTA « Réserver » en `primary sm`.
- **Menu** : ouvert au clic et au clavier, survol facultatif. `radius-lg`, `shadow-3`. Échap le ferme et le focus revient au bouton qui l'a ouvert.

**Desktop (espaces connectés)** :
- **Barre latérale** de 248 px, pour le client comme pour le barber :
  - élément actif : fond `accent-soft`, texte `accent-strong` et une barre de 3 px à gauche ;
  - survol : `surface-muted`.
- Elle remplace la grille de `ProNavCard` (`01-front` §2).

**Mobile :**
- **Site public** : logo, langue et burger.
  - Le burger ouvre un menu plein écran en `night`.
  - Liens en Bricolage 700 28 px. Le focus reste piégé dans le menu ; Échap le ferme.
- **Espaces connectés** : **barre d'onglets en bas**.
  - Hauteur : 64 px plus la zone de sécurité de l'écran.
  - Client (4 onglets) : Accueil, Rechercher, Rendez-vous, Compte.
  - Barber (5 onglets) : Aujourd'hui, Réservations, Agenda, Vitrine, Compte.
  - Onglet actif : icône pleine et libellé `accent-strong` en 600. Inactif : icône au trait, `foreground-muted`.
  - Chaque cible fait au moins 48 × 48 px. L'onglet actif porte `aria-current="page"`.

#### 2.6.7 Dialogues et feuilles

**`Dialog`** (confirmations) :
- On garde l'élément `<dialog>` natif.
- `radius-lg`, `shadow-3`, largeur max 440 px.
- Fond : `night` à 55 % avec un flou de 4 px.
- Entrée : `scale(.96)` vers 1 et fondu, en `motion-base`. Sortie : `motion-exit`.

**`Sheet`** (nouveau) :
- Sur mobile, une feuille qui monte du bas :
  - `radius-xl` en haut et poignée de 36 × 4 px ;
  - entrée en `translateY(100%)` vers 0, en `motion-slow` ;
  - on peut la fermer en la glissant vers le bas ou avec Échap.
- Sur desktop, un panneau latéral de 440 px.
- Usages : filtres, choix de la ville, détail d'une réservation.

#### 2.6.8 Calendrier et créneaux (tunnel de réservation, lot N2)

**Étapes**, affichées dans une barre de progression en 3 segments de 4 px de haut, avec la mention « Étape 2 sur 3 » pour les lecteurs d'écran :
1. Prestation
2. Créneau
3. Confirmation

**Grille de la semaine :**
- 7 colonnes, avec pour chaque jour le jour abrégé et la date. Sur mobile, défilement horizontal avec *snap*, un jour par colonne de 72 px.
- Flèches de semaine : boutons `icon`. Désactivées si on est déjà sur la semaine en cours ou si la semaine dépasse l'horizon de 60 jours (règle existante).
- **Jour sans créneau** : grisé et barré d'un trait fin, avec `aria-disabled`.
- **Aujourd'hui** : point `accent` sous la date.

**Créneau :**
- 44 px de haut, `radius-xs`, fond `surface-muted`, heure en `tabular-nums` 600.
- **Survol** : bordure `accent`.
- **Sélectionné** : fond `accent`, texte `accent-foreground`, coche, `aria-pressed="true"`.
- **Indisponible** : non affiché, pour ne pas surcharger la grille.
- **Créneau pris entre-temps** (409 `SLOT_UNAVAILABLE`) : message sous la grille, puis rechargement de la semaine.

**Récapitulatif :**
- Desktop : colonne collante de 320 px, `radius-lg`.
- Mobile : barre en bas, qui se replie et se déplie.
- Contenu : barber, prestation, date et heure dans le fuseau du salon (règle existante), lieu, prix, mode de paiement (acompte ou total, #10) et total en Bricolage 700.

**États :** chargement de la semaine en squelette 7 × 4 ; semaine vide (« Aucun créneau cette semaine », avec « Semaine suivante » en `primary`) ; erreur avec « Réessayer ».

#### 2.6.9 Carte géographique

**Épingle de prix :**
- Pilule de 28 px de haut, fond `surface`, texte `foreground` en 600 13 px, bordure `border`, `shadow-1`.
- **Sélectionnée** : fond `accent`, texte blanc, `scale(1.08)`.
- **Survol** : `scale(1.06)` en `motion-fast`.
- **Focalisable au clavier**, ce que la référence ne fait pas : `button` avec un `aria-label` du type « Nom, dès 35 CHF ».

**Regroupement.** Au-delà de 30 épingles visibles, on les regroupe : un cercle `night` avec le nombre de barbers.

**Panneau de liste :** verre (voir §2.4), `radius-xl`, 400 px sur desktop. Sur mobile, une feuille du bas à trois positions : 25 %, 55 % et 90 %.

**Contrôles** : boutons `icon` en `secondary`, et un bouton « Ma position ».

#### 2.6.10 Footer

- Section `night`.
- Lignes du motif « dégradé » au raccord avec la section précédente.
- 4 colonnes (2 sur mobile) : Rechercher, Pour les pros, Aide, Légal. Titres de colonne en `h4`, en casse normale.
- Liens en `night-muted`, qui passent en blanc au survol, avec focus `ring-on-night`.
- Langue, réseaux sociaux (si configurés) et ©.

### 2.7 États de page (vide, erreur, succès, chargement)

| État | Gabarit |
|---|---|
| **Chargement** | Squelettes qui reprennent la forme exacte du contenu, en `surface-muted`, avec une animation `pulse` (supprimée si reduced-motion). Aucun squelette ne doit tourner sans fin : au bout de 10 s, on bascule sur l'état erreur (défaut observé chez la référence, 02b §0). |
| **Vide** | Illustration du motif « dégradé » (120 px), titre `h3`, une phrase d'explication, une action `primary`. Exemples : « Aucun barber dans cette zone » avec « Élargir à 25 km » ; « Pas encore de favoris » avec « Explorer les barbers ». |
| **Erreur** | Icône, titre factuel (« Impossible de charger les créneaux »), cause connue si possible, « Réessayer » en `secondary`. Pas d'excuses ni de formule vague (règle de rédaction frontend-design). |
| **Succès** | Après une réservation : écran de confirmation avec une coche tracée en 240 ms, le récapitulatif, « Ajouter au calendrier » (fichier .ics, lot N2) et « Voir mes rendez-vous ». |
| **Désactivé** | Voir les états communs (§2.6) : la raison est toujours accessible. |

### 2.8 Accessibilité (niveau minimum, au-dessus de la référence)

- **Contrastes AA** vérifiés pour chaque paire de couleurs du §2.1, en clair comme en sombre.
- **Focus visible partout**, grâce au module `focusRing` partagé. Le focus revient au déclencheur à la fermeture d'un dialogue, d'une feuille ou d'un menu.
- **Cibles tactiles** de 44 × 44 px au minimum (48 dans la barre d'onglets), espacées de 8 px.
- **Labels visibles** sur tous les champs. Les erreurs sont reliées au champ par `aria-describedby`, en continuité de #57.
- **Rôles ARIA corrects** : `radiogroup` pour le sélecteur segmenté, `combobox` pour l'autocomplétion, `aria-current` pour la navigation, `aria-pressed` pour les créneaux.
- **Reduced motion** : appliqué partout, voir le §2.5.
- **Tests automatiques** : les tests axe existants (`e2e/a11y.spec.ts`) sont étendus à toutes les nouvelles pages, en clair et en sombre.

---

## 3. Nouvelles fonctionnalités

On ne retient ici que ce qui manque chez nous, ou ce qui y est moins bien, **et** qui est utile aux clients ou aux barbers. Chaque lot est évalué selon la méthode backend-architect : besoin, limites du domaine, contrat d'API, risques et déploiement. La sécurité est vérifiée avec la checklist api-security-hardening : authentification, validation, limitation de débit (rate limiting), journal d'audit, pas de requête GET qui modifie l'état.

**Contrainte commune à tous les lots.** Aucune route, aucun schéma, aucune règle de sécurité n'est décidé ici. Ce sont des **propositions à valider**. Toute migration sera faite dans une mission à part.

### 3.1 Lots proposés

#### N1 — Disponibilité dans la recherche (E19) · priorité P1

- **Valeur**
  - Client : voir tout de suite qui est libre, et quand. C'est l'information n°1 sur les cartes de la référence.
  - Barber : ses créneaux libres deviennent un argument de visibilité.
- **Fonctionnement proposé**
  - Pour chaque barber de la **page de résultats affichée** (12 par défaut, jusqu'à 50 : `SEARCH_LIMITS.pageSizeMax`, `shared/src/constants.ts:306` ; le mode rayon demande 50, `BarbersSearchPage.tsx:51`) : `nextAvailableAt` (premier créneau des 7 prochains jours, toutes prestations actives confondues) et `availableToday` (booléen).
  - Le calcul réutilise la fonction pure `shared/src/booking.ts:73-137`.
- **Impact**
  - Schéma : aucun.
  - API : 2 champs facultatifs dans `GET /api/barbers`. Rétrocompatible.
  - Authentification et rôles : aucun changement.
  - Réservation et créneaux : lecture seule.
  - Dépendances : aucune.
- **Risques**
  - Coût : jusqu'à 50 calculs de créneaux par recherche (mode rayon). C'est le principal risque d'abus de cette route publique.
  - Mitigation : un horizon de 7 jours et un cache serveur de 60 s par barber, invalidé à chaque réservation, modification d'horaires ou ajout d'absence.
- **Filtre « Disponible le… »** : seconde étape, avec un paramètre `availableOn` (date). Il exige le même calcul sur l'ensemble des résultats : à mesurer avant de s'engager.
- **Effort** : M.
- **Lot** : sensible (Tech Lead), car il touche aux performances de la recherche et au moteur de créneaux.

#### N2 — Tunnel de réservation en étapes, avec grille de la semaine (E12) · P1

- **Valeur**
  - Client : moins d'erreurs, une vision de la semaine entière, un récapitulatif et le prix toujours visibles.
  - Barber : moins de demandes abandonnées.
- **Fonctionnement proposé**
  - Composant `BookingFlow` en 3 étapes (§2.6.8).
  - Nouvelle lecture des créneaux sur une plage de dates : `GET /api/barbers/:id/slots?from=AAAA-MM-JJ&days=7`. Elle étend la route existante, sans route nouvelle.
  - Export `.ics` de la réservation, généré côté client.
- **Impact**
  - Schéma : aucun.
  - API : paramètres `from` et `days` (7 au maximum), validés par Zod.
  - Authentification : aucun changement.
  - Réservation : inchangée. Le serveur reste la source de vérité, avec le créneau recalculé sous verrou (`booking/service.ts:409-500`).
- **Effort** : L, pour le front.
- **Découpage** : l'extension de l'API est un lot simple et délégable, avec ses tests. Le tunnel est sensible (paiement #10, à domicile).

#### N3 — Horaires publics et lien itinéraire (E20) · P1

- **Valeur** (client) : savoir quand le salon est ouvert, et s'y rendre.
- **Fonctionnement proposé**
  - `PublicBarberProfile.weeklyHours` : les plages par jour, sans le motif des absences (privé).
  - Mise en avant du jour en cours, et « Fermé » pour les jours sans plage.
  - Le lien itinéraire **n'apparaît qu'après confirmation**, dans le détail de la réservation (`GET /api/bookings/:id`).
  - **Correction (implémentation).** Contrairement à ce qu'indiquait ce plan, l'adresse exacte du barber n'était communiquée à aucun client : le détail ne contenait que l'adresse du client. Le propriétaire a décidé (17/10/2026) de la révéler via `BookingDetails.barberAddress`, au **seul client propriétaire**, pour une réservation **CONFIRMED** au salon ou chez le professionnel ; `null` dans tous les autres cas (barber, admin, autre statut, à domicile). Elle n'apparaît ni dans les listes ni sur la fiche publique (tests `booking-directions.integration.test.ts`).
- **Compatibilité métier**
  - Sur la fiche publique, l'adresse exacte reste **privée** (règle `01-métier` §4, coordonnées arrondies). On n'y met donc pas d'itinéraire précis.
  - La référence montre l'adresse complète publiquement : **ce n'est pas adopté**.
- **Impact** : un champ en lecture seule ajouté à la réponse publique. Aucun changement de schéma.
- **Effort** : S.
- **Lot** : simple, délégable.

#### N4 — Autocomplétion de ville dans la recherche publique (E21) · P2

- **Valeur** (client) : saisie plus rapide et moins de recherches vides.
- **Fonctionnement proposé**
  - Nouvelle route publique `GET /api/places/suggest?q=`.
  - Elle réutilise le géocodage serveur MapTiler existant (`server/src/lib/geocoding.ts:41`). La clé reste côté serveur (`MAPTILER_GEOCODING_API_KEY`, `server/src/config/env.ts:162-165`) ; elle est distincte de la clé publique des tuiles (`client/src/lib/mapConfig.ts:3-8`).
  - Elle ne renvoie que des villes et des quartiers, jamais des adresses de barbers.
- **Sécurité**
  - Limitation de débit dédiée, plus stricte que celle du barber (route publique donc exposée aux abus).
  - Validation de `q` : 2 à 80 caractères.
  - Cache de 24 h par requête.
  - Aucune journalisation de la requête associée à une IP au-delà des journaux standard.
- **Impact** : nouvelle route et coût de géocodage. Aucun changement de schéma.
- **Effort** : M.
- **Lot** : sensible (route publique, coût externe).

#### N5 — Favoris (E22) · P2

- **Valeur** (client) : retrouver son barber et réserver de nouveau en 2 clics.
- **Fonctionnement proposé**
  - **Schéma** : table `favorites(user_id, barber_profile_id, created_at)` avec une clé primaire composée. Une migration.
  - **Routes** :
    - `GET /api/users/me/favorites` ;
    - `PUT /api/users/me/favorites/:barberId` (idempotent) ;
    - `DELETE /api/users/me/favorites/:barberId`.
  - **Accès** : CLIENT uniquement, avec CSRF.
- **Règles métier**
  - Un barber non approuvé, suspendu ou supprimé n'apparaît pas dans la liste.
  - La suppression du compte efface aussi les favoris.
  - L'export RGPD les inclut.
- **Effort** : M.
- **Lot** : simple côté API et front, mais la migration et l'intégration RGPD sont sensibles.

#### N6 — Réservation sans compte préalable (E23) · P2 · compatibilité à arbitrer

- **Valeur** (client) : beaucoup moins de friction, c'est la fonctionnalité la plus différenciante de la référence (02b F13).
- **Conflit avec nos règles**
  - Aujourd'hui, une réservation exige un compte CLIENT avec un email vérifié (`booking/routes.ts:24-28`, `auth/service.ts:143-146`).
  - La version de la référence (compte créé automatiquement, sans vérification) n'est **pas adoptée telle quelle**. Elle ouvrirait la porte aux fausses réservations qui bloquent des créneaux, aux emails usurpés et aux conflits avec un compte BARBER existant (scénario 02b §3).
- **Variante compatible proposée : « réservation express »**
  1. À l'étape 3 du tunnel, un visiteur non connecté saisit nom, email et mot de passe, puis voit le récapitulatif.
  2. Le compte est créé, **non vérifié**, et la réservation est enregistrée dans un nouveau statut **`AWAITING_EMAIL`**. Ce statut bloque le créneau pendant 30 minutes au plus, sur le modèle du paiement (35 minutes, `01-métier`).
  3. Le client clique sur le lien de l'email. L'email est alors vérifié et la réservation passe à `PENDING`, ou à l'étape de paiement si le paiement en ligne est actif.
  4. Sans clic dans les 30 minutes, la réservation passe à `EXPIRED` et le créneau est libéré.
  5. Si l'email correspond déjà à un compte, on demande de se connecter. **Aucune fusion silencieuse.**
- **Impact**
  - Schéma : un statut en plus dans l'énumération, une migration.
  - Machine à états : nouvelles transitions.
  - Expiration : nouveau cas à gérer.
  - Authentification : inscription et réservation dans une même transaction.
  - Limitation de débit : renforcée (inscription + réservation), avec un piège à robots (*honeypot*).
  - Emails : un email combiné de vérification et de récapitulatif.
- **Effort** : L.
- **Lot** : **sensible (Tech Lead)**.
- **Décision demandée** : on adopte cette variante, ou on garde la règle actuelle ?

#### N7 — Vraie page 404 et FAQ (E25, E26) · P2

- **Valeur** : orientation et réassurance pour les deux publics, et réponses aux questions fréquentes.
- **Fonctionnement proposé**
  - **Page 404** : la route `*` affiche une page « Page introuvable » (état vide du §2.7), avec « Rechercher un barber » et « Accueil ».
    - Côté hébergement : nginx doit répondre avec le code HTTP 404 pour les chemins inconnus, quand c'est faisable, ce qui suppose une liste des routes connues. Sinon, on ajoute `<meta name="robots" content="noindex">`.
    - On n'adopte pas la route attrape-tout `/<slug>` de la référence (02a, question 2) : elle confond une page inconnue et un pro inconnu.
  - **FAQ** : composant accordéon accessible (`button` avec `aria-expanded`), contenu traduit dans l'espace `common` ou dans un nouvel espace `faq`.
- **Impact** : front et configuration nginx. Aucune API.
- **Effort** : S.
- **Lot** : simple, délégable. Les textes de la FAQ sont à valider par le propriétaire.

#### N8 — Absence du client (no-show) (E27) · P2

- **Valeur** (barber) : tracer les absences, et préparer une éventuelle retenue sur l'acompte.
- **Fonctionnement proposé**
  - **Transition** : `CONFIRMED → NO_SHOW`, faite par le BARBER, possible seulement **après le début** du rendez-vous et dans les 48 h qui suivent.
  - **Effets** :
    - audit `BOOKING_NO_SHOW` ;
    - le client est notifié ;
    - aucun avis possible.
  - **Remboursement de l'acompte** : la règle actuelle rembourse tout (`01-métier`, question 8). **La retenue n'est pas décidée ici.**
- **Impact**
  - Machine à états et route `POST /api/bookings/:id/no-show`.
  - Statistiques : le taux d'absence est ajouté.
  - Schéma : aucun changement, le statut existe déjà.
- **Effort** : S.
- **Lot** : sensible (machine à états et paiement).

#### N9 — Pages ville (SEO) (E24) · P3 · à arbitrer

- **Valeur** : acquisition. La référence s'appuie sur 150 pages ville.
- **Ce que ça demande** : un rendu côté serveur ou un prérendu au build. **L'application est aujourd'hui monopage, sans aucun rendu serveur.**
- **Proposition minimale**
  - Un script de prérendu génère au build `/barbers/ville/<slug>` pour les villes qui ont au moins 3 barbers approuvés.
  - Un `sitemap.xml` est produit en même temps.
  - Le contenu repose sur les données publiques uniquement.
- **Impact** : outil de build, configuration nginx, éventuelle nouvelle dépendance de prérendu.
- **Effort** : L.
- **Lot** : sensible (architecture).
- **Statut** : **à confirmer**. Est-ce un objectif pour la v2 ?

#### N10 — Forfait de déplacement à domicile (E28) · P3

- **Valeur**
  - Barber : rentabiliser ses déplacements.
  - Client : connaître le prix total avant de réserver.
- **Fonctionnement proposé**
  - Champ `travelFeeMinor` sur `barber_profiles` : un forfait unique, facultatif.
  - Le montant est figé sur la réservation, au même titre que le prix, et ajouté au total et à l'éventuel acompte.
  - Un calcul « par zone » à la manière de la référence est écarté pour l'instant : trop complexe, et sa logique n'a pas été observée.
- **Impact** : schéma et migration, calcul du montant à payer (`booking.ts:255-267`), paiement, emails et statistiques.
- **Effort** : M.
- **Lot** : sensible (paiement).

#### N11 — Plusieurs prestations par réservation (E29) · reporté

- **Valeur** (client) : « coupe et barbe » en une seule réservation.
- **Impact** : lourd. Il faut une table `booking_items` à la place de `bookings.serviceId`, et revoir la durée cumulée dans le calcul des créneaux, les copies figées, les statistiques et le paiement.
- **Effort** : L.
- **Contournement en attendant** : le barber crée une prestation combinée « Coupe + barbe », ce qui est déjà possible.
- **Statut** : **reporté**, à reconsidérer après N2.

### 3.2 Reporté hors refonte

| Fonctionnalité | Écart | Raison du report |
|---|---|---|
| Formulaire de contact | E30 | Il demande un anti-spam et une file d'envoi. L'email du support (#58) suffit pour l'instant. |
| Connexion Google / Apple | E31 | Nouvelle dépendance OAuth et impact fort sur l'authentification, la fusion de comptes et le RGPD. À traiter dans une mission dédiée, à rapprocher de #11 (API mobile). |
| Applications natives iOS / Android | — | Prévues avec #11, hors du périmètre de cette refonte. |

### 3.3 Non adopté (contraire à nos règles ou hors besoin)

| Proposition de la référence | Raison |
|---|---|
| Badge « Certifié » vendu en option | **Contraire à notre règle.** Chez nous, la certification est attribuée par l'admin (`01-métier` §4) : la vendre ferait perdre au badge sa valeur de confiance. |
| Commission par « nouveau client » et formules d'abonnement pro | C'est un modèle économique, pas une fonctionnalité. Le critère « nouveau client » n'est même pas défini chez la référence (02b §3). Décision qui revient au propriétaire, hors de cette refonte. |
| Adresse exacte du pro visible publiquement | **Contraire à notre règle de confidentialité** : adresse privée, coordonnées arrondies. Remplacé par l'itinéraire après confirmation (N3). |
| Route attrape-tout `/<slug>` | Elle confond une page 404 et un pro introuvable. Remplacée par N7. |
| Messagerie, codes promo, fidélité | Annoncés mais **non observés** chez la référence (02b §2), coûteux (temps réel, modération, règles de prix) et **sans ancrage dans notre domaine actuel**. À reconsidérer seulement sur une demande réelle de nos barbers. |
| Compte invité créé automatiquement, sans vérification | **Contraire à notre règle** de l'email vérifié. Remplacé par la variante N6. |

---

## 4. Découpage en lots et ordre recommandé

**Légende :**
- **TL** : lot sensible, réalisé par le Tech Lead.
- **DL** : lot simple, délégable à DeepSeek ou OpenCode, avec le brief et les tests fournis par le Tech Lead.

**Règle de validation des lots délégués.** Chaque lot DL est relu par le Tech Lead (skill code-review) et doit passer la CI (tests, axe, typecheck) avant d'être fusionné.

| Ordre | Lot | Contenu | Type | Écarts | Effort | Dépend de |
|---|---|---|---|---|---|---|
| 1 | **DS-1 Tokens** | Couleurs clair et sombre, rayons, ombres, typo et échelle fluide, mouvement, police Bricolage (dépendance à valider), suppression de `brand-*` | **TL** (fondation, choix de la dépendance) | E01, E02, E17 | M | Validation des couleurs et de la police |
| 2 | **DS-2 Primitives** | `buttonStyles` (11 variantes, 7 états), `focusRing`, `PageContainer`, `Field` et `CONTROL_CLASS`, `chipClasses`, `Badge` | **TL** pour l'API des modules, **DL** pour leurs tests et leur documentation dans `ui/README.md` | E03, E04, E06, E08, E18 | M | DS-1 |
| 3 | **DS-3 Composants** | `Sheet`, `Dialog` révisé, cartes vitrine, résultat et compacte, note, gabarits d'état, accordéon | **DL** (sur les specs du §2.6, avec revue TL) | E07, E11, E16 | M | DS-2 |
| 4 | **DS-4 Navigation** | Barre publique flottante, barres latérales client et barber, barre d'onglets mobile, menu burger | **TL** (impact sur le routage et tous les écrans) | E09, E10 | M | DS-2 |
| 5 | **P-1 Accueil** | Hero de nuit, moment « mise en paliers », capsule de recherche, grille bento, sections, footer | **TL** pour le moment signature et la capsule, **DL** pour les sections | E05, E14, E15 | M | DS-3, DS-4 |
| 6 | **N3 Horaires publics** | API en lecture seule et bloc d'horaires sur la fiche | **DL** | E20 | S | DS-3 |
| 7 | **N7 404 et FAQ** | Page 404, accordéon, contenus | **DL** (textes validés par le propriétaire) | E25, E26 | S | DS-3 |
| 8 | **N1 Disponibilité** | `nextAvailableAt` et `availableToday`, cache, badge « Libre aujourd'hui » | **TL** | E19 | M | DS-3 |
| 9 | **P-2 Recherche et carte** | Cartes de résultat, épingles de prix, regroupement, panneau et feuille mobile | **TL** pour la carte, **DL** pour les cartes | E07, E13 | M | N1, DS-3 |
| 10 | **N2 Tunnel de réservation** | Extension `slots?from&days` (**DL**), `BookingFlow` et `.ics` (**TL**) | mixte | E12 | L | DS-3, N1 |
| 11 | **N8 Absence du client** | Transition, route, statistiques | **TL** | E27 | S | — |
| 12 | **N5 Favoris** | Migration et routes (**TL**), interface (**DL**) | mixte | E22 | M | DS-3 |
| 13 | **N4 Autocomplétion de ville** | Route publique avec limitation de débit et cache | **TL** | E21 | M | DS-2 |
| 14 | **P-3 Espaces client et barber** | Application du design system aux pages pro et client restantes | **DL**, page par page | E03 | L | DS-4 |
| 15 | **N6 Réservation express** | Si validée : statut `AWAITING_EMAIL`, transaction, emails | **TL** | E23 | L | N2, décision du propriétaire |
| 16 | **N10 Forfait de déplacement** | Schéma, calcul, paiement | **TL** | E28 | M | Validation de #10 avec Stripe en mode test |
| 17 | **N9 Pages ville** | Prérendu et sitemap | **TL** | E24 | L | Décision du propriétaire |
| — | N11, E30, E31 | Reportés | — | E29–E31 | — | — |

**Pourquoi cet ordre :**
1. Les **tokens et les primitives d'abord** : tous les autres lots en dépendent, et ils améliorent l'existant sans changement fonctionnel.
2. La **vitrine** (accueil et navigation) ensuite, parce que c'est là que l'effet de la refonte se voit le plus.
3. Puis les **fonctionnalités à forte valeur et à faible risque** : N3, N7, N1.
4. Puis le **tunnel de réservation**.
5. Enfin les **lots sensibles qui exigent une décision** : N6, N9, et N10 après le test Stripe de #10.

**Décisions attendues du propriétaire avant l'implémentation :**
1. Valider la palette « nuit d'encre, cobalt, laiton » et la police Bricolage Grotesque, qui est une nouvelle dépendance.
2. Variante N6 « réservation express » : on l'adopte, ou on garde la règle actuelle ?
3. Pages ville (N9) : sont-elles un objectif de la v2 ?
4. FAQ : qui rédige les questions et les réponses ?
5. Absence du client (N8) : faut-il retenir l'acompte ? Si oui, il faut une règle de remboursement explicite (voir `01-métier`, question 8).
6. Proximité avec la référence : la métaphore du barbier (dégradé) est partagée avec le splash « coup de tondeuse » de la référence. Le plan s'en distingue (§2), mais c'est au propriétaire de juger si la distance est suffisante.
7. **Valeurs chiffrées proposées, à valider une par une** (aucune n'est décidée) : fenêtre de 48 h pour marquer une absence (N8) ; blocage de 30 min du statut `AWAITING_EMAIL` (N6) ; cache de 60 s de la disponibilité (N1) ; cache de 24 h, longueur de `q` de 2 à 80 caractères et seuil de limitation de débit de la route d'autocomplétion (N4, seuil non chiffré à ce stade).
8. **Critère d'adoption des fonctionnalités seulement *annoncées*** par la référence. N8 et N10 ne sont qu'annoncées (02b), comme la messagerie, les promos et la fidélité. Elles sont retenues ici parce qu'elles complètent un élément **déjà présent** dans notre domaine (le statut `NO_SHOW` existe sans transition ; le domicile existe sans frais) pour un coût S/M, alors que les autres créeraient un sous-domaine nouveau. Le propriétaire peut préférer la règle stricte « observé seulement » : N8 et N10 sortiraient alors du backlog.

---

## 5. Validation du propriétaire (16/10/2026)

Le propriétaire a **validé le plan** (« Je valide »). Ce qui est acquis :
- **Le plan dans son ensemble** : tableau des écarts, design system « Dégradé », lots N1 à N10, ordre des lots et répartition TL / DL.
- **Les recommandations du coordinateur**, adoptées par défaut :
  - la palette nuit, cobalt et laiton ;
  - la police Bricolage Grotesque, nouvelle dépendance acceptée pour le lot DS-1 ;
  - le logo **concept 1 « Nuque »** comme piste principale (voir 04 §4) ; les finitions listées en 04 §4 restent à faire avant de remplacer le logo actuel ;
  - le critère d'adoption de N8 et N10 (§4, décision 8) ;
  - la « mise en paliers » comme moment signature (§4, décision 6).
- **Les valeurs chiffrées** de la décision 7, comme **valeurs de départ** : elles seront ajustées au moment de l'implémentation du lot concerné.

Ce qui reste ouvert, faute de recommandation tranchée. Chacun de ces points ne bloque que son propre lot :
- **N6**, la réservation express ;
- **N9**, les pages ville ;
- **l'auteur de la FAQ** (N7) ;
- **la retenue de l'acompte** en cas d'absence (N8).

Décision ajoutée le 17/10/2026 : **adresse exacte du barber révélée au client après confirmation** (lot N3, voir la correction dans N3).

L'implémentation commence au lot 1 (**DS-1 Tokens**), dans une mission séparée.
