# 02a — Reverse engineering visuel de la référence (fady-app.com)

**Auteurs.** Sous-agent C1 (skills frontend-design et ui-ux-pro-max). Relu et contrôlé par le coordinateur.

**Méthode.**
- Chromium piloté par Playwright, en 1440×900 et en 390×844.
- Valeurs lues avec `getComputedStyle`. États de survol et de focus forcés (hover, Tab).
- États `:active` et `:disabled` lus dans les CSS téléchargées.
- Aucune recherche faite avec `search.py`.

**Preuves.** Elles sont rangées dans `/tmp/claude-0/-home-user-FindBarberNearYou/aa8f60d5-9b33-5a35-b062-5fcb4207902e/scratchpad/c1/`, hors du dépôt :
- `shots/` : 250 captures ;
- `dl/` : CSS, HTML et journaux de mesure ;
- `scripts/`.

« CSS main » désigne `dl/main.pretty.css` : le fichier `c10df3c7b77dd950.css` du site, reformaté à une règle par ligne (1673 lignes).

**Contrôle du coordinateur.** Six points vérifiés dans `main.pretty.css` :
- `#BC31FC` est présent ;
- `.glass-panel` (l.1195) et `.title-wide` (l.1197) sont conformes ;
- `cubic-bezier(.22,1,.36,1)` apparaît 3 fois ;
- **aucune occurrence de `prefers-reduced-motion`** dans les 5 CSS ;
- la capture `01-home-desktop-sec-MEILLEURS_BARBERS.png` correspond bien à la section bento décrite.

**Règle de reprise.** Ce document *mesure* le style de la référence. Il ne fournit ni code, ni texte, ni image, ni logo à reprendre.

## Constats

### 0. Pages couvertes

16 URL visitées, soit **une de plus que la limite de 15** : `/dashboard/accueil` a été atteinte par un clic sur « Accueil » dans la web app. Cet écart est signalé.

| URL | Type de page | Accessible | Remarques |
|---|---|---|---|
| `/` | Accueil marketing | oui | 12 434 px de haut, splash animé, bannière cookies |
| `/coiffeurs` | Recherche / liste | oui | Grille de cartes en verre |
| `/coiffeurs/annuaire` | Annuaire par ville | oui | Fil d'Ariane, cartes simples |
| `/<pro>` | Fiche prestataire (web app) | oui, instable | Rendu côté client. Une fois « Une erreur s'est produite » ; une fois un calque `.hp-overlay` bloquant |
| `/<pro>` → réservation | Étapes de réservation | oui, jusqu'au formulaire | Prestation → créneau → informations → « Confirmer » (**non cliqué**, rien saisi) |
| `/coiffeurs/<pro>` | Fiche SEO | oui | Erreur 502 au premier essai, puis 200 |
| `/coiffeur/<ville>` | Page ville : liste et carte Leaflet | oui | Épingles de prix, popup |
| `/dashboard/carte` | Carte de la web app (Mapbox) | oui | État vide (pas de géolocalisation en navigateur sans affichage) |
| `/dashboard/accueil` | Accueil de la web app | oui | Chips de catégories, bouton « Filtres » |
| `/login` | Connexion / inscription | oui (affichage seulement) | Page blanche au premier chargement |
| `/pro` | Devenir partenaire | oui | |
| `/tarifs` | Tarifs | oui | |
| `/user` | Landing clients | oui | |
| `/application` | Télécharger l'app | oui | Capturée, non analysée |
| `/contact` | Contact | oui | Capturée, non analysée |
| `/page-inexistante-xyz` | 404 | oui (statut 404) | « Barbier non trouvé » |

**Deux systèmes visuels distincts (observé).**

1. **Site marketing** : Tailwind 3.4.19 (en-tête du CSS main), polices uberMove et Archivo, effets de verre sur fond violet nuit.
2. **Web app** (`/<pro>`, `/dashboard/*`, `/login`) : styles React écrits en ligne, police DM Sans, fond `#F2F2F7` façon iOS (`app.pretty.css` l.56).

**C'est le site marketing qui porte l'effet « waouh ».** La web app est sobre, presque sans états (voir §2).

### 1. Design tokens

#### Palette

Source : classes `.bg-fady-*`, `.text-fady-*`, `from-`/`to-` du CSS main, et valeurs calculées.

