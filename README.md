# FindBarberNearYou

Trouver un barbier à côté de toi — marketplace géolocalisée de coiffeurs/barbiers.

Stack : React 18 + Vite + Tailwind (client), Express 5 + TypeScript + Zod (serveur),
Drizzle ORM, PostgreSQL en production / PGlite en local et en test, JWT dans un cookie
HttpOnly, bcryptjs (coût 12, limite 72 octets), protection CSRF sur les mutations
authentifiées, rate limiting sur `login`/`register`.

## Prérequis

- Node.js `>= 20.11` (Node 24 testé)
- npm

## Installation

```bash
npm install
cp .env.example .env
# puis renseigner JWT_SECRET (>= 32 caractères) dans .env
```

## Variables d'environnement

Voir `.env.example`. Aucun secret réel ne doit être commité ; `.env` est ignoré par git.

## Base de données

Le pilote est sélectionné automatiquement et de façon centralisée dans
`server/src/db/client.ts` :

- **développement / tests** : PGlite (persistance dans `PGLITE_DATA_DIR`, in-memory si vide) ;
- **production** (`NODE_ENV=production`) : PostgreSQL via `DATABASE_URL`
  (drizzle-orm/node-postgres + `pg`). Le démarrage échoue avec une erreur claire si
  `DATABASE_URL` est absent en production.

Générer les migrations (après toute modification de `shared/src/schema.ts`) :

```bash
npm run db:generate
```

Appliquer les migrations :

```bash
npm run db:migrate
```

## Développement

```bash
npm run dev
```

- Serveur API (via tsx) : http://localhost:4000
- Client Vite : http://localhost:5173

## Build de production + démarrage du serveur compilé

```bash
npm run build   # tsup (serveur -> server/dist) + vite build (client -> client/dist)
npm start       # node server/dist/index.js (aucun recours à tsx)
```

Le serveur compilé répond sur `GET /api/health`.

### Fallback SPA (profil public `/barbers/:id`)

En développement, Vite sert automatiquement `index.html` pour les routes inconnues.
En production, le serveur API (`server/dist/index.js`) n'expose que `/api/*` : il faut
servir `client/dist` et réécrire les routes non `/api` vers `index.html` pour que
l'ouverture directe ou l'actualisation de `/barbers/:barberId` fonctionne, y compris
en navigation privée. Exemple Nginx :

```nginx
location /api/ {
  proxy_pass http://localhost:4000;
}
location / {
  root /app/client/dist;
  try_files $uri /index.html;
}
```

Ne jamais réécrire les routes `/api/*` vers `index.html`.

## Créer le premier compte ADMIN

L'inscription publique refuse le rôle ADMIN (403). Le premier ADMIN se crée via une
saisie interactive (le mot de passe est masqué, jamais dans le code, jamais en
argument de commande, jamais dans `.env.example`) :

```bash
npm run create:admin
```

## Tests / vérifications

```bash
npm run typecheck   # TypeScript
npm run lint        # ESLint
npm test            # Vitest (intégration auth + permissions + redirections + rate limit)
npm run build       # build serveur (tsup) + client (vite)
npm start           # démarre le serveur compilé
```

## API (préfixe `/api`)

