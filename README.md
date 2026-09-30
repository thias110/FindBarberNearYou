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
- `GET  /api/barber/status` — garde de rôle BARBER (placeholder)

Erreurs normalisées : `{ "error": { "code": "...", "message": "..." } }`.