| Rôle | Hex | Usage observé |
|---|---|---|
| Primaire | #BC31FC | Boutons, liens, épingles, points |
| Primaire 50 | #F5EBFF | Fonds teintés, survol |
| Primaire 100 / 200 / 300 | #E4C8FF / #D4A5FF / #C882FF | 300 : deuxième ton des titres sur fond sombre ; 200 : titres de colonnes du footer |
| Primaire 500 | #A01ED9 | Survol de « Accepter » |
| Primaire 600 | #7B1AB6 | Fin des dégradés de CTA |
| Primaire 700 | #5B1899 | Survol des épingles et des CTA de popup |
| Primaire 800 | #3D0F66 | Haut du dégradé du footer |
| Prune | #2A0B47 | Fonds sombres, menus déroulants |
| Nuit | #1B0733 | Fond sombre principal |
| Texte | #0F0F14 | Corps de texte, bouton noir de la web app |
| Texte secondaire | #6B6B7A | Paragraphes |
| Fond clair | #F6F6FA ; brume #FBF7FF | Sections claires |
| Bordures | #ECECF1, #D9D9E3 (survol), #E5E5E5 | |
| Web app | fond #F2F2F7, #F9F9F9 ; bordures #EEEEEE et #ECECF2 ; texte #1A1A1A ; désactivé #999999 ; créneau #F5F5F5 ; « Fermé » #FF3B30 | Valeurs calculées ou écrites en ligne |
| Signaux | #10B981 (point « 24 h/24 »), #22C55E (dispo, pulsé), #FDE047 et #F5B301 (étoiles) | |

Des tokens shadcn existent dans `:root` (CSS main l.44 : `--ring:280 96% 59%`, `--radius:.5rem`). **`--ring` n'est jamais appliqué au focus** (voir §2).

#### Typographies

**Familles** (déclarations dans `dl/4aa68607b08fdfb4.css`) :
- **uberMove** 500 et 700 : police de base (`body{font-weight:500}`, titres en 700, CSS main l.46).
- **Archivo** variable, graisses 100 à 900, largeur 62 à 125 %. Employée en 900, largeur 125 %, majuscules, via `.title-wide` (l.1197) : `line-height:1`, `letter-spacing:-.01em`.
- **DM Sans** 400 à 800 : web app.
- **Instrument Serif** : déclarée mais non chargée sur les pages mesurées (supposé inutilisé).

**Échelle (valeurs calculées en 1440 px) :**

| Élément | Valeur |
|---|---|
| H1 du hero | Archivo 900, 61,92 px, interligne 65 px (1,05), largeur 125 %, majuscules, `clamp(1.9rem,4.3vw,62px)`. Mobile : 30,4 / 31,9 px |
| H2 de section | Archivo 900, 41,6 / 41,6 px, interlettrage −0,416 px, `clamp(1.6rem,3vw,2.6rem)` |
| H1 de l'annuaire | uberMove 700, 60 / 60 px, −0,03em |
| Paragraphe d'introduction | 18 / 29,25 px (1,625), poids 500, #6B6B7A, largeur max 672 px |
| Prix (tarifs) | Archivo 900, 48 px, largeur 125 % |
| Pastille au-dessus des titres | 10 px, 700, majuscules, interlettrage 0,5 px |
| Titres de colonnes du footer | 12 px, 700, majuscules, interlettrage 2,16 px, #D4A5FF |
| Chiffres fantômes | 96 px, 700, contour de 2 px violet à 30 %, texte transparent, remplis en #BC31FC quand actifs, `color .5s` (`.ghost-num`, l.1201) |

Les titres sont bicolores : une partie en blanc ou noir, l'autre en #C882FF ou #BC31FC (spans mesurés).

#### Espacements

Échelle Tailwind, base 4 px.

| Zone | Valeurs mesurées |
|---|---|
| Sections | `py-24 md:py-32` (96 / 128 px) ; FAQ en 80 px |
| Hero | `pt-44 sm:pt-48 pb-16` |
| Padding des cartes | 12 px (verre), 20 px (cookies), 28 px (carte pro), 30 px (tarifs) |
| Écarts | 6, 8, 10, 12, 16 et 24 px |

#### Rayons

Hiérarchie nette, toutes valeurs mesurées.

