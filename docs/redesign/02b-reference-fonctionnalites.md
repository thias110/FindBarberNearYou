# 02b — Reverse engineering fonctionnel de la référence (fady-app.com)

Rédigé par le sous-agent C2 (skill domain-modeling), puis relu et contrôlé par le coordinateur.

- **Visite** : 16/10/2026, avec Chromium piloté par Playwright, en 1440×900 et 390×844.
- **Preuves brutes** : `/tmp/claude-0/-home-user-FindBarberNearYou/aa8f60d5-9b33-5a35-b062-5fcb4207902e/scratchpad/c2/out/`. Ce dossier est temporaire et ne fait pas partie du dépôt.
- **Contrôle du coordinateur** :
  - la capture `D4-resa-creneau.png` montre bien le formulaire invité (Prénom, Nom, Email, Téléphone, « Déjà un compte ? Se connecter »), le récapitulatif et « Confirmer la réservation » ;
  - `tarifs-matrix.txt` reproduit bien la matrice Free/Pro citée plus bas.
- **Données personnelles** : les noms et adresses des professionnels réels visibles sur les captures ne sont **pas** repris ici. Les pages sont désignées par leur type.

## Constats

### 0. Pages visitées (15)

| URL | Type de page | Accessible | Remarques |
|---|---|---|---|
| `/` | Accueil (vitrine) | oui | Recherche par ville avec bascule salon/domicile, sélection de pros, « comment ça marche », avis, comparatif avec des concurrents, FAQ |
| `/coiffeurs` | Liste de résultats | oui | HTTP 502 au premier essai, 200 au second. Affiche « 117 coiffeurs trouvés » |
| `/coiffeurs/annuaire` | Annuaire SEO par ville | oui | « 702 professionnels », groupés par ville |
| `/barber/<ville>` | Page ville SEO | oui | Liste de pros et carte Leaflet/CARTO avec étiquettes de prix |
| `/barber-a-domicile/<ville>` | Page ville SEO « domicile » | oui | Même gabarit |
| `/coiffeurs/<pro>` | Fiche prestataire (vitrine SEO) | oui | À propos, prestations, galerie, carte et itinéraire, horaires, appel à télécharger l'app |
| `/<pro>` | Fiche prestataire (web app) | oui | Barre latérale de l'app, prestations « Choisir », note et avis, horaires datés, partage et favori |
| `/dashboard/carte?lat=…&lng=…&mode=salon` | Carte + liste (web app) | oui (avec paramètres) | Sans paramètres : squelette de chargement qui ne se termine pas |
| (surcouche de la carte, URL inchangée) | Parcours de réservation | oui, **arrêt avant « Confirmer »** | Choix de la prestation → date et heure → informations et récapitulatif |
| `/login` | Connexion / inscription client | oui (affichage seulement) | Google, Apple, création de compte, lien vers l'espace pro |
| `/pro` | Devenir partenaire | oui | Promesses, prix de 17,90 €/mois, captures de l'app pro, FAQ pro |
| `/tarifs` | Tarifs | oui | Comparatif Free / Pro et 2 options payantes |
| `/ressources` | Aide et ressources | oui | Contact, docs, alternatives, lexique, 5 calculateurs |
| `/contact` | Contact (aucune page « à propos » n'existe) | oui, **formulaire non soumis** | Formulaire, email, WhatsApp, réseaux sociaux |
| `/page-qui-n-existe-pas-xyz` | 404 | oui (HTTP 404) | Toute URL de premier niveau est interprétée comme l'identifiant d'un pro |

**Plan du site** (`sitemap.xml`) : 893 URL, dont :
- 703 fiches `/coiffeurs/*` et 50 `/coiffeur/*` ;
- 50 `/barber/*` et 50 `/barber-a-domicile/*` ;
- 15 `/docs/*` ;
- 5 `/outils/*`.

### 1. Fonctionnalités observées et comparaison avec FindBarber

**Légende :**
- **O** : observé dans l'interface ;
- **A** : seulement annoncé dans le texte.

Pour la colonne FindBarber, les preuves sont relevées dans le code.

| # | Fonctionnalité de la référence | Page | Pour qui | O / A | Preuve (référence) | FindBarber | Preuve (FindBarber) |
|---|---|---|---|---|---|---|---|
| F1 | Recherche ville/adresse avec **suggestions de géocodage**, puis redirection vers la carte (`lat`, `lng`, `mode`) | Accueil | Client | O | `interact.log` (3 suggestions pour « Bordeaux »), `A1-home-suggest.png` | existe en moins bien : recherche texte, ville ou zone, mais aucune suggestion côté client (l'autocomplétion est réservée au barber) | `shared/src/validation/barber.ts:316-355`, `server/src/modules/barber/routes.ts:79-80` |
| F2 | Bascule « En salon / À domicile » avant la recherche | Accueil, carte | Client | O | `01-home.json`, `C1-filtres.png` | existe (filtre `place`, 3 valeurs) | `validation/barber.ts:336`, `constants.ts:123-129` |
| F3 | Carte et liste synchronisées, avec sur chaque fiche : prix sur l'épingle, distance, « Ouvert aujourd'hui », **bandeau des 7 prochains jours avec points de disponibilité**, 3 prestations avec prix, bouton Réserver | Carte | Client | O | `B1-carte-lemans.png` / `.txt` | existe en moins bien : carte, distance et prix « à partir de », mais **aucune disponibilité ni liste de prestations dans les résultats** | `BarbersSearchPage.tsx:46,544`, `BarberResultCard.tsx:18,61,64`, `shared/src/types.ts:121-139` |
| F4 | Filtres : lieu, **disponibilité (date/heure)**, distance max (curseur), note minimale | Carte | Client | O | `C1-filtres.png` | existe en moins bien : note, prix et rayon, mais **pas de filtre de disponibilité** | `validation/barber.ts:346-354` |
| F5 | Géolocalisation et « Choisir une ville » | App | Client | O | `12-fiche-<pro>.json` (slug du pro anonymisé) | existe | `client/src/lib/visitorPosition.ts:38-45` |
| F6 | Catégories en puces et « tendances » de style | App | Client | O | `12-fiche-<pro>.json` (slug du pro anonymisé) | existe (techniques, publics, techniques populaires) | `constants.ts:73-88`, `publicRoutes.ts:46-52` |
| F7 | Badges de carte « Nouveau », « Paiement par carte accepté », « **Dispo maintenant** » | Carte, liste | Client, et visibilité pour le pro | O | `B1-carte-lemans.txt`, `02-coiffeurs.json` | n'existe pas (seul le badge « Certifié » existe) | `types.ts:59`, `schema.ts:192-194` |
| F8 | Fiche vitrine : note, ville, lieu, à propos, prestations (durée, lieu), galerie, carte, **lien Itinéraire**, **horaires de la semaine** | Fiche SEO | Client, SEO du pro | O | `05-fiche.json` (lien `google.com/maps/dir/?api=1&destination=…`) | existe en moins bien : **horaires non publics**, pas de lien itinéraire | `BarberProfilePage.tsx:12-16,171`, `types.ts:43-61` |
| F9 | Fiche dans l'app : **partager**, **favori**, note globale avec les 3 derniers avis datés, « Tout voir », horaires datés | Fiche app | Client | O | `12-crop.png` | avis : existe ; **favoris et partage : n'existent pas** | `publicRoutes.ts:69-79` ; aucun résultat pour `favori|favorite` |
| F10 | Réservation, étape 1 : prestations en onglets, résumé latéral, « Continuer » désactivé tant que rien n'est choisi, **barre de progression en 2 segments** | Surcouche de la carte | Client | O | `D1-resa-step1.png` | existe sous une autre forme : formulaire d'un seul bloc | `client/src/components/BookingForm.tsx` |
| F11 | « + Ajouter une coupe » : **plusieurs prestations dans une même réservation** | Réservation | Client | O (bouton vu, non cliqué) | `D3-resa-jour.png` | n'existe pas : une seule prestation par réservation | `shared/src/validation/booking.ts:37`, `schema.ts:460` |
| F12 | Étape 2 : **grille sur 7 jours** avec navigation, créneaux de la durée de la prestation, message « aucun créneau cette semaine » | Réservation | Client | O | `D3-resa-jour.png` | existe en moins bien : champ date natif puis créneaux du jour choisi, sans vue sur la semaine | `BookingForm.tsx:280-338,412-438` |
| F13 | **Réservation sans compte (invité)** : prénom, nom, email, téléphone, récapitulatif (adresse, itinéraire, date, prestations, total), **code de réduction**, « Confirmer » | Réservation | Client (moins de friction) | O, **arrêt avant confirmation** | `D4-resa-creneau.png` (vérifiée par le coordinateur) | n'existe pas : un compte CLIENT vérifié est obligatoire | `server/src/modules/booking/routes.ts:24-28` |
| F14 | Compte créé automatiquement lors de la réservation | Fenêtre « Vos réservations » | Client | O (texte de l'interface, non vérifié) | `15-app-reservations-desktop.png` | n'existe pas | voir F13 |
| F15 | Code promo et offres de réduction | Récapitulatif, tarifs | Client, pro Pro | O (champ) / A | `interact4.log`, `tarifs-matrix.txt` | n'existe pas | aucun résultat pour `promo|coupon|discount` |
| F16 | Connexion avec Google et Apple, lien séparé vers l'espace pro | `/login` | Client | O (boutons non cliqués) | `09-login.json` | existe en moins bien : email et mot de passe seulement | `auth/routes.ts:36-58`, `RegisterPage.tsx:25-29` |
| F17 | Espace client : Réservations, **Messages**, **Favoris**, Mes commandes, Paramètres. Sur mobile, barre d'onglets en bas (Accueil, Carte, Recherche, Réservations, Profil) | App | Client | O (menu) ; contenu accessible seulement avec un compte | `15-app-reservations-desktop.png`, `11-carte-mobile-lemans.png` | réservations : existe ; messages, favoris et commandes : n'existent pas ; **pas de barre d'onglets mobile** | `router.tsx:86-93`, `notification/routes.ts:17-53` |
| F18 | **Pages SEO par ville** (3 gabarits × 50 villes) et annuaire | `/barber/*`, `/coiffeur/*`, `/barber-a-domicile/*`, `/coiffeurs/annuaire` | Acquisition, pro | O | `urls.txt` | n'existe pas : application monopage, pas de route par ville ni de sitemap | `router.tsx:62-66,215` ; `client/public` |
| F19 | **Vraie page 404** (HTTP 404) avec retour à l'accueil | URL inconnue | Client | O | `08-404.json` | existe en moins bien : redirection silencieuse vers `/` | `router.tsx:215` |
| F20 | **FAQ en accordéon** (client et pro) | Accueil, fiches, villes, `/pro`, `/tarifs` | Client et pro | O | `faq-home.json`, `faq-pro.json` | n'existe pas | `router.tsx` |
| F21 | Formulaire de contact, WhatsApp, réseaux sociaux | `/contact` | Client et pro | O (formulaire non soumis) | `13-contact.json` | existe en moins bien : email et réseaux configurables, pas de formulaire | `server/src/modules/site/routes.ts:9-33` |
| F22 | Sélecteur de langue | Pied de page | Client et pro | O | `01-home.json` | existe (fr, en, it, es) | `constants.ts:5`, `LanguageSelect.tsx` |
| F23 | Ressources pro : 15 guides, lexique, 5 calculateurs (rentabilité, cotisations, coût des rendez-vous manqués…) | `/ressources`, `/docs/*`, `/outils/*` | Pro (acquisition) | O (intitulés), calculateurs non ouverts | `10-ressources.json` | n'existe pas | — |
| F24 | Applications iOS et Android | Accueil, pied de page | Client | O (liens vers les stores) | `01-home.json` | n'existe pas (web seulement) | — |
| F25 | Comparatif avec des concurrents | Accueil | Acquisition | A | `01-home.json` | n'existe pas | — |

### 2. Offres pro et promesses

**Offres** (`/tarifs`, tout est « annoncé » : l'espace pro est hébergé sur un autre domaine, non visité) :

- **FREE, 0 €**
  - Inclus : réservation 24/7, page publique, présence sur la carte.
  - Commission de 6 € par « nouveau client ».
  - Absents : confirmation automatique, paiement par carte, protection contre les absences (*no-show*), promos.
- **PRO, 17,90 €/mois**
  - Tout le Free, plus : confirmation automatique, tarification intelligente, offres et promos, aucune commission.
  - Paiement par carte et protection contre les absences : « sur activation de l'encaissement ».
- **Frais de paiement en ligne** (les deux offres) : 1,6 % + 0,35 €.
- **Fonctionnalités cochées dans les deux offres** :
  - agenda, créneaux et indisponibilités ;
  - « Disponible maintenant » ;
  - durées personnalisées ;
  - **domicile avec frais de déplacement calculés** ;
  - gestion des rendez-vous (accepter, terminer, absence, annuler) ;
  - confirmations et rappels ;
  - **messagerie client ↔ coiffeur** ;
  - notifications ;
  - galerie photos et **vidéos** ;
  - statistiques, avis, diplôme, badge.
- **Options payantes** :
  - Fidélité : carte à points, 11,90 €/mois ;
  - « Certifié » : badge et meilleur classement dans la recherche, 6,90 €/mois.

**Promesses OBSERVÉES dans l'interface** :
- réservation en ligne jusqu'au récapitulatif ;
- domicile (filtre, badge, pages dédiées) ;
- disponibilités sur 7 jours et vrais créneaux ;
- avis datés ;
- réservation en invité et code promo ;
- filtres de distance et de note ;
- lien Itinéraire ;
- mention « Paiement par carte accepté ».

**Promesses ANNONCÉES seulement, sans preuve dans l'interface** :
- rappels envoyés à la place du pro ;
- messagerie ;
- repérage des clients fidèles ;
- Tap to Pay, QR code, lien de paiement ;
- virements le lundi ;
- protection contre les absences ;
- rendez-vous récurrents ;
- statistiques et reçus ;
- annulation selon les conditions du coiffeur ;
- confirmation immédiate ou manuelle ;
- frais de déplacement calculés par zone ;
- validation de la vitrine avant publication (environ 20 minutes) ;
- profils « vérifiés » et « diplômés » ;
- chiffres annoncés : « +10 000 coupes », « 1 500+ coiffeurs », « 4,9/5 ».

**Incohérences observées sur la référence** :
- l'accueil affiche « 0,0 sur +2 400 avis » ;
- « 1 500+ coiffeurs » annoncés, contre 702 dans l'annuaire et 117 dans `/coiffeurs` ;
- beaucoup de fiches affichent « 0.0 (0 avis) » ;
- des prestations sont affichées « Gratuit » ou « dès 0 € ». Hypothèse : un prix à 0 ou absent est affiché comme « gratuit ».

**Comparaison des promesses avec FindBarber** :

| Promesse de la référence | Statut FindBarber | Détail / preuve |
|---|---|---|
| Paiement en ligne | Existe sous une autre forme | Stripe Connect, sur place / acompte / total (`constants.ts:203-209`, `payments/routes.ts:43-61`). Pas de Tap to Pay ni de QR code. |
| Rappels | Existe | Rappel J-1 par email (`constants.ts:188`) et notifications dans l'app. |
| Accepter, refuser, terminer, annuler | Existe | `booking/routes.ts:66-149`. |
| Confirmation automatique | **N'existe pas** | Toute réservation démarre en PENDING (`booking/service.ts:516`). |
| Marquer une absence (*no-show*) | **N'existe pas** | Le statut existe, mais aucune transition n'y mène. |
| Domicile | Existe en moins bien | Rayon et adresse gérés, **mais pas de frais de déplacement** (aucun résultat pour `travelFee`). |
| Statistiques pro | Existe | — |
| Galerie | Existe | Photos seulement. |
| Messagerie, fidélité, promos | **N'existent pas** | Ni table ni route. |
| Formules d'abonnement pro, commission « nouveau client » | **N'existent pas** | Ni table ni route. Seul `platformFeeMinor` existe, au niveau de la réservation. |
| Avis vérifiés | Existe | Un avis est forcément lié à une réservation terminée. |
| Validation de la vitrine avant publication | Existe | Approbation par l'admin. |
| Badge « Certifié » | Existe, **concept différent** | Chez FindBarber, il est attribué par l'admin ; chez la référence, c'est une option payante. |
| Export et suppression des données (RGPD) | Existe chez FindBarber | Non observé chez la référence. |

### 3. Vocabulaire et scénarios limites (domain-modeling)

- **Coiffeur / barber / barbier / pro / salon** : la référence utilise ces mots comme synonymes (sa 404 dit « Coiffeur introuvable » puis « Barbier non trouvé »). Son API distingue `hairdressers` et `public_salons`, avec des `public_salon_members`.
  - À trancher pour FindBarber : un **Salon** à plusieurs membres est-il une entité distincte du **Professionnel** ?
- **Lieu de prestation** : la référence en a 2 (salon, domicile), FindBarber en a 3 (SALON, AT_PROVIDER, AT_CLIENT).
  - Scénario : un pro qui reçoit chez lui. Comment l'afficher avec une bascule à 2 boutons ?
- **Confirmation** : automatique (offre Pro) ou manuelle (Free) chez la référence ; tout commence en PENDING chez FindBarber.
  - Scénario : un invité réserve chez un pro qui ne répond pas. FindBarber fait expirer la demande ; la référence n'affiche aucun état d'expiration.
- **Client invité** : la référence crée un compte à partir de l'email.
  - Scénario : l'email saisi appartient déjà à un compte BARBER. Comportement non observable.
- **« Nouveau client »** (commission de 6 €) : la référence ne définit pas si c'est nouveau pour le pro ou nouveau sur la plateforme.
- **« Gratuit »** : la référence semble confondre une prestation à 0 € et un prix non renseigné (hypothèse).

## Preuves

- **Scripts** : `/tmp/claude-0/-home-user-FindBarberNearYou/aa8f60d5-9b33-5a35-b062-5fcb4207902e/scratchpad/c2/crawl.mjs`, `interact.mjs` à `interact5.mjs`, `tarifs.mjs`.
- **Sorties** (72 fichiers dans `…/scratchpad/c2/out/`) :
  - pour chaque page : `NN-*.json`, `NN-*-desktop.png`, `NN-*-mobile.png` ;
  - recherche et carte : `A1-home-suggest.png`, `A2-search-result.png`, `B1-carte-lemans.png/.txt`, `C1-filtres.png`, `11-carte-mobile-lemans.png` ;
  - réservation : `D1-resa-step1.png`, `D1b-service-choisi.png`, `D2-resa-step2.png`, `D3-resa-jour.png`, `D4-resa-creneau.png` ;
  - autres : `15-app-reservations-desktop.png`, `faq-home.json`, `faq-pro.json`, `tarifs-matrix.txt`.
- **Plan du site** : `…/scratchpad/c2/sitemap.xml`, `urls.txt`.
- **Technologies observées dans les requêtes réseau** :
  - Next.js (`?_rsc=`) ;
  - Supabase REST (`hairdressers`, `public_salons`, `public_salon_members`) ;
  - Mapbox GL et géocodage Mapbox dans l'app ; Leaflet avec OpenStreetMap/CARTO sur les pages ville ;
  - `POST /api/ads/clic` à chaque page.
- **FindBarber** (lecture seule) :
  - `client/src/app/router.tsx`, `server/src/app.ts:175-183`, `server/src/modules/*/routes.ts` ;
  - `shared/src/{schema,constants,types}.ts`, `shared/src/validation/{barber,booking}.ts` ;
  - les composants cités dans le tableau.

## Limites

- **Rien n'a été soumis** : pas de « Confirmer la réservation », pas de formulaire de contact, aucun clic sur Google, Apple ou « Créer un compte », aucun clic sur « Accepter » dans la bannière cookies. Celle-ci a été masquée dans le DOM sur certaines captures et reste visible sur A2, C1 et 15.
- **Après la confirmation** : le paiement, l'email et la création du compte n'ont pas été observés.
- **Non visités**, pour rester à 15 pages :
  - l'espace pro (autre domaine) ;
  - `/fidelite`, `/certification` ;
  - les docs et les calculateurs, `/alternatives` ;
  - `/application`, `/user/*` et les pages légales.

  Tout ce qui concerne l'agenda pro, la messagerie, la fidélité et les virements reste donc **annoncé**, pas observé.
- **`robots.txt` contient `Disallow: /dashboard`.** Quelques pages `/dashboard/carte` ont été consultées comme le ferait un utilisateur qui suit la recherche de l'accueil, sans robot d'indexation. Le coordinateur le signale : ces pages ne doivent pas être visitées à nouveau sans ton accord.
- **Comportements non expliqués** :
  - `/dashboard/carte` sans paramètres ne finit jamais de charger ;
  - avec Bordeaux centre, la carte affiche « 0 coiffeur » (cause non recherchée) ;
  - `/coiffeurs` a renvoyé une fois une erreur 502.
- **Menus déroulants** « Clients ▾ » et « Coiffeurs ▾ » de l'en-tête : non ouverts par C2.
- Le skill demande d'écrire `GLOSSARY.md` et des ADR : ignoré, la mission l'interdit.

## Questions ouvertes

1. Faut-il autoriser la **réservation en invité** ? Cela touche `booking/routes.ts:24-28` et la vérification d'email.
2. Faut-il afficher « **Disponible maintenant** » et des **disponibilités sur 7 jours** dans les résultats ? Il faudrait ajouter un agrégat de créneaux à la recherche.
3. Faut-il rendre les **horaires publics** sur la fiche ?
4. Badge « Certifié » : on garde l'attribution par l'admin ? Le même mot recouvre deux concepts différents.
5. La réservation de **plusieurs prestations** fait-elle partie du périmètre ? Elle change le modèle `bookings.serviceId`.
6. **Pages SEO par ville** : est-ce un objectif de la refonte ? L'application est monopage et n'a ni rendu serveur ni sitemap.
7. **Page 404** : vraie page 404, ou garder la redirection actuelle ?
8. **Favoris, messagerie, code promo, fidélité** : lesquels répondent à un vrai besoin ?

**Skills** : C2 a lu domain-modeling et l'a appliqué partiellement. Vocabulaire, scénarios limites et comparaison avec le code : faits. GLOSSARY et ADR : non écrits, c'est interdit dans cette mission.
