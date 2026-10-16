# 04 — Logo : 3 concepts originaux

> Phase 4 de la mission de refonte. Les concepts ont été dessinés par le sous-agent D (Designer), puis relus et validés par le coordinateur.
> **Statut : propositions.** Le logo actuel de l'application n'est **pas** remplacé. `client/src/components/Logo.tsx`, `client/public/favicon.svg` et `email-logo.png` sont intacts : `git status --short` ne montre aucune modification de fichier suivi.

## 1. Brief transmis au Designer

- **Skill** : `frontend-design`, lu en entier par D. Méthode suivie : plan, revue du plan contre le brief, construction, puis autocritique sur des captures réelles.
- **Système à respecter** : « Dégradé » (voir `03-plan-refonte.md` §2).
  - Motif : des lignes de 2 px dont l'écart augmente, 2, 3, 5, 8, 12 puis 18 px. On passe ainsi du plein au vide, comme un *skin fade*.
  - Couleurs :

    | Rôle (token de 03 §2.1) | Clair | Sombre |
    |---|---|---|
    | Cobalt (`accent`) | #2350F5 | #7C9BFF |
    | Laiton (`brass`) | #B07A22 | #E2B66A |
    | Texte (`foreground`) | #0C1428 | #EDF1FA |
    | Fond (`background`, ou `night` pour les sections nuit) | #F6F7FB | #070B17 (`background`) ou #0A1024 (`night`) |

    Les SVG contiennent ces valeurs en dur, comme le favicon actuel : un logo autonome ne lit pas les variables CSS.

  - Typographie : Bricolage Grotesque 700.
- **Interdits liés à la référence** (dont le logo est un mot-symbole minuscule et italique, avec un « f » stylisé, blanc sur violet) :
  - le violet ou le magenta ;
  - un mot-symbole en minuscules italiques ;
  - un « f » ligaturé ;
  - les polices uberMove et Archivo ;
  - le verre utilisé comme élément de logo.
- **Autres interdits** :
  - reprendre le logo provisoire actuel (une tuile pleine avec un « F ») ;
  - les clichés de barbier non retravaillés (enseigne à spirale, ciseaux croisés, moustache).

## 2. Les trois concepts

Tous les fichiers sont dans `docs/redesign/logo/`. Chaque concept existe en 4 fichiers :
- `-full-light.svg` et `-full-dark.svg` : symbole et nom ;
- `-icon-light.svg` et `-icon-dark.svg` : icône seule, viewBox 32×32.

Les planches de rendu Chromium sont `planche-concept-N-*.png`.

### Concept 1 — « Nuque » (`concept-1-nuque-*`)
- **Idée.** Un B capital, pour Barber. Le haut est plein ; la panse basse se défait en paliers, comme un dégradé qui descend vers la nuque. Le fondu *est* la lettre, il n'est pas posé dessus.
- **Construction.**
  - Icône sur une grille de 32 : fût de 6, plein jusqu'à y = 20, puis deux lignes de 2 px (écarts 2 puis 3).
  - Lockup sur une grille de 40 : fût de 8, trois lignes (écarts 2, 3, 5).