| Rayon | Éléments |
|---|---|
| Pilule (9999 px) | Tous les boutons marketing |
| 48 px | Bas du hero |
| 32 px | Cartes bento |
| 31 px | Capsule de recherche |
| 28 px | Carte verre, carte pro, menu déroulant |
| 24 px | Tarifs |
| 20 px | Images, barre d'information bento |
| 18 px | Liens du menu déroulant, popup de carte |
| 16 px | FAQ, cookies, panneau de carte |
| 12 px | Annuaire, web app |
| 10 px | CTA de la web app |
| 8 px | Bouton « Choisir », bouton de la 404 |
| 6 px | Créneaux |

#### Ombres (CSS main l.1052–1078 et valeurs mesurées)

Les ombres sont **presque toutes teintées de violet** :
- `0 4px 14px rgba(188,49,252,.4)` : étape active ;
- `0 12px 40px -10px rgba(188,49,252,.6)` : survol du CTA pro ;
- `0 20px 50px -15px rgba(188,49,252,.9)` : CTA géant ;
- `0 24px 60px -20px rgba(10,0,25,.6), 0 0 0 6px rgba(255,255,255,.08)` : capsule de recherche ;
- `0 18px 50px -20px rgba(15,15,20,.35)` : bannière cookies ;
- `0 0 60px -12px rgba(188,49,252,.7)` + `inset 0 1px 0 rgba(255,255,255,.18)` : carte du tarif Pro.

#### Verre, flou et dégradés (CSS main)

**Effets de verre :**
- `.glass-panel` (l.1195) : dégradé à 140° blanc .82 → .48, `blur(22px) saturate(160%)`, bordure blanche .85, ombres `inset 0 1px 0 rgba(255,255,255,.95), 0 24px 50px -28px rgba(91,24,153,.45)`.
- `.glass-panel-dark` (l.1196) : blanc .14 → .04, flou 22 px, bordure blanche .16.
- `.nav-liquid` (l.1199) : fond rgba(27,7,51,.72), `blur(18px) saturate(160%)`, 8 couches d'ombres (biseaux intérieurs clair et sombre, liserés bleu et rose, ombres portées), reflet `:before` en `mix-blend-mode:screen`.

**Fonds et dégradés :**
- `.bg-night` (l.1192) : 3 halos radiaux violets sur `linear-gradient(180deg,#1B0733,#2A0B47 55%,#1B0733)`.
- Calque d'image en `screen` à 10 % d'opacité, masqué vers le bas.
- `.bg-mist-flow` (l.1194) : #FBF7FF avec 2 halos répétés tous les 1800 px.
- CTA : `linear-gradient(to right top,#BC31FC,#7B1AB6)`.
- Footer : `#3D0F66 → #2A0C4D 55% → #1A0A2E`.

#### Animation

**Courbes et durées :**
- Courbe signature : `cubic-bezier(.22,1,.36,1)`, une forte décélération.
  - `.card-lift` : .4s (l.1182) ;
  - `.animate-rise` : .8s (l.1191).
- Courbe Tailwind par défaut `(.4,0,.2,1)`, en 150, 200, 300, 500 et 700 ms.
- Splash : `(.65,0,.35,1)` et `(.76,0,.24,1)`.
- Épingles de carte : `.18s ease`.

**Boucles :**
- `float` : 6 s et 8 s ;
- `marquee` : 28 s, linéaire ;
- `dot-pulse` : 2 s.

**Keyframes de la web app :**
- `panelIn` : scale .92, translateY −12 px, flou 4 px, jusqu'à l'état normal ;
- `sheetUp` ;
- `slideInRight` : .3s ;
- `checkPop` et `drawCheck` ;
- `spin`.

**Aucune règle `prefers-reduced-motion` dans les 5 CSS (vérifié).** Seul le style écrit en ligne du splash le masque dans ce cas.

### 2. Fiche Boutons

Fichiers de mesure : `dl/buttons-home.json`, `dl/mischome-log.txt`, `dl/webapp-log.txt`, `dl/webapp2-log.txt`, `dl/last-log.txt`, `scripts/mobile*.out`. Gros plans : `shots/btn-*.png`.

**Focus, constat transversal (mesuré).**
- **Aucun anneau de focus personnalisé.** Partout, c'est l'outline par défaut du navigateur (`auto 1px`).
- Les liens de navigation ont `focus:outline-none` : le seul repère du focus est le passage du texte au blanc.
- **Web app** : aucune règle de focus, et les champs sont en `outline:none`.

**Légende.**
- « mesuré » : valeur lue sur la page.
- « CSS » : valeur lue dans la règle CSS.
- « introuvable » : état absent du CSS et non observé.
- « UA » : outline par défaut du navigateur.

