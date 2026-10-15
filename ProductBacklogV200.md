# Product Backlog V 2.0.0

Synthèse de l'évaluation de la V 1.0.0 (voir `ProductBacklogV100.md`), regroupée par thème.
Priorité : **P1** = indispensable pour la V2, **P2** = important, **P3** = bonus.

---

## 1. Identité visuelle & thème

| # | Point | Prio |
|---|-------|------|
| 1.1 | Refonte du thème : l'interface fait « vieille » et ne se démarque pas de la concurrence. Nouvelle palette, typo, composants plus modernes. | P1 |
| 1.2 | Le thème suit le mode du navigateur par défaut (comportement actuel, à garder). | — |
| 1.3 | Retirer le sélecteur de thème (système / clair / sombre) du header et le déplacer dans **Paramètres**. | P2 |
| 1.4 | Footer avec liens réseaux sociaux (Instagram…), contact, mentions légales. | P2 |

## 2. Recherche & carte

| # | Point | Prio |
|---|-------|------|
| 2.1 | Carte plein écran façon Google Maps pendant la recherche, coiffeurs affichés directement dessus. | P1 |
| 2.2 | Pas de filtre « pays » : on se déplace sur la carte pour voir les coiffeurs d'autres pays. | P1 |
| 2.3 | Remplacer les filtres inutiles par des filtres « intelligents » : prix, distance, note/avis. Peu nombreux, rapides à utiliser. | P1 |
| 2.4 | Clic sur un marqueur : fiche coiffeur moderne (photo, note, prix, bouton réserver) au lieu de la carte actuelle sans photo. | P1 |
| 2.5 | Refonte des cartes « Barbers à découvrir » de la page d'accueil (voir détail ci-dessous). | P1 |
| 2.6 | Arrivée directe sur la page Recherche : comportement actuel OK, à garder. | — |

## 3. Profil coiffeur (barber)

| # | Point | Prio |
|---|-------|------|
| 3.1 | Onboarding par étapes (checklist / barre de progression) pour finaliser le profil, moins pénible qu'un gros formulaire. | P1 |
| 3.2 | Photo de profil **obligatoire** pour le coiffeur (fait partie des étapes). | P1 |
| 3.3 | Supprimer la saisie manuelle latitude / longitude : la position doit venir de l'adresse (autocomplétion + géocodage) ou d'un clic sur la carte. | P1 |
| 3.4 | Statistiques coiffeur parfois coupées (affichage à corriger, surtout mobile). | P1 |
| 3.5 | « Prestations populaires » calculées automatiquement (à partir des réservations) au lieu d'être choisies à la main. | P2 |

## 4. Validation admin & certification

| # | Point | Prio |
|---|-------|------|
| 4.1 | Un profil coiffeur créé n'est **pas en ligne** tant que l'admin ne l'a pas approuvé. | P1 |
| 4.2 | Badge « Certifié » attribué par l'admin (demande depuis l'espace coiffeur → validation admin). | P2 |

## 5. Compte utilisateur & paramètres

| # | Point | Prio |
|---|-------|------|
| 5.1 | Photo de profil pour l'utilisateur client (facultative). Aujourd'hui impossible de changer de photo. | P2 |
| 5.2 | Page dédiée **Paramètres** (thème, langue, pays, devise, notifications). | P1 |
| 5.3 | Pays / devise / langue choisis une fois à la création du compte, puis modifiables dans Paramètres. | P1 |
| 5.4 | Page « Mon compte » : remplacer le bouton « Transférer mes données » mis en avant par un accès aux Paramètres. L'export RGPD reste disponible mais plus discret (dans Paramètres > Confidentialité). | P2 |
| 5.5 | Modifier ses infos sans devoir remonter tout en haut de la page (édition en place, sections ancrées ou sous-pages). | P1 |

## 6. Langues

| # | Point | Prio |
|---|-------|------|
| 6.1 | Application multilingue (i18n), au minimum FR / EN. | P1 |
| 6.2 | Sélecteur de langue accessible rapidement (header) en plus des Paramètres. | P3 |

## 7. Expérience utilisateur générale

| # | Point | Prio |
|---|-------|------|
| 7.1 | Messages d'erreur affichés près du champ / de l'action concernée (ou en toast), plus en haut de page qui force à remonter. | P1 |
| 7.2 | Objectif global : passer d'une UX « suffisante » à une UX 10/10 (fluidité, moins d'étapes, retours visuels). | P1 |
| 7.3 | Pouvoir contacter le support en cas de problème (page Contact / formulaire / email). | P1 |
| 7.4 | Boule orange de l'accueil : supprimer le décor qui prête à confusion, rendre l'avatar cliquable (voir note ci-dessous). | P2 |

---

## Détail 2.5 : cartes coiffeur de la page d'accueil

**Aujourd'hui** (`client/src/components/home/BarberPreviewCard.tsx`), chaque carte affiche seulement :
nom · ville, pays · « X services actifs » · jusqu'à 3 badges techniques · bouton « Voir le profil ».
Pas de photo, pas de note, pas de prix : toutes les cartes se ressemblent, rien ne donne envie de cliquer.

**V2 souhaitée** (style Airbnb / Booksy / Planity) :
- Grande photo en haut de la carte (photo de profil obligatoire, cf. 3.2, ou 1re photo de la galerie).
- Note moyenne ★ + nombre d'avis.
- Prix « à partir de X € ».
- Distance si l'utilisateur a partagé sa position.
- Badge « Certifié » (4.2) et « À domicile » / « En salon ».
- 1 ou 2 prestations populaires au lieu des badges techniques.
- Toute la carte cliquable (plus besoin du bouton « Voir le profil »).
- Retirer « X services actifs » (info peu utile) et le pays (inutile, cf. 2.2).
- Affichage en carrousel horizontal (swipe sur mobile) plutôt qu'une grille.

**À savoir** : la liste publique du serveur exclut volontairement la photo, les avis et le prix (`PublicBarberSearchItem`). Il faudra donc d'abord élargir ce que l'API renvoie.

## Note : la « boule orange » de la page d'accueil

Dans le bloc d'accueil (`client/src/components/home/HomeHero.tsx`) :
- **Grande boule orange pâle en haut à droite** : pur décor, sans fonction ni clic. Elle sert à « habiller » la carte. Les mêmes boules existent sur les pages connexion / inscription (`AuthBrandPanel.tsx`).
- **Petite boule orange avec une lettre** à côté de « Bonjour, Prénom. » : c'est l'**avatar par défaut** (initiale du prénom) quand l'utilisateur n'a pas de photo. Comme on ne peut pas encore changer sa photo (voir 5.1), on voit toujours la lettre.
- **Texte** : « Trouvez votre barber, au bon moment. / Réservez en quelques instants, au salon ou à domicile. » + champ Ville + bouton Rechercher.

Pourquoi c'est confus, et pistes pour la V2 :
- La boule décorative ressemble à un élément cliquable ou à une notification alors qu'elle ne fait rien → la supprimer ou la remplacer par un vrai visuel (photo de salon, illustration) dans la refonte du thème (1.1).
- La boule avec l'initiale doit devenir cliquable (→ Mon compte / changer de photo) et afficher la photo dès que l'upload utilisateur existe (5.1).
- Le bloc fait doublon avec la page Recherche : avec la carte plein écran (2.1), il peut se réduire à une barre de recherche posée sur la carte.