- `POST /api/auth/register` — inscription publique (CLIENT ou BARBER uniquement)
- `POST /api/auth/login` — connexion (définit les cookies `auth_token` et `csrf_token`)
- `POST /api/auth/logout` — déconnexion (requiert le header `X-CSRF-Token`)
- `GET  /api/auth/me` — utilisateur courant
- `GET  /api/admin/status` — garde de rôle ADMIN (placeholder)
- `GET  /api/barber/profile` — profil du BARBER connecté (404 si absent)
- `PUT  /api/barber/profile` — création/modification du profil (BARBER + CSRF)
- `GET  /api/barber/services` — services actifs/inactifs du BARBER connecté
- `POST /api/barber/services` — création d'un service (BARBER + CSRF)
- `PATCH /api/barber/services/:serviceId` — modification/désactivation d'un service (BARBER + CSRF)
- `GET  /api/barber/working-hours` — horaires hebdomadaires du BARBER connecté (404 si pas de profil)
- `PUT  /api/barber/working-hours` — remplacement complet des horaires (BARBER + CSRF)
- `GET  /api/barber/time-off` — indisponibilités (congés/fermetures) du BARBER connecté (404 si pas de profil)
- `POST /api/barber/time-off` — création d'une indisponibilité (BARBER + CSRF)
- `DELETE /api/barber/time-off/:timeOffId` — suppression d'une indisponibilité possédée (BARBER + CSRF, 404 sinon)
- `GET  /api/barbers` — recherche publique (voir ci-dessous)
- `GET  /api/barbers/:barberId` — profil public + services actifs (public, `barberId` = `barber_profiles.id`)
- `GET  /api/barbers/:barberId/slots` — créneaux disponibles (public, `barberId` = `barber_profiles.id`)
- `POST /api/bookings` — création d'une réservation (CLIENT + CSRF)
- `GET  /api/bookings` — réservations du CLIENT connecté ou du profil du BARBER connecté
- `GET  /api/bookings/:bookingId` — détail privé (adresse client) du CLIENT propriétaire, du BARBER concerné ou d'ADMIN
- `POST /api/bookings/:bookingId/confirm` — confirmation `PENDING` → `CONFIRMED` (BARBER propriétaire + CSRF)
- `POST /api/bookings/:bookingId/cancel` — annulation (CLIENT dans le délai de 2 h, ou BARBER sans délai + CSRF)

Erreurs normalisées : `{ "error": { "code": "...", "message": "..." } }`.

### Recherche publique `GET /api/barbers`

Lecture seule, accessible sans connexion. Paramètres (tous facultatifs) :

| Paramètre | Description | Bornes |
|---|---|---|
| `q` | recherche partielle insensible à la casse sur le nom affiché | ≤ 120 car. |
| `city` | recherche partielle insensible à la casse sur la ville | ≤ 100 car. |
| `countryCode` | code pays ISO 3166-1 alpha-2 | liste `shared/src/countries.ts` |
| `audience` | un public unique : `FEMME`, `HOMME`, `ENFANT` | sélection unique |
| `technique` | une prestation unique : `COUPE`, `TAPER`, `DEGRADE`, `LOCKS`, `TRESSES`, `COLORATION`, `BARBE` | sélection unique |
| `place` | un lieu de prestation : `SALON`, `AT_PROVIDER`, `AT_CLIENT` | sélection unique |
| `page` | numéro de page | entier ≥ 1, max 10 000 (défaut 1) |
| `pageSize` | taille de page | entier 1..50 (défaut 12) |

Règles : paramètres inconnus ou répétés rejetés (400 `VALIDATION_ERROR`) ; chaînes vides
trimmées ignorées (sauf pagination vide, rejetée) ; `%` et `_` traités comme littéraux ;
filtres combinés en AND ; public et technique doivent correspondre au **même** service actif ;
seuls les profils ACTIVE + BARBER sont exposés ; tri stable `lower(display_name), id` ;
réponse paginée (`barbers`, `pagination.{page,pageSize,total,totalPages}`) avec whitelist
publique (id profil, nom, ville, pays, lieux `places`, coordonnées `latitude`/`longitude`
**approximatives**, nb services actifs, tags agrégés). L'adresse exacte n'est jamais
exposée. Sans filtre `place`, les profils historiques sans lieu restent renvoyés ; avec un
filtre `place`, seuls ceux ayant ce lieu correspondent.

### Catégories de prestations

- Codes stables (majuscules) et libellés français dans `shared/src/constants.ts`
  (`AUDIENCES`, `TECHNIQUES`, `AUDIENCE_LABELS`, `TECHNIQUE_LABELS`).
- Tables de liaison `barber_service_audiences` / `barber_service_techniques` (PK composites,
  FK `ON DELETE CASCADE`), migration additive `0003_*`.
- « Mixte » n'est pas un code stocké : il se calcule (FEMME + HOMME présents).
- À la création, catégories absentes = tableaux vides. En PATCH : absent = inchangé,
  `[]` = suppression, tableau = remplacement (dans la même transaction que le service).