| # | Variante | Spécifications (mesurées) | Survol | Focus | Actif | Désactivé / chargement |
|---|---|---|---|---|---|---|
| 1 | CTA de recherche (hero) | Archivo 900, 13 px, largeur 125 %, majuscules ; padding 15/25 ; h 43 ; pilule ; dégradé #BC31FC → #7B1AB6 ; flèche SVG ; `transform .3s (.4,0,.2,1)`. Pleine largeur en mobile | mesuré : `scale(1.03)` | UA | CSS : `active:scale-[0.97]` | CSS : `disabled:opacity-80 cursor-wait`, sans grossissement. Probablement l'état de chargement. Aucun spinner vu |
| 2 | Primaire plein (« Accepter ») | uberMove 700, 14 px ; padding 10/24 ; h 44 ; pilule ; #BC31FC ; couleurs en .15s | mesuré : #A01ED9 | UA | introuvable | introuvable |
| 3 | Secondaire contour (« Refuser ») | 14 px 700 ; bordure 2 px #ECECF1 ; texte #0F0F14 | CSS : bordure #D9D9E3 (non reproduit à la mesure) | UA | introuvable | introuvable |
| 4 | CTA de la nav | Archivo 900, 12 px, majuscules ; h 32 ; padding 0/20 ; fond blanc ; texte #0F0F14 | mesuré : fond #BC31FC, texte blanc, .15s | UA | introuvable | — |
| 5 | Liens et déclencheurs de la nav | 13 px 500, blanc .75 ; transition .2s | mesuré : blanc | outline transparent, **pas d'anneau visible** | — | CSS : `disabled:opacity-50` |
| 6 | Lien « Connexion » | 13 px 600, blanc, icône | mesuré : #C882FF | UA | — | — |
| 7 | Sélecteur segmenté salon / domicile | Rail en verre sombre (padding 4) ; boutons 11 px 700 majuscules, padding 6/16, h 28,5 ; indicateur actif = pilule blanche absolue ; texte actif #0F0F14, inactif blanc .65 ; .2s | mesuré : inactif → blanc | UA | introuvable | Pas de `role` ni d'`aria-pressed` (mesuré). Glissement de l'indicateur supposé géré en JS, non capturé |
| 8 | Contour sur fond sombre (tarifs) | Archivo 900, 13 px ; padding 16/24 ; h 53,5 ; bordure 1 px blanc .4 ; pleine largeur | mesuré : fond blanc, texte sombre, .15s | UA | — | — |
| 9 | Blanc sur fond sombre (tarifs) | idem, fond blanc, h 51,5 | mesuré : fond #BC31FC, texte blanc, .3s | UA | — | — |
| 10 | CTA géant (bandeau pro) | Archivo 900, 15 px ; padding 20/40 ; fond blanc ; ombre `0 20px 50px -15px rgba(188,49,252,.9)` | CSS tronqué ; fond violet supposé | non mesuré | — | — |
| 11 | Pilule avec icône (CTA pro) | 16 px 700 ; padding 8/8/8/28 ; h 56 ; fond blanc ; cercle d'icône de 40 px violet ; `all .3s` | mesuré : écart 12 → 16 px, ombre violette, icône `rotate(-35deg)`, reflet qui balaie en .7s | UA | — | — |
| 12 | Ghost en verre (« Tout voir ») | verre ; 14 px 700 ; padding 6/6/6/20 ; h 46 ; flèche dans un cercle violet de 32 px | mesuré : texte #BC31FC. CSS : flèche décalée de 0,5 | UA | — | — |
| 13 | Ghost en verre (mobile seulement) | verre, padding 12/24, texte violet 700 | non mesuré | — | — | — |
| 14 | Lien texte avec chevron | 14 px 600, #BC31FC | CSS : `hover:underline` | UA | — | — |
| 15 | Boutons icône | Vidéo 44×44, gris .7, flou ; burger 40×40 ; réseaux sociaux 46×46, rayon 12, bordure pointillée | Vidéo : plus foncé ; réseaux : translateY(−4 px), bordure violette | UA | — | — |
| 16 | Pastilles d'étape 01/02/03 | Cercle de 44 px, bordure 2 px ; actif : fond violet et ombre ; inactif : fond blanc, texte #6B6B7A ; `all .3s` | mesuré : bordure violette .4 | UA | — | — |
| 17 | Bascule de langue | 14 px 500 ; padding 4/10 ; actif : #BC31FC et `aria-pressed=true` | mesuré : #0F0F14 | UA | — | CSS : `disabled:opacity-60` |
| 18 | Badges des stores | 180×60, rayon 10, bordure 1,5 px violette | mesuré : scale 1.05, opacité .9, .3s | UA | — | — |
| 19 | Puce « Réserver » des cartes bento | h 32 ; padding 0/10 ; 12 px 700 ; fond blanc ; `all .3s` | mesuré, au survol de la carte : fond violet et **largeur 40 → 88 px, le libellé se révèle** | — | — | — |
| 20 | Épingle de prix (carte Leaflet) | 12,5 px 700 ; padding 5/10 ; fond #BC31FC ; bordure 2 px blanche | mesuré : `scale(1.1)`, fond #5B1899, .18s | **non focalisable** | — | — |
| 21 | Petit CTA de la fiche SEO | 12 px 700 ; padding 8/16 ; pilule violette | CSS : `hover:scale-105` | — | — | — |
| 22 | Bouton de la 404 | 16 px 500 ; padding 12/24 ; h 48 ; **rayon 8** ; #A01ED9 | mesuré : aucun changement | UA | — | **Incohérent** avec le reste du site |
| 23 | Primaires de la web app | « Réserver » : 13 px 700, rayon 100. « Choisir » : 12 px 600, **h 30**, rayon 8. « Continuer » : 14 px 700, rayon 10 | **aucun changement** (style en ligne, transition 0s) | UA | introuvable | mesuré : fond #EEE, texte #999, `disabled`. Flèche du calendrier désactivée : #DDD |
| 24 | « Confirmer la réservation » (web app) | h 56 ; rayon 28 ; fond #0F0F14 ; DM Sans 800, 16 px | aucun changement | — | — | **reste actif même si le formulaire est vide** (mesuré) |
| 25 | Ghost « Itinéraire » (web app) | h 46 ; rayon 999 ; fond blanc ; bordure #ECECF2 | non mesuré | — | — | — |
| 26 | Élément de barre latérale (web app) | 15 px ; padding 12/14 ; rayon 12 ; actif : fond violet, texte blanc 700 et ombre ; inactif #444 ; `background .15s` | mesuré : #F5F5F5 | UA | — | — |
| 27 | Chips et filtres (web app) | Desktop : fond blanc, bordure #ECECF2, rayon 12, padding 9/18. Mobile : h 30, actif #1A1A1A | aucun changement | — | — | — |
| 28 | CTA flottant mobile | `position:fixed; bottom:32px; width:calc(100% - 40px); max-width:600px` ; pilule violette avec halo (capture `04-fiche-mobile-fold2.png`) | — | — | — | — |
| 29 | Boutons de connexion | Google : fond blanc .9, h 54,5, pilule. Apple : noir. « Créer un compte » : dégradé à 135° et ombre `0 14px 30px -12px rgba(188,49,252,.8)` | non mesuré | — | — | — |

