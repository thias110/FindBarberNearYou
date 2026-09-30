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
- `GET  /api/barbers` — recherche publique (voir ci-dessous)
- `GET  /api/barbers/:barberId` — profil public + services actifs (public, `barberId` = `barber_profiles.id`)

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
| `page` | numéro de page | entier ≥ 1, max 10 000 (défaut 1) |
| `pageSize` | taille de page | entier 1..50 (défaut 12) |

Règles : paramètres inconnus ou répétés rejetés (400 `VALIDATION_ERROR`) ; chaînes vides
trimmées ignorées (sauf pagination vide, rejetée) ; `%` et `_` traités comme littéraux ;
filtres combinés en AND ; public et technique doivent correspondre au **même** service actif ;
seuls les profils ACTIVE + BARBER sont exposés ; tri stable `lower(display_name), id` ;
réponse paginée (`barbers`, `pagination.{page,pageSize,total,totalPages}`) avec whitelist
publique (id profil, nom, ville, pays, coordonnées `latitude`/`longitude` du commerce,
nb services actifs, tags agrégés). Les coordonnées exposées sont celles déjà publiques
sur le profil détaillé.

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
