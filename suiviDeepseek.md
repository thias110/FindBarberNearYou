# Suivi — FindBarberNearYou (lot 1 : auth + rôles)

État après implémentation du lot 1 et revue finale ciblée. Aucun commit / branche / PR créé.

## Stack (validée)

- Client : React 18 + Vite + Tailwind
- Serveur : Express 5 + TypeScript + Zod
- ORM : Drizzle (schéma partagé `shared/`)
- BDD : PGlite (dev/tests) / PostgreSQL via `DATABASE_URL` (production)
- Auth : JWT dans cookie HttpOnly, bcryptjs (coût 12, limite 72 octets), CSRF, rate limiting

## Fichiers créés / modifiés

### Racine
- `package.json` (workspaces + scripts), `tsconfig.base.json`, `.gitignore`, `eslint.config.js`, `vitest.config.ts`, `package-lock.json`
- `.env.example` — modifié (`NEXT_PUBLIC_MAP_API_KEY` → `VITE_MAP_API_KEY`, ajout `NODE_ENV`, `PORT`, `CORS_ORIGIN`, `PGLITE_DATA_DIR`, `DATABASE_URL`, `JWT_EXPIRES_IN_SECONDS`, `AUTH_RATE_LIMIT_*`, `VITE_API_URL`)
- `.env` — local, ignoré par git (secret aléatoire de dev)
- `README.md` — modifié

### shared/
`package.json`, `tsconfig.json`, `src/constants.ts`, `src/types.ts`, `src/validation/auth.ts`, `src/schema.ts`, `src/index.ts`

### server/
`package.json`, `tsconfig.json`, `drizzle.config.ts`, `tsup.config.ts`,
`src/config/env.ts`, `src/lib/errors.ts`, `src/lib/cookies.ts`,
`src/db/client.ts`, `src/db/migrate.ts`,
`src/middleware/auth.ts`, `src/middleware/csrf.ts`, `src/middleware/error.ts`,
`src/modules/auth/service.ts`, `src/modules/auth/routes.ts`,
`src/modules/admin/routes.ts`, `src/modules/barber/routes.ts`,
`src/app.ts`, `src/index.ts`,
`src/scripts/migrate.ts`, `src/scripts/create-admin.ts`,
`src/types/express.d.ts`,
migration `drizzle/0000_square_vanisher.sql` + `drizzle/meta/*`

### client/
`package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`, `postcss.config.js`, `tailwind.config.js`,
`src/vite-env.d.ts`, `src/styles/index.css`, `src/main.tsx`, `src/App.tsx`,
`src/lib/apiClient.ts`, `src/app/auth-context.ts`, `src/app/AuthProvider.tsx`, `src/app/RequireRole.tsx`, `src/app/router.tsx`,
`src/pages/auth/{LoginPage,RegisterPage}.tsx`,
`src/pages/client/HomePage.tsx`, `src/pages/barber/DashboardPage.tsx`, `src/pages/admin/DashboardPage.tsx`

### tests/
`setup.ts`, `src/auth.integration.test.ts`, `src/roles.test.ts`

## Commandes exécutées

```bash
npm install
npm run db:generate
npm run db:migrate
npm run typecheck
npm run lint
npm test
npm run build
npm start            # node server/dist/index.js (compilé, sans tsx)
# + smoke tests : GET /api/health (compilé), erreurs de prod (DATABASE_URL manquant, JWT_SECRET exemple)
npm audit
npm outdated
npm ls react-router react-router-dom vite vitest drizzle-kit
```

## Résultats

| Vérification | Résultat |
|---|---|
| db:generate | ✅ aucune modification de schéma |
| db:migrate | ✅ migrations appliquées |
| typecheck | ✅ shared + server + client |
| lint | ✅ 0 erreur, 0 warning |
| tests | ✅ 26/26 (23 intégration auth + 3 redirections) |
| build | ✅ tsup `server/dist/index.js` (13.99 Ko) + vite `client/dist` |
| start | ✅ démarre le serveur compilé |
| GET /api/health (compilé) | ✅ `{"ok":true}` |
| prod DATABASE_URL manquant | ✅ erreur claire au démarrage |
| prod JWT_SECRET exemple | ✅ erreur claire au démarrage |

## Revue finale ciblée (corrections)