**Survol et pression, transversaux (CSS main l.1326–1328).**
- Survol : `hover:-translate-y-0.5/-1`, `hover:scale-105/[1.03]`.
- Pression : `active:scale-[0.97]/[0.98]`.

**Chargement.** `.animate-spin` existe, mais **aucun spinner n'a été observé**.

**Complétude de la fiche.** Les 29 variantes trouvées sont listées. Pour chaque état : mesuré, lu dans le CSS, ou marqué « introuvable » ou « non mesuré ». Aucune valeur n'a été déduite sans le signaler.

### 3. Autres composants

**Champs et recherche.**
- **Capsule de recherche du hero** :
  - blanche, rayon 31, h 62, largeur max 680, double ombre ;
  - icône de lieu violette, champ en 14 px 500 ;
  - **ni label ni `aria-label`** (mesuré) ;
  - aucun changement au focus ;
  - empilée en colonne sur mobile (358×116).
- **Formulaire de la web app** :
  - padding 12/14, rayon 12, bordure #ECECF2 ;
  - **placeholder seul** (aucun label), pas d'`autocomplete`, aucun style de focus.

**Filtres et chips.** Voir les boutons #27. Sur desktop : une rangée de pilules blanches à bordure, la pilule active en violet, et « Filtres » à droite (`15-webapp-accueil-desktop.png`).