- Page publique `/barbers` : filtres + pagination conservés dans l'URL (précédent/suivant
  cohérents), recherche, réinitialisation, états chargement/erreur+retry/vide.

### Horaires hebdomadaires (barber)

Le barbier configure ses jours de travail sur `/pro/working-hours`. Plusieurs plages par
jour sont possibles (`lundi 09:00–12:00` et `14:00–18:00`) : les trous entre plages d'un
même jour sont des pauses implicites.

- **Représentation** : une ligne `barber_working_hours` par plage. `weekday` entier
  ISO-8601 (1 = lundi … 7 = dimanche) ; `startMinute`/`endMinute` en minutes depuis minuit
  local (0…1440). `1440` (= 24:00) n'est autorisé qu'en fin de plage, via le contrôle
  explicite « Fin de journée (24:00) » — jamais comme valeur d'un `input type="time"`.
  Aucune plage ne traverse minuit (`start < end`).
- **Heures locales au salon** : les heures restent des minutes murales, sans calcul de
  fuseau dans ce lot. Le fuseau IANA du salon est stocké sur le profil (section
  ci-dessous) et deviendra obligatoire avant le moteur de réservation.
- **Validation** : rejets stricts (400 `VALIDATION_ERROR`) — jour hors 1..7, minutes hors
  bornes, début ≥ fin, doublons, chevauchements (plages adjacentes autorisées), plus de
  `6` plages par jour ou `42` au total, champs inconnus interdits. Contraintes `CHECK` +
  index unique `(profile, weekday, start)` en base comme filet.