- **Couleurs.** Symbole cobalt (#2350F5 en clair, #7C9BFF en sombre) ; nom en #0C1428 / #EDF1FA.
- **Vu sur la planche.**
  - Le B se lit à 32 px, et les deux traits du fondu restent séparés.
  - À 16 px, c'est encore un B, mais les lignes se touchent presque.
  - À 64 et 256 px, c'est le dessin le plus fort des trois.
- **Faiblesses.**
  - Le monogramme en B est courant chez les barbiers.
  - Le B se répète juste à côté de « FindBarber ».
  - Le symbole est grand par rapport au nom.
- **Risque de ressemblance.** Les lettres rayées horizontalement font partie de la famille d'IBM, mais ici seul le bas est rayé et les écarts progressent. Aucun lien graphique avec la référence : ni f, ni italique, ni violet.
- **Proximité de métaphore (relevée à la revue).** La référence signe sa marque par un splash « coup de tondeuse » (02a §5). « Nuque » parle aussi de coupe, mais par le *résultat* (le dégradé), pas par l'outil ni par un geste qui balaie. Le logo est statique et n'est jamais dévoilé par une animation. Voir `03-plan-refonte.md` §2 et la décision 6 du §4.

### Concept 2 — « Repère » (`concept-2-repere-*`)
- **Idée.** Une épingle de carte (« trouver près de chez soi ») dont la pointe se dissout en paliers.
- **Construction.**
  - Icône : un cercle de rayon 10 avec un trou de rayon 3,5, et une pointe coupée en paliers (écarts 2, 3).
  - Lockup : rayon 12, trois lignes (écarts 2, 3, 5).
- **Couleurs.** Cobalt / #7C9BFF ; nom en #0C1428 / #EDF1FA.
- **Vu sur la planche.**
  - C'est le plus lisible à 16 et à 32 px.
  - **À 256 px, la forme évoque une ampoule avec un culot fileté.** Le Designer l'a relevé, et je le confirme sur la planche.
- **Faiblesses.**
  - « Une épingle et quelque chose » est le gabarit le plus courant des places de marché locales.
  - Le métier n'est porté que par le nom.

### Concept 3 — « Peigne » (`concept-3-peigne-*`)
- **Idée.** Un peigne de coiffeur dont l'écartement des dents reprend le motif « Dégradé ». Le dos est à droite, pour qu'on ne lise pas un E ou un F.
- **Construction.**
  - Icône : 7 dents. Écarts 2, 2, 2, 2, 3, 5, vérifiés dans le SVG : dents en y = 1, 5, 9, 13, 17, 22 et 29.
  - Lockup : écarts 2, 2, 2, 3, 5, 8.
- **Couleurs.** **Laiton** (#B07A22 en clair, #E2B66A en sombre) ; nom en #0C1428 / #EDF1FA.
- **Vu sur la planche.**
  - On lit un peigne à 32 px.
  - **La progression des écarts se perçoit mal**, puisque seuls les deux derniers diffèrent.
  - À 16 px, ce n'est plus qu'une tache rayée.
- **Faiblesses.**
  - En clair, le contraste est de 3,47:1 sur #F6F7FB : c'est juste au-dessus du seuil.
  - En faire la couleur de marque **détournerait le laiton**, que le système réserve à la confiance (note, badge certifié).
  - Risque de ressemblance avec une règle graduée et avec les nombreux logos de barbier à peigne.

## 3. Validation (contrôles réels)

| Contrôle | Méthode | Résultat |
|---|---|---|
| SVG valides | `xml.etree.ElementTree.parse`, relancé par le coordinateur sur les 12 fichiers de `docs/redesign/logo/` | **12/12 OK** |
| Accessibilité de base | Lecture de la racine | Tous portent `role="img"` et `<title>FindBarber</title>` |
| Contenu interdit | Recherche de `<script`, `<image`, `href`, `@font`, `<text`, `url(http`, `foreignObject` | **Aucune occurrence** |
| Couleurs | Extraction des hex par regex | Uniquement des tokens du système (voir §1) |
| viewBox | Lecture | Icônes 32×32 ; lockups de 177×40, 181×40 et 173×40 |
| Poids | `ls` | Icônes de 368 à 407 o ; lockups de 5,3 Ko environ |
| Lisibilité | Planches Playwright/Chromium à 16, 32, 64 et 256 px, avec loupe ×6 des pixels à 32 px, lockups à 40 et 24 px et un en-tête à 32 px | Voir §2. Les observations viennent des PNG réellement rendus, relus par le coordinateur. |

Contrastes WCAG calculés par D (seuil de 3:1 pour un élément graphique) :

| Couleur | Sur #F6F7FB | Sur #FFFFFF |
|---|---|---|
| Cobalt #2350F5 | 5,55 | 5,94 |
| Laiton #B07A22 | 3,47 | 3,71 |
| Texte #0C1428 | 17,11 | 18,32 |

| Couleur | Sur nuit #0A1024 | Sur nuit-2 #121A33 | Sur `background` sombre #070B17 | Sur `surface` sombre #0E1528 |
|---|---|---|---|---|
| #7C9BFF | 7,18 | 6,54 | 7,47 | 6,91 |
| #E2B66A | 10,01 | 9,12 | 10,41 | 9,63 |
| #EDF1FA | 16,69 | 15,20 | 17,36 | 16,05 |

Les deux dernières colonnes ont été ajoutées par le coordinateur (même formule WCAG) après la revue : le fond de page sombre de l'application est #070B17 et non la nuit #0A1024.

La valeur cobalt sur blanc (5,94) recoupe celle que j'avais calculée en phase 3.

## 4. Avis du coordinateur

**Recommandation : le concept 1 « Nuque » comme piste principale. Les concepts 2 et 3 restent des alternatives.**
- C'est le seul dont le symbole est la traduction directe du système « Dégradé » : le fondu fabrique la forme.
- Il tient de 32 à 256 px et ne doit rien à la référence.
- Il garde le cobalt comme couleur de marque, ce qui laisse le laiton à la confiance, comme prévu par le plan.

Avant toute adoption, il faudrait :
1. une version de 16 px dédiée au favicon, avec un seul trait de fondu ;
2. rééquilibrer le symbole par rapport au nom (rapport d'environ 40/17 aujourd'hui) ;
3. aplatir les `clipPath` en contours booléens, pour l'insertion en ligne et l'e-mail ;
4. produire une tuile d'icône d'application ou de PWA et un nouveau `email-logo.png`. Rien de cela n'existe encore.

Le concept 2 est le plus lisible mais le plus générique, et il souffre du risque « ampoule ». Le concept 3 est le plus « métier », mais il est faible à petite taille et il impose le laiton comme couleur de marque.

## 5. Limites

- **Le nom est vectorisé** à partir de `BricolageGrotesque-Bold.ttf` (licence OFL 1.1, fichier `BricolageGrotesque-OFL.txt` à côté), trouvé hors ligne dans `/mnt/skills/examples/canvas-design/canvas-fonts/`.
  - C'est une instance statique : son axe optique (opsz) peut différer légèrement de la police variable prévue en production.
  - Il n'y a pas de crénage automatique ; l'interlettrage est réglé à la main (−0,02 em).
  - Les SVG ne dépendent d'aucune police.
- **Identifiants `clipPath`** (concepts 1 et 2) : ils sont uniques par fichier mais pas entre deux insertions identiques dans une même page.
- **Rendu vérifié dans Chromium uniquement**, pas dans Firefox ni Safari.
- **Pas fait** : version 16 px dédiée, tuile d'application, `email-logo.png`.
- **Scripts de génération** copiés dans `docs/redesign/logo/sources/` : `gen_final.py`, `gen2.py`, `symbols.py`, `ttf.py`, `sheet.mjs`. Ils contiennent des chemins absolus propres à cette session (police dans `/mnt/skills/…`, Playwright dans `node_modules`). `symbols.py` garde des fonctions d'exploration inutilisées (`concept1` à `concept3`, remplacées par celles de `gen_final.py`). `gen2.py` porte le code commun (lecture de la police, rendu du nom) malgré son nom. Le dossier de sortie (`OUT` dans `gen2.py`) pointe vers le dossier du script : relancés depuis `sources/`, les scripts écriraient dans `sources/` et non dans `logo/`. Ce sont des outils de documentation, pas du code applicatif.
- **Recherche d'antériorité** : aucune recherche de marques déposées (registre IPI/EUIPO) n'a été faite. Elle est indispensable avant tout dépôt.

## 6. Questions ouvertes pour le propriétaire

1. Quel concept retenir ? Ma recommandation est le n°1.
2. Un monogramme B convient-il, alors que le nom commence par F ?
3. Le laiton peut-il devenir une couleur de marque (concept 3), ou reste-t-il réservé à la confiance ?
4. Faut-il une tuile d'icône (application, PWA, e-mail) ? Si oui, laquelle, sans rappeler le carré provisoire ?
5. Faut-il une version favicon dédiée à 16 px ?
6. Faut-il valider l'instance Bricolage utilisée, ou revectoriser le nom depuis la police finale ?