**Cartes de prestataire.**
- **Bento de l'accueil** :
  - rayon 32, fond #1B0733, image en cover et voile de nuit à 80 % ;
  - pastille de note en verre sombre ;
  - barre basse en verre sombre, rayon 20 : nom en Archivo 900 majuscules, ville et prix « dès X » ;
  - au survol, l'image passe à `scale(1.06)` en .7s ;
  - sur mobile : carrousel `snap-x` de cartes 287×359.
- **`/coiffeurs`** :
  - `card-lift` : −6 px en .4s avec la courbe `(.22,1,.36,1)`, mesuré ;
  - verre, rayon 28, padding 12 ; image en 4/5, rayon 20 ;
  - point vert pulsé ;
  - grille de 4 colonnes en `lg`, largeur max 1280.
- **Annuaire** : fond blanc, bordure #E5E5E5, rayon 12. Au survol : −2 px, bordure violette et ombre violette .1 (mesuré).
- **Page ville** : carte horizontale avec image carrée, note, tags « En salon » en gris et « À domicile » en violet clair, « dès 15 € », CTA.

**Badges.**
- « Réserve en ligne 24 h/24 » : verre sombre, h 32, 10 px majuscules, point émeraude au halo pulsé.
- Pastilles de section : verre clair, point violet.
- « Populaire » : fond blanc, texte violet.
- « En salon » : pilule violet clair.

**Notes et étoiles.**
- Étoile jaune sur l'accueil.
- Cinq étoiles violettes sur les fiches.
- Bloc de note de la web app : 48×48, 20 px 800.

**Navigation.**
- **Desktop** :
  - pilule `nav-liquid` fixe et centrée, 905×54, à 20 px du haut ;
  - menus déroulants Radix ouverts au survol, avec un panneau en dégradé prune → nuit, rayon 28 ;
  - contenu des menus : une tuile illustrée et 4 liens de rayon 18 (`nav-dropdown-*.png`).
- **Mobile** :
  - pilule 163×54 avec logo et burger ;
  - menu plein écran #1B0733, liens en Archivo 900 (27,3 px), élément courant en #C882FF (`nav-mobile-menu-open.png`) ;
  - « Clients » et « Coiffeurs » n'y sont pas dépliables (le clic a échoué).
- **Web app** : barre latérale de 256 px. Sur mobile, une barre d'onglets en bas (voir 02b, F17).

**Modales et feuilles.**
- Feuille mobile « Choisir une ville ».
- Fiche mobile en plein écran, avec l'animation `slideInRight .3s`.
- Keyframes `panelIn` et `sheetUp`.