- **Enregistrement atomique** : `PUT` = remplacement complet de la semaine. Le profil
  propriétaire est résolu et verrouillé (`SELECT … FOR UPDATE`) **dans** la transaction,
  avant `DELETE` + `INSERT` : deux PUT simultanés du même barbier sont sérialisés, y
  compris sur un planning vide (l'ancre du verrou est la ligne du profil).
  Suppression = `PUT { "intervals": [] }`.
- Réservations : non implémentées dans ce lot. Le moteur de créneaux futur lira cette
  table et le fuseau IANA du salon (déjà stocké sur le profil).

### Fuseau horaire du salon (barber)

- **Stockage** : `barber_profiles.timezone` (`text`), nullable, sans valeur par défaut ni
  backfill ; `CHECK (timezone IS NULL OR char_length(timezone) <= 64)`. Les profils
  existants restent `NULL` : aucun fuseau inventé. Migration additive `0005_*`.
- **Choix explicite** : sélecteur groupé par région sur `/pro/profile` (identifiants IANA
  canoniques + `UTC`), jamais déduit du pays ni du navigateur. Sans
  `Intl.supportedValuesOf`, repli sur un champ texte avec validation serveur. Une valeur
  stockée absente de la liste locale (drift d'ICU) est conservée comme option
  « valeur enregistrée ».
- **API** : `GET`/`PUT /api/barber/profile` exposent `timezone: string | null`.
  `PUT` : champ absent = valeur existante conservée (aucun effacement accidentel) ;
  `null` ou chaîne vide (après trim) = effacement explicite ; valeur non vide invalide =
  `400 VALIDATION_ERROR` sans écriture partielle.
- **Validation** : `UTC` accepté (casse insensible) ; sinon identifiant nommé contenant
  `/`, validé par `Intl.DateTimeFormat` ; offsets (`+01:00`) et abréviations seules
  (`CET`) refusés ; `Etc/…` refusé sans distinction de casse (restriction produit : zones
  à offset fixe, jamais présentées comme des identifiants invalides) ; la casse est
  corrigée si la valeur correspond à la liste canonique, un alias reconnu est conservé tel
  quel (jamais de conversion via `resolvedOptions().timeZone`).
- **Pas d'exposition publique** dans ce lot : le fuseau est un champ privé du barbier
  (absent du profil public et de la recherche).
- **Avant de réserver** (lot ultérieur) : un profil sans fuseau verra la réservation
  refusée tant que le fuseau n'est pas renseigné.

### Indisponibilités / fermetures exceptionnelles (barber)

Le professionnel gère ses indisponibilités sur `/pro/time-off`. Les libellés sont neutres
(« Mes indisponibilités », « Votre fuseau horaire », « Jours indisponibles ») : un BARBER
peut exercer chez lui, en salon ou à domicile, ses disponibilités lui appartiennent.

- **Journées entières** : une date ou une période. `startDate` / `endDate` sont des dates
  calendaires réelles au format `AAAA-MM-JJ`, **bornes incluses** ; une journée unique se
  saisit avec la même date. Une période maximale de **366 jours inclus** est acceptée (367
  refusés) ; les dates passées sont autorisées dans ce lot.
- **Stockage sans fuseau** : colonnes PostgreSQL `date` (`start_date`, `end_date`) mappées
  **explicitement en chaînes** par Drizzle (`date("…", { mode: "string" })`). Aucune
  conversion depuis le fuseau du navigateur, du serveur ou du DST : `2026-12-24` reste
  `2026-12-24`. Le fuseau du professionnel n'est appliqué que plus tard, par le futur
  moteur de créneaux.
- **Motif facultatif et privé** : trim, vide → `null`, **500 caractères maximum**. Il n'est
  jamais exposé par le profil public ni la recherche.
- **Limite** : **200 périodes** enregistrées au maximum par professionnel (historiques
  comprises), refus au-delà avec `409 TIME_OFF_LIMIT_REACHED`.
- **Doublons et chevauchements refusés** : chevauchement inclusif (`start ≤ existing.end`
  et `existing.start ≤ end`) → `409 TIME_OFF_OVERLAP`. Des périodes **adjacentes sans jour
  commun** (fin le 10, début le 11) sont autorisées. Index unique
  `(profile, start_date, end_date)` en base comme filet.
- **Création atomique** : le profil propriétaire est résolu et verrouillé
  (`SELECT … FOR UPDATE`) **dans** la transaction, avant le contrôle du plafond puis des
  chevauchements et l'insertion. Le propriétaire est déduit de l'utilisateur authentifié ;
  la suppression est filtrée par `id` **et** profil (anti-IDOR) et renvoie 404 pour une
  période inexistante ou appartenant à un autre professionnel.
- **Sans fuseau** : la création reste autorisée, avec un avertissement dans l'interface
  (« ils ne seront interprétés qu'une fois votre fuseau défini »). **Changement de
  fuseau** : les dates civiles stockées restent **inchangées**, sans conversion ni
  réécriture.
- **Pas d'édition** (ni `PATCH`, ni suppression/recréation automatique) et **pas
  d'exposition publique** dans ce lot. Aucun droit ADMIN ajouté.

### Lieux de prestation et localisation approximative (lot 8, issue #19)

Un BARBER est un professionnel, pas nécessairement un salon. Les lieux de prestation sont
cumulables **au niveau du profil** (pas par prestation dans ce lot). Horaires et
indisponibilités restent communs au professionnel, tous lieux confondus.

- **Trois modes** : `SALON` (« En salon »), `AT_PROVIDER` (« Chez le professionnel »),
  `AT_CLIENT` (« Chez le client »). Codes dans `shared/src/constants.ts`
  (`SERVICE_PLACES`, `SERVICE_PLACE_LABELS`).
- **Sélection** : `PUT /api/barber/profile` accepte `places` (au moins un mode à la
  création ou lors d'un PUT ; valeurs connues, dédupliquées, remplacement complet dans la
  même transaction que le profil). Les **profils historiques** peuvent rester sans lieu
  jusqu'à leur édition : **aucun mode ne leur est attribué automatiquement**. Sur le profil
  public, un profil historique affiche « Lieux non renseignés ».
- **Adresse privée** : `barber_profiles.address` est désormais **nullable** (relaxation
  `NOT NULL`, migration `0007_*`, valeurs historiques conservées). Adresse requise si
  `SALON` ou `AT_PROVIDER` est sélectionné, facultative pour `AT_CLIENT` seul (vide →
  `null`). **Jamais exposée** par le profil public ni la recherche ; seule la réponse
  privée du propriétaire (`GET /api/barber/profile`) la contient.
- **Zone mobile** : `travelRadiusKm` entier **1..100**, requis si et seulement si
  `AT_CLIENT` est sélectionné (`null` sinon ; le serveur rejette un rayon non nul hors
  `AT_CLIENT`). Pas de ville ni de liste de villes dans ce lot.
- **Localisation de référence** : `city`, `countryCode`, `latitude`, `longitude` restent
  requis pour tous (recherche, carte, centre de la zone).
- **Coordonnées publiques approximatives** : le serveur arrondit à deux décimales via
  `server/src/lib/location.ts` (`approximateCoordinate`) avant toute réponse publique ;
  carte et futures distances publiques utilisent cette même position. Les coordonnées
  stockées ne sont **jamais** arrondies ni réécrites, et le point privé exact n'est jamais
  exposé (y compris pour un profil `SALON` ou historique). L'interface affiche
  « Localisation approximative ». Lorsqu'une distance publique sera réellement calculée
  (aucune dans ce lot), elle devra utiliser la position approximative et être libellée
  « Distance approximative » (`APPROXIMATE_DISTANCE_LABEL`). **Cet arrondi ne garantit pas
  l'anonymat.**
- **Table de liaison** `barber_profile_places` (PK composite `(barber_profile_id, place)`,
  FK `ON DELETE CASCADE`, index sur `place`) et enum `service_place`.
- **Hors de ce lot** : choix du lieu à la réservation, adresse client privée et
  autorisations de lecture, refus hors zone côté serveur, calcul de temps de déplacement.

### Réservations de base (lot 9)

Le client choisit une prestation, une date et une heure ; le serveur recalcule et fait
autorité (jamais de confiance au frontend). Seul le statut `PENDING` est posé à la
création ; la confirmation est manuelle par le barbier (`CONFIRMED`), l'annulation est
`CANCELLED`. `COMPLETED` et `NO_SHOW` existent dans l'enum mais sans logique métier dans
ce lot.

- **Modèle** : table `bookings` (migration additive `0008_*`). `start_at`/`end_at` sont
  des instants **UTC** (`timestamptz`), calculés depuis les minutes murales locales du
  barbier et son fuseau IANA. Le lieu réutilise l'enum existant `service_place`
  (`SALON`, `AT_PROVIDER`, `AT_CLIENT`) : aucun enum `booking_place` n'est créé.
- **Snapshots figés à la création** : `barber_display_name`, `service_name`,
  `service_description` (nullable), `duration_minutes`, `price_minor`, `currency`. Ces
  valeurs ne suivent pas les éventuelles modifications ultérieures du profil ou du
  service. Les colonnes `client_*` (adresse privée du client) sont nullables et
  **renseignées uniquement pour `AT_CLIENT`** (voir ci-dessous).
- **Statuts** : enum `booking_status` complet dès maintenant — `PENDING`, `CONFIRMED`,
  `CANCELLED`, `COMPLETED`, `NO_SHOW`. Transitions câblées dans ce lot : création →
  `PENDING` ; confirmation barbier `PENDING` → `CONFIRMED` (pas d'auto-confirmation) ;
  annulation (`PENDING`/`CONFIRMED`) → `CANCELLED`. `COMPLETED`/`NO_SHOW` restent sans
  transition.
- **Délais** : réservation possible au plus tôt **30 minutes** avant le début, au plus
  tard **60 jours** à l'avance. Annulation client autorisée jusqu'à **2 heures** avant le
  début ; le barbier peut annuler sans cette limite.
- **Grille de créneaux non fixe** : pas de pas de 15 minutes. La grille suit la durée de
  la prestation (un créneau commence au début d'une plage ouverte puis toutes les
  `durationMinutes`) ; deux créneaux d'une même prestation ne se chevauchent donc jamais.
- **Créneaux publics** : `GET /api/barbers/:barberId/slots?serviceId&date&place` renvoie
  des créneaux UTC (`startAt`, `endAt`, `startMinute`). La `date` est une date civile
  dans le fuseau du professionnel. Refus `404 BARBER_NOT_FOUND` (profil inactif ou non
  BARBER), `409 BARBER_TIMEZONE_MISSING` (fuseau non renseigné), `404 SERVICE_NOT_FOUND`
  (service inactif ou étranger), `409 PLACE_NOT_OFFERED`.
- **Création** : `POST /api/bookings` (CLIENT + CSRF) avec `barberId`, `serviceId`, `date`,
  `startMinute` (0..1439), `place` et, **uniquement pour `AT_CLIENT`**, `clientAddress`.
  Le serveur revalide le créneau **sous verrou du profil** (`SELECT … FOR UPDATE`) : un
  créneau déjà pris, hors grille, hors délai/horizon, couvert par une indisponibilité ou
  hors plage ouverte est refusé `409 SLOT_UNAVAILABLE`. L'anti-double-réservation est
  applicatif (verrou transactionnel) car `btree_gist` n'est pas disponible sous PGlite ;
  aucune contrainte d'exclusion PostgreSQL dans ce lot.
- **Prestation chez le client (`AT_CLIENT`)** : `clientAddress` obligatoire (sinon
  `400 VALIDATION_ERROR`) ; pour `SALON`/`AT_PROVIDER`, toute `clientAddress` est refusée
  et rien n'est stocké. Le serveur géocode l'adresse (MapTiler, clé serveur
  `MAPTILER_GEOCODING_API_KEY`) puis refuse `409 OUT_OF_SERVICE_AREA` si la distance
  Haversine dépasse `travel_radius_km`. Zone non configurée →
  `409 BARBER_SERVICE_AREA_MISSING` ; géocodeur absent/en panne → `503
  GEOCODING_UNAVAILABLE` ; adresse introuvable → `404 ADDRESS_NOT_FOUND`. Les coordonnées
  ne sont **jamais** acceptées depuis le navigateur : seules celles du géocodeur serveur
  font foi.
- **Confirmation / annulation** : propriété vérifiée (anti-IDOR, 404 sinon). Confirmation
  refusée si le statut n'est pas `PENDING` (`409 INVALID_STATUS_TRANSITION`). Annulation
  client trop tardive → `409 CANCELLATION_TOO_LATE`. `cancelled_by` (`CLIENT`/`BARBER`) et
  `cancelled_at` sont enregistrés.
- **Lecture** : `GET /api/bookings` renvoie les réservations du CLIENT connecté, ou celles
  du profil du BARBER connecté (tri par `start_at`). `clientName` est exposé au BARBER via
  une jointure sur `users.name` (nullable). **Aucune adresse dans les listes.**
- **Détail privé** : `GET /api/bookings/:bookingId` renvoie `clientAddress`,
  `clientLatitude` et `clientLongitude` uniquement au CLIENT propriétaire, au BARBER
  concerné et à ADMIN ; tout autre rôle ou propriétaire reçoit `404` (aucune fuite
  d'existence ni d'adresse). L'adresse n'apparaît jamais dans `GET /api/barbers`,
  `GET /api/barbers/:barberId`, la recherche, la carte ni les DTO publics.
- **Hors de ce lot** : `COMPLETED`/`NO_SHOW` et temps de déplacement.

### Interface de réservation (client et barber)

- **Profil public** `/barbers/:barberId` : formulaire « Réserver » — service actif,
  lieu parmi `places`, date, créneaux chargés via `GET /api/barbers/:barberId/slots`,
  choix d'un créneau, adresse demandée **uniquement** pour `AT_CLIENT`. L'envoi exige
  un compte CLIENT (lien vers la connexion sinon). Les erreurs serveur
  (`SLOT_UNAVAILABLE`, `PLACE_NOT_OFFERED`, `OUT_OF_SERVICE_AREA`,
  `ADDRESS_NOT_FOUND`, `GEOCODING_UNAVAILABLE`, `BARBER_TIMEZONE_MISSING`,
  `VALIDATION_ERROR`) sont affichées telles quelles.
- **Client** `/appointments` (« Mes rendez-vous ») : liste des réservations (service,
  professionnel, date, lieu, statut), annulation avec confirmation, et adresse privée
  visible uniquement sur le détail d'une réservation `AT_CLIENT` via
  `GET /api/bookings/:bookingId`.
- **Barber** `/pro/bookings` (« Mes réservations ») : demandes `PENDING`, confirmation
  `PENDING` → `CONFIRMED`, annulation, nom du client, et adresse privée uniquement sur
  le détail d'une réservation `AT_CLIENT`.
- Les listes n'exposent jamais d'adresse ; seul le détail autorisé la renvoie.

## Carte (MapLibre GL JS + MapTiler)

La page `/barbers` affiche une carte limitée aux résultats de la page courante (indication
visible). Desktop : liste + carte côte à côte. Mobile : liste par défaut, bascule
Liste/Carte. La sélection est bidirectionnelle (clic liste ↔ clic marqueur) et un encart
React affiche le barbier sélectionné ; « Voir le profil » reste un lien de navigation.

- **Bibliothèque** : `maplibre-gl` (dernier stable), sans Leaflet ni `react-map-gl`.
  Le wrapper React est maison (`client/src/components/BarbersMap.tsx`), chargé en différé
  (`React.lazy`) pour ne pas gonfler le bundle initial de la recherche.
- **Fournisseur de tuiles (développement uniquement)** : MapTiler Free.
- **Fond vectoriel** : clair et désaturé, famille Dataviz (`dataviz-v4`) par défaut,
  alternative Basic (`base-v4`). Voir `.env.example` (`VITE_MAP_STYLE_ID`).

### Clé et configuration

La clé est une **clé publique** MapTiler, restreinte par origine HTTP (« Allowed HTTP
origins »). Elle n'est pas un secret ; aucun service token / token d'administration ne doit
transiter par le client. À renseigner dans `.env` (ignoré par git), jamais dans la
conversation ni dans le code.

```bash
# .env (local, jamais commité)
VITE_MAP_API_KEY=ta_cle_publique_maptiler
```

Vite charge le `.env` racine du monorepo via `envDir` (`client/vite.config.ts`). Seules
les variables préfixées `VITE_` sont exposées au navigateur ; les secrets serveur du
`.env` racine (`JWT_SECRET`, `DATABASE_URL`…) ne le sont pas.

**Sans clé** : la carte affiche un message « Carte non configurée », la liste reste
pleinement fonctionnelle, et **aucune requête n'est envoyée au fournisseur** (pas de
substitution silencieuse par une clé de démonstration ou un autre fournisseur).

### Facturation (requêtes au fournisseur, pas « sessions »)

Avec MapLibre connecté directement à MapTiler, le trafic est comptabilisé **par requête**
(chargement du style, sprites, glyphes et surtout tuiles), pas automatiquement par session.

- Déplacer ou zoomer la carte **ne déclenche aucun nouvel appel à notre API de recherche**
  (`GET /api/barbers` n'est appelé qu'au chargement de la page, à la recherche, aux filtres
  et à la pagination).
- Déplacer ou zoomer la carte **déclenche en revanche de nouvelles requêtes au fournisseur**
  pour charger les tuiles manquantes (une tuile = une requête facturée).

Il ne faut donc pas raisonner en « une visite = une session facturée » : le volume dépend
du nombre de tuiles réellement chargées. Consulter les quotas du plan effectivement utilisé
(MapTiler Free en développement) sur le compte MapTiler.

### Attribution

L'attribution est ajoutée via `AttributionControl` (MapLibre) :
« © MapTiler » + « © OpenStreetMap contributors », conforme aux CGU MapTiler (§6). Le
contrôle est compact (`compact: true`), conforme au plan gratuit.

### Robustesse

- Une erreur de tuile ponctuelle (après chargement du style) est signalée sans casser la
  carte ; une panne persistante (style jamais chargé) affiche un message + « Réessayer ».
- Les erreurs asynchrones du moteur (`map.on('error')`) et les exceptions de rendu
  (`MapErrorBoundary`) sont toutes deux gérées : l'ErrorBoundary React ne suffit pas seul.
- Redimensionnement (`ResizeObserver`), nettoyage complet (`map.remove()`) et
  `prefers-reduced-motion` (défilement de liste et animations carte) sont respectés.
- En échec sur mobile, un bouton « Revenir à la liste » reste immédiatement accessible.