1. **Build prod** : `tsup` → `server/dist/index.js` ; `npm start` = `node dist/index.js` (sans tsx) ; `drizzle/` copié dans `dist/drizzle/` ; chemins `.env`/migrations robustes en dev et compilé.
2. **Base prod** : sélection centralisée du pilote (`pglite` dev/test, `postgres` prod) ; dépendance `pg` ajoutée (client node-postgres standard requis par `drizzle-orm/node-postgres`) ; erreur claire si `DATABASE_URL` absent en prod.
3. **Autorisation** : JWT = `{ sub, csrf }` uniquement ; rôle/statut lus en base à chaque requête ; 401 (token invalide/user absent) / 403 (suspendu / rôle interdit) ; tests de changement rôle+statut à effet immédiat.
4. **Mots de passe** : min 8 caractères + max 72 octets UTF-8 (via `TextEncoder`), appliqué inscription + `create:admin` ; test Unicode > 72 octets.
5. **Cookies/CSRF** : HttpOnly/SameSite=Lax/Secure(prod)/Path=//maxAge (dérivée de `JWT_EXPIRES_IN_SECONDS`) ; CSRF lisible + rotation à chaque login + comparaison `timingSafeEqual` ; `JWT_SECRET` validé au démarrage (prod : >= 32, non exemple).
6. **Rate limit** : `express-rate-limit` sur login/register ; test 429.
7. **npm** : `react-router-dom` 6 → 7.18.4 (corrige l'avis react-router) ; audit restant = 6 vuln. `moderate` dev-only (vitest, esbuild).

## Audit npm (non masqué)

- `@vitest/mocker` (vitest 3.2.7) — moderate, correctif = vitest 5 (breaking). Non appliqué.
- `esbuild <=0.24.2 || 0.27.3–0.28.0` via `@esbuild-kit` (drizzle-kit) + esbuild imbriqué de tsup — moderate, outillage de build uniquement. Non appliqué (correctif = downgrade incohérent).
- Avis `react-router` : **corrigé** (7.18.4).

## Points reportés

- Connexion PostgreSQL de production non testée de bout en bout (pas de serveur Postgres / démon Docker arrêté).
- Vulnérabilités dev-only restantes (vitest, esbuild) : pas de correctif non-cassant.
- `eslint@9` déprécié (eslint 10 existe) : conservé pour compat `typescript-eslint@8`.
- Le serveur (y compris compilé) applique les migrations au démarrage.
- Fichiers non suivis préexistants laissés tels quels : `claude/`, `genreVisuelSite/`.

## Procédure premier ADMIN

```bash
npm run create:admin
```

Saisie interactive, mot de passe masqué (jamais en clair dans le code, en argument, ni dans `.env.example`). L'inscription publique rejette ADMIN avec 403.

Terminé. La branche `feature/authent` est à jour et le commit est poussé (pas de merge dans `main`).

## Commit
- **SHA :** `ed08f26dd7256379256dedc5c14c742fa79bc26a`
- **Message :** `fix: synchronize JWT and cookie expiration`

## Modifications
- `.env.example` : `JWT_EXPIRES_IN=7d` → `JWT_EXPIRES_IN_SECONDS=604800` avec commentaire.
- `.env` local : mis à jour vers `JWT_EXPIRES_IN_SECONDS=604800` (ignoré par git, non commité).
- `server/src/config/env.ts` : schéma `JWT_EXPIRES_IN_SECONDS` (`z.coerce.number().int().positive().max(30*24*60*60).default(7*24*60*60)`).
- `server/src/modules/auth/service.ts` : `expiresIn: env.JWT_EXPIRES_IN_SECONDS` (secondes).
- `server/src/modules/auth/routes.ts` : `maxAge: env.JWT_EXPIRES_IN_SECONDS * 1000` (ms).
- `server/src/lib/cookies.ts` : suppression de `COOKIE_MAX_AGE_MS`.
- `suiviDeepseek.md` : références mises à jour.
- `tests/src/auth.integration.test.ts` : ajout des assertions `Max-Age=604800`, cohérence `exp - iat ≈ 604800` (±5 s), et suppression des cookies `auth_token`/`csrf_token` au logout.

## Vérifications
| Commande | Résultat |
|---|---|
| `npm run typecheck` | ✅ shared + server + client |
| `npm run lint` | ✅ 0 erreur |
| `npm test` | ✅ 26/26 (2 fichiers) |
| `npm run build` | ✅ server (`dist/index.js` 14.10 KB) + client |
| `npm audit --omit=dev` | ✅ 0 vulnérabilité |

Aucune fusion dans `main` n'a été effectuée.