**Calendrier et créneaux** (`06-booking-step2-slot-selected-desktop.png`).
- **Semaine** : 7 colonnes, flèches de 32 px (active en violet, désactivée en #DDD).
- **Créneaux** : rayon 6, fond #F5F5F5, 13 px 500. Sélectionné : fond violet, texte blanc. **Ni survol ni transition.**
- **Récapitulatif latéral** : total en violet.
- **Indicateur d'étapes** : 2 barres de 24×4.

**Carte géographique.**
- **Pages ville** : Leaflet avec les tuiles Carto. Popup de rayon 18 avec une ombre violette.
- **Web app** : Mapbox. Point utilisateur #4285F4 de 20 px, zooms dans des cercles violets.

**Bannière cookies.**
- Fixe en bas, largeur max 768, fond blanc, rayon 16, padding 20.
- Boutons #2 et #3.
- Empilée sur mobile.

**FAQ.**
- Éléments en verre, rayon 16.
- Chevron violet qui pivote de 180° en .2s.

**Footer.**
- Dégradé violet profond, titres de colonnes en majuscules #D4A5FF.
- Liens blancs à .6 opacité qui passent à 1.
- Tuiles des réseaux sociaux, liens vers les pages ville (SEO).

### 4. Mise en page

**Largeurs.**
- Container Tailwind : 640 / 768 / 1024 / 1280 / 1536.
- Hero : 1280, avec `px-4 sm:px-6 lg:px-8` ; texte limité à 896.
- Grilles : 1280.
- Panneaux sombres : 1400.
- FAQ et bannière cookies : 768.
- Capsule de recherche : 680.

**Rythme vertical.**
- Sections de 128 px sur desktop et 96 px sur mobile.
- Le hero sombre fait 1332 px et se termine par un arrondi de 48 px.
- Suit un fond « brume » continu, ponctué de panneaux sombres arrondis : on obtient une alternance clair/sombre.

**Scrollytelling.** La section « comment ça marche » fait 320vh, avec un bloc `sticky top-0 h-screen` et 3 étapes (mesuré).

**Hiérarchie.**
- Ordre type d'une section : pastille, titre extra-large bicolore, paragraphe de 18 px en gris, CTA en pilule.
- Alignement à gauche dans les sections, centré dans le hero et les tarifs.

**Mobile et desktop.**

| Élément | Desktop | Mobile |
|---|---|---|
| H1 | 62 px | 30 px |
| Navigation | pilule complète | logo et burger |
| Capsule de recherche | en ligne | empilée en colonne |
| Bento | grille | carrousel avec snap |
| Bannière cookies | sur une ligne | empilée |
| Fiche de la web app | barre latérale et récapitulatif | plein écran et CTA flottant |

### 5. Micro-interactions « waouh », et pourquoi elles fonctionnent

1. **Splash « coup de tondeuse »** (CSS en ligne dans `dl/home.html`) :
   - le logo se dévoile en `clip-path` (.55s), avec un trait-lame en `scaleX` ;
   - un reflet traverse ;
   - un rideau se lève à 1,05 s (.62s), et son bord inférieur s'arrondit ;
   - durée totale inférieure à 1,7 s.

   Ça marche parce que c'est une **métaphore du métier**, unique et courte.
2. **Hero** : vidéo 3D en `mix-blend-screen` sur le fond `bg-night`. Les contenus entrent en `rise` (.8s) avec la courbe signature. Le mélange en `screen` sur fond sombre donne de la profondeur.
3. **Apparition au défilement avec flou** : état initial écrit en ligne `opacity:0; filter:blur(12px); transform:translateY(56px) scale(.92)`, puis retour à `none`. Effet de **mise au point**. La bibliothèque utilisée n'est pas confirmée.
4. **Navigation « liquid glass »** : biseaux et reflet en `screen`. On dirait un objet physique qui flotte au-dessus de la page.
5. **Scrollytelling sticky** : barres de progression, pastilles qui s'activent, chiffres fantômes qui se remplissent.
6. **Carte pro en 3D** : elle s'incline avec le curseur (`rotateX(2.4deg) rotateY(3.5deg)` mesurés, perspective 1200 px). Un projecteur radial de 420 px suit la souris et le contenu est en `translateZ(24px)`. L'amplitude faible donne une sensation premium sans gêner la lecture.
7. **Bento** : zoom lent sur l'image et puce « Réserver » qui révèle son libellé. L'action apparaît **au moment où l'intérêt naît**.
8. **CTA pro** : reflet qui balaie, flèche qui pivote, ombre qui pousse.
9. **Parallaxe à la souris** sur les halos décoratifs (supposé).
10. **Boucles discrètes** : flottement, points pulsés.

Ces effets **ne vivent qu'aux moments forts de la marque**. La web app, elle, reste sobre.

**Écarts relevés avec la grille d'audit ui-ux-pro-max** (mesurés, à ne pas reproduire) :
- focus absent ou non personnalisé ;
- champs avec placeholder seul ;
- cibles de 28 à 32 px ;
- aucune règle reduced-motion pour les boucles, la parallaxe et le flou ;
- sélecteur segmenté sans sémantique de bascule ;
- web app sans aucun retour visuel au survol ni à la pression ;
- bouton de la 404 incohérent avec le reste.

## Preuves

Racine : `/tmp/claude-0/-home-user-FindBarberNearYou/aa8f60d5-9b33-5a35-b062-5fcb4207902e/scratchpad/c1/`.

**CSS et HTML téléchargés** :

| Fichier | Contenu |
|---|---|
| `dl/c10df3c7b77dd950.css` (`dl/main.pretty.css`) | CSS principal |
| `dl/4aa68607b08fdfb4.css` | Polices |
| `dl/b21f393680a041f4.css` (`dl/app.pretty.css`) | Web app |
| `dl/ff71e99ff1d613a4.css` | Mapbox |
| `dl/55693049b062c6a3.css` | Leaflet |
| `dl/home.html` | Splash |
| `dl/sitemap.xml` | Plan du site |

**Mesures** :
- `dl/buttons-home.json`, `dl/home2-log.txt`, `dl/mischome-log.txt` ;
- `dl/webapp-log.txt`, `dl/webapp2-log.txt`, `dl/last-log.txt` ;
- `scripts/mobile.out`, `scripts/mobile2.out` ;
- `dl/crawl-{a,b,c}.json`.

Les lignes « home » de `dl/misc-log.txt` sont **invalides** (CSS non chargé) et ont été remplacées par celles de `mischome-log.txt`.

**Captures clés** (`shots/`) :
- Accueil et sections : `01-home-desktop-fold-raw.png`, `01-home-desktop-full.png`, `01-home-mobile-fold.png`, `01-home-desktop-howitworks.png`, `01-home-desktop-sec-MEILLEURS_BARBERS.png`, `01-home-desktop-sec-MODE_PRO.png`, `home-pro-card-tilt-hover.png`.
- Listes, annuaire et carte : `02-coiffeurs-desktop-fold.png`, `03-annuaire-desktop-fold.png`, `05-ville-desktop-map-popup.png`, `07-webapp-carte-desktop.png`, `15-webapp-accueil-desktop.png`.
- Fiche et réservation : `04-fiche-desktop-full.png`, `04-fiche-desktop-error-state.png`, `04-fiche-mobile-full.png`, `04-fiche-mobile-fold2.png`, `06-booking-step1-desktop.png`, `06-booking-step2-slot-selected-desktop.png`, `06-booking-step3-*-desktop.png`, `11-fiche-seo-desktop-fold.png`.
- Autres pages : `07-pro-desktop-fold.png`, `08-tarifs-desktop-fold.png`, `09-login-desktop-fold.png`, `10-404-desktop-fold.png`.
- Navigation, cookies, FAQ, footer : `nav-dropdown-clients-desktop.png`, `nav-dropdown-coiffeurs-desktop.png`, `nav-mobile-menu-open.png`, `cookie-banner-desktop.png`, `faq-closed.png`, `faq-open.png`, `footer-desktop.png`, `footer-mobile.png`.
- Gros plans des boutons (normal, survol, focus) : `btn-*.png`.

## Limites

- **Proxy instable** : connexions TLS interrompues, une erreur 502, une fiche en erreur, la page de connexion blanche au premier chargement, des CSS parfois non appliquées. Rechargement automatique ajouté dans `scripts/lib.mjs`.
- **Mesures écartées** : celles de `misc-log.txt` (home), `06-login-desktop-*` (page blanche) et `05-ville-desktop-*` du crawl (bannière cookies visible). Toutes les captures pleine page du crawl n'ont pas été revues visuellement.
- **Parcours de réservation** arrêté au formulaire : rien saisi, rien soumis, aucun compte créé, cookies jamais acceptés (bannière masquée dans le DOM local).
- **États non mesurés ou introuvables** :
  - `:active` est lu dans le CSS uniquement ;
  - aucun spinner de chargement n'a été observé ;
  - survol de « Refuser » non reproduit ;
  - soulignement des liens au survol non mesuré ;
  - glissement de l'indicateur du sélecteur segmenté non capturé ;
  - survol du CTA géant non mesuré ;
  - survols mobiles et CTA flottant complet non mesurés.
- **Tuiles Carto** : la capture affiche « API KEY REQUIRED ». On ne sait pas si cela vient du site ou de notre environnement.
- **Pages non analysées** : `/application`, `/contact` et `/barber-a-domicile/<ville>` ont été capturées mais pas analysées.
- **16 URL** visitées au lieu de 15.
- **Skills** : aucune recherche lancée avec `search.py`. Les étapes de persistance (`MASTER.md`) et de construction ne s'appliquent pas à une analyse en lecture seule, elles ont été ignorées.

## Questions ouvertes

1. **Quelle source de référence ?** La web app (DM Sans, styles en ligne, sans états) doit-elle servir de référence, ou seulement le site marketing ? *Recommandation du coordinateur : le marketing pour le langage visuel et l'effet waouh ; la web app pour la structure des parcours (barre latérale, réservation en étapes, grille de créneaux), sans reprendre ses défauts.*
2. **Route attrape-tout `/<slug>`** : faut-il reprendre cette idée ?
3. **Page ville (Leaflet et épingles de prix)** : faut-il l'étudier plus en profondeur ?
4. **Animations** : faut-il confirmer leur bibliothèque en lisant les fichiers JS ? Ce n'est pas fait.

**Skills** : C1 a lu frontend-design et ui-ux-pro-max (SKILL.md, `references/quick-reference.md` et `references/pro-rules.md`). Appliqués **partiellement** :
- ui-ux-pro-max a servi de grille d'audit ;
- frontend-design a servi à repérer les traits génériques ;
- la recherche, la persistance et la construction ne s'appliquent pas à cette phase.
