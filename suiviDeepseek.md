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

---

# Suivi — FindBarberNearYou (lot 2 : profils BARBER, services, pays, devises, lien public)

État après implémentation du lot 2. Commité et poussé sur `feature/barber-profiles` (pas de fusion dans `main`, pas de PR).

## Cadrage retenu (adaptations du plan)

- **`barberId`** = `barber_profiles.id` (identifiant public du profil), jamais `users.id`.
- **Pays** : `countryCode` ISO 3166-1 alpha-2, validé contre une liste statique documentée (`shared/src/countries.ts`, ~250 entrées, noms français). Aucune dépendance ajoutée.
- **Devises** : `SUPPORTED_CURRENCIES = ["CHF", "EUR", "USD"]` centralisé dans `shared/src/constants.ts` (énumération Postgres + validation Zod). Une devise par profil, immuable après création (409 `CURRENCY_CHANGE_FORBIDDEN`). USD ajouté dès ce lot.
- **Lien public** : `/barbers/:id` (page unique), construit côté client depuis `window.location.origin` + `profile.id`. Stable (basé sur l'id). Copie via Clipboard API avec état d'erreur et champ sélectionnable.
- **Upsert atomique** : `INSERT … ON CONFLICT (user_id) DO UPDATE … SET WHERE currency = excluded.currency`. Conserve `id`/`createdAt`, n'écrase jamais la devise, pas de 500 en création concurrente.

## Fichiers créés

- `shared/src/countries.ts` (liste pays + `isCountryCode`)
- `shared/src/validation/barber.ts` (schémas profil + service)
- `shared/src/validation/index.ts`
- `server/src/modules/barber/service.ts` (profil, services, profil public)
- `server/src/modules/barber/publicRoutes.ts` (route publique `/api/barbers/:barberId`)
- `client/src/pages/barber/ProfilePage.tsx`
- `client/src/pages/barber/ServicesPage.tsx`
- `client/src/pages/client/BarberProfilePage.tsx` (public)
- `client/src/lib/formatters.ts` (prix sans flottant + formatage CHF/EUR/USD)
- `tests/src/barber.integration.test.ts`
- `tests/src/formatters.test.ts`
- `server/drizzle/0001_cynical_mother_askani.sql` (+ `server/drizzle/meta/*`)

## Fichiers modifiés

- `shared/src/constants.ts`, `shared/src/types.ts`, `shared/src/schema.ts`, `shared/src/index.ts`, `shared/package.json`
- `server/src/db/client.ts`, `server/src/modules/barber/routes.ts`, `server/src/app.ts`
- `client/src/lib/apiClient.ts`, `client/src/pages/barber/DashboardPage.tsx`, `client/src/app/router.tsx`
- `README.md` (API + fallback SPA), `suiviDeepseek.md`

## Commandes exécutées

```bash
npm run db:generate   # migration 0001 (2 tables + FK + CHECK + index)
npm run db:migrate
npm run typecheck
npm run lint
npm test              # 64 tests
npm run build
npm audit --omit=dev
```

## Résultats

| Vérification | Résultat |
|---|---|
| db:generate | ✅ `0001_cynical_mother_askani.sql` |
| db:migrate | ✅ appliquée |
| typecheck | ✅ shared + server + client |
| lint | ✅ 0 erreur, 0 warning |
| tests | ✅ 64/64 (auth 23 + roles 3 + barber 23 + formatters 15) |
| build | ✅ server `dist/index.js` 37.57 KB + client |
| audit --omit=dev | ✅ 0 vulnérabilité |

## Points reportés

- PostgreSQL de production non testé de bout en bout (pas de serveur Postgres disponible).
- Tests navigateur non exécutés (pas de navigateur pilotable dans l'environnement) : copie du lien, navigation privée, actualisation de la page publique à vérifier manuellement.
- `Intl.NumberFormat("fr-CH", …)` produit le séparateur décimal suisse (point) : affichage « 25.50 CHF ». À ajuster si une locale fr-FR (virgule) est souhaitée.
- Liste pays statique (~250 entrées) : ajout d'un pays = une ligne dans `shared/src/countries.ts`.

## Git (état final du lot 2)

- Branche : `feature/barber-profiles` (créée depuis `main` à `52dbb4b`).
- Commit : `a775c384e8670a6635c2d6667ba52e9fe04e2ccc` (`feat: add international barber profiles and services`), poussé sur `origin/feature/barber-profiles`.
- `git status --short` après commit : propre (aucune modification restante).
- Aucun `.env`, secret, ZIP, dossier de build (`dist/`) ou donnée PGlite (`data/`) ajouté. `claude/` conservé.

---

## Suivi — revue lot 2 (corrections avant fusion, non commitées)

État : corrections appliquées localement sur `feature/barber-profiles`. Non commitées (Git géré par l'utilisateur).

### Corrections

1. **Contraintes DB de bornes** : `barber_services` remplace `duration > 0` / `price >= 0` par `duration_minutes BETWEEN 1 AND 480` et `price_minor BETWEEN 0 AND 1000000`, en réutilisant `LIMITS` (via `sql.raw` pour inliner les littéraux). Nouvelle migration `0002_stale_natasha_romanoff.sql`.
2. **Tests d'insertion directe** : refus en base de `durationMinutes` 0/481 et `priceMinor` -1/1000001, acceptation des bornes 1/480 et 0/1000000.
3. **DashboardPage** : erreur de chargement distincte du profil absent, avec bouton « Réessayer ».
4. **parsePriceToMinor** : retourne `null` si le résultat n'est pas un entier sûr ou dépasse les bornes (`LIMITS.servicePriceMinorMin/Max`). Tests ajoutés (prix max, au-dessus de la limite, chaîne très longue).

### Vérifications

| Commande | Résultat |
|---|---|
| `npm run db:migrate` | ✅ migration 0002 appliquée |
| `npm run typecheck` | ✅ shared + server + client |
| `npm run lint` | ✅ 0 erreur, 0 warning |
| `npm test` | ✅ 69/69 (auth 23 + roles 3 + barber 25 + formatters 18) |
| `npm run build` | ✅ server 37.87 KB + client |

### Fichiers modifiés (non commités)

- `shared/src/constants.ts`, `shared/src/schema.ts`, `shared/src/validation/barber.ts`
- `client/src/lib/formatters.ts`, `client/src/pages/barber/DashboardPage.tsx`
- `tests/src/barber.integration.test.ts`, `tests/src/formatters.test.ts`
- `server/drizzle/0002_stale_natasha_romanoff.sql` + `server/drizzle/meta/0002_snapshot.json` (nouveaux)
- `server/drizzle/meta/_journal.json` (entrée 0002)

---

# Suivi — lot 3 : recherche et filtres coiffure (non commité)

État : implémenté sur `main`, aucune modification Git (l'utilisateur garde la main).
Aucun commit, push, branche, PR ni fusion.

## Pass 1 — implémentation (2026-09-30)

### Fichiers créés
- `server/src/lib/like.ts` (échappement LIKE : `%`, `_`, `\`)
- `server/src/lib/validation.ts` (`validationError` partagée)
- `client/src/pages/client/BarbersSearchPage.tsx`
- `tests/src/search-validation.test.ts`
- `tests/src/barber-search.integration.test.ts`
- `tests/src/migration-0003.test.ts`
- `server/drizzle/0003_equal_ozymandias.sql` + `server/drizzle/meta/0003_snapshot.json` (générés)

### Fichiers modifiés
- `shared/src/constants.ts` (AUDIENCES/TECHNIQUES + libellés + SEARCH_LIMITS)
- `shared/src/schema.ts` (enums audience/technique + 2 tables de liaison, PK composites, FK cascade)
- `shared/src/types.ts` (tags services + types recherche)
- `shared/src/validation/barber.ts` (tags optionnels create / PATCH sémantique + schéma recherche strict)
- `server/src/db/client.ts` (enregistrement des 2 tables)
- `server/src/modules/barber/service.ts` (tags en transaction, searchBarbers, DTO explicites)
- `server/src/modules/barber/publicRoutes.ts` (`GET /api/barbers`)
- `server/src/modules/barber/routes.ts` (réutilise `validationError` partagée)
- `client/src/lib/apiClient.ts` (`search` + `signal` transmis à fetch)
- `client/src/pages/barber/ServicesPage.tsx` (multi-sélection publics/techniques)
- `client/src/pages/client/BarberProfilePage.tsx` (affichage tags)
- `client/src/pages/client/HomePage.tsx` (lien recherche)
- `client/src/app/router.tsx` (route `/barbers`)
- `README.md`

### Migration
`0003_equal_ozymandias.sql` : additive. `CREATE TYPE audience/technique`, 2 tables de liaison
(PK composites, FK `ON DELETE CASCADE`, index). Aucune retouche de 0000–0002, aucun backfill.

## Pass 2 — vérifications (2026-09-30)

| Commande | Résultat |
|---|---|
| `npm run db:generate` | ✅ `0003_equal_ozymandias.sql` |
| `npm run db:migrate` | ✅ appliquée |
| `npm run typecheck` | ✅ shared + server + client |
| `npm run lint` | ✅ 0 erreur, 0 warning |
| `npm test` | ✅ 94/94 (7 fichiers) |
| `npm run build` | ✅ server `dist/index.js` 47.67 KB + client |

### Incidents / corrections
- `and(...conditions)` typé `SQL | undefined` → assertion non-null (conditions toujours non vides).
- `EMPTY_FILTERS` inutilisé (lint) → supprimé.
- Test migration : extension `.sql` dupliquée → `findMigration` retourne le tag sans extension.

## Pass 3 — tests navigateur (2026-09-30)

Navigateur automatisé : Chrome 154 headless via puppeteer-core (hors dépôt), Vite dev + API
Express sur base PGlite isolée. **10/10 OK.**

1. Recherche sans filtre (13 résultats, page 1/2)
2. Filtre `audience=FEMME` (Alpha + Gamma, Beta exclu)
3. Filtre combiné `FEMME` + `COUPE` (même service → seul Alpha)
4. Réinitialisation (URL nettoyée)
5. Pagination (page 2 → Barbier Gamma, tri stable)
6. Ouverture profil public (nom + service + tags)
7. Actualisation avec filtres dans l'URL (sélecteur restauré)
8. Création profil BARBER (UI)
9. Création service catégorisé (UI, FEMME+HOMME / COUPE+DEGRADE)
10. Édition : catégories restaurées (cases cochées)

### Incident navigateur
- Rate limiting dev (20 auth/15 min) tronquait le seed à 10/13 barbiers → serveur de test
  relancé avec `AUTH_RATE_LIMIT_MAX=1000` (configuration d'environnement, pas du code).

## Limites restantes
- Rendu visuel/CSS non contrôlé (assertions DOM uniquement).
- Recherche insensible aux accents et index spécialisés (trigram) : reportés (décision lot 3).
- PostgreSQL de production non testé de bout en bout (PGlite seul).

## État Git
- Branche : `main`, HEAD `33b8f44` (inchangé). `git status --short` : uniquement les fichiers
  listés ci-dessus, aucun commit/merge/push.

---

## Correctifs ciblés BarbersSearchPage (2026-09-30, non commité)

### Changements
- `client/src/pages/client/BarbersSearchPage.tsx` :
  1. Page demandée vide alors que `pagination.total > 0` → message « Cette page ne contient aucun résultat. »
     + bouton « Revenir à la première page » (`goToPage(1)`, filtres conservés).
  2. Normalisation `trim + toUpperCase` de `countryCode`, `audience` et `technique` à la lecture
     de l'URL (`normalizeCode`), pour l'affichage des sélecteurs ET l'appel API.

### Commandes exécutées
| Commande | Résultat |
|---|---|
| `npm run typecheck` | ✅ shared + server + client |
| `npm run lint` | ✅ 0 erreur, 0 warning |
| `npm test` | ✅ 94/94 |
| `npm run build` | ✅ server + client |
| Navigateur ciblé | ✅ 4/4 |

### Vérifications navigateur (4/4)
1. `?page=999` (données existantes) → message page vide + bouton présents.
2. Clic « Revenir à la première page » → `url=/barbers` (paramètre `page` retiré).
3. `?audience=femme&page=999` → bouton conservant le filtre (`url=…?audience=femme`, Alpha+Gamma).
4. `?audience=femme&technique=coupe&countryCode=ch` → sélecteurs `CH`/`FEMME`/`COUPE`,
   seul Barbier Alpha retourné.

---

# Suivi — lot 4 : carte (MapLibre GL JS + MapTiler, non commité)

État : implémenté sur `main`, aucune modification Git (l'utilisateur garde la main).
Aucun commit, push, branche, PR ni fusion.

## Choix validés appliqués

- **MapLibre GL JS** (`maplibre-gl@6.11.2`, dernier stable vérifié via `npm view`),
  wrapper React maison (`client/src/components/BarbersMap.tsx`). Ni Leaflet ni
  `react-map-gl`. Chargement différé via `React.lazy` (chunk `BarbersMap-*.js`
  ~1 046 Ko minifié, ~285 Ko gzip, sorti du bundle initial).
- **MapTiler Free** réservé au développement. Aucun abonnement/achat/création de
  compte effectué.
- **Fond vectoriel clair/désaturé** : identifiant réel vérifié sur le catalogue
  MapTiler. `dataviz-v4` (Dataviz) par défaut ; alternative `base-v4` (Basic).
  **Correction** : `dataviz-v4-light` n'existe pas (ancien défaut erroné).
- **Carte limitée aux résultats de la page courante**, badge visible
  « Carte : résultats de cette page ».
- **Coordonnées exactes** des profils exposées par `GET /api/barbers`
  (`latitude`/`longitude`), déjà publiques via le profil détaillé.
- **Mobile** : liste par défaut, bascule Liste/Carte (bouton `lg:hidden`).
- **Attribution conforme** : `AttributionControl(compact: true)` avec
  `© MapTiler` + `© OpenStreetMap contributors` (liens), CGU MapTiler §6.
- **Aucun changement de schéma ni migration** (`shared/src/schema.ts` intact).

## Correction de la documentation de facturation

- MapLibre connecté **directement** à MapTiler : trafic comptabilisé **par
  requête** (style, sprites, glyphes, tuiles), **pas automatiquement par session**.
- Déplacement/zoom : **aucun nouvel appel** à notre API de recherche
  (`GET /api/barbers` n'est appelé qu'au chargement/filtres/pagination), mais
  **de nouvelles requêtes au fournisseur** pour les tuiles manquantes
  (une tuile = une requête).
- **Pas de promesse** « une visite = une session facturée » ; se référer aux
  quotas du plan réellement utilisé. Documenté dans `README.md`.

## Clé et configuration

- `.env.example` : `VITE_MAP_API_KEY=` vide + instructions de restriction par
  origine HTTP (« Allowed HTTP origins »). Jamais de clé dans le code.
- `client/vite.config.ts` : `envDir: '..'` charge le `.env` racine du monorepo.
  Vérifié avec `loadEnv` : seules les variables `VITE_*` sont exposées à
  `import.meta.env` (`VITE_API_URL`, `VITE_MAP_API_KEY`) ; `JWT_SECRET` n'est
  **pas** exposé.
- **Sans clé** : `getMapSettings()` renvoie `configured: false`, la carte affiche
  « Carte non configurée », la liste reste fonctionnelle et **aucune requête
  fournisseur** n'est émise. Aucune substitution silencieuse par une clé de
  démonstration ou un autre fournisseur.
- Aucune clé valide disponible : **rendu MapTiler réel non vérifié**, tests
  réalisés avec un fournisseur simulé (voir ci-dessous).

## Fichiers créés

- `client/src/components/BarbersMap.tsx` (wrapper MapLibre + marqueurs + cadrage)
- `client/src/components/BarbersMapCard.tsx` (encart React du barber sélectionné)
- `client/src/components/MapErrorBoundary.tsx` (garde-fou rendu React)
- `client/src/lib/mapConfig.ts` (clé/style/attribution, aucune requête sans clé)
- `client/src/lib/media.ts` (`useMediaQuery`, `usePrefersReducedMotion`)
- `client/src/lib/barberTags.ts` (`audienceChips`, « Mixte » calculé)

## Fichiers modifiés

- `client/package.json` (+ `maplibre-gl@^6.11.2`) et `package-lock.json`
- `client/src/pages/client/BarbersSearchPage.tsx` (bascule Liste/Carte, sélection
  bidirectionnelle, retrait de sélection obsolète, liste en alternative textuelle)
- `client/src/styles/index.css` (marqueurs SVG DOM, état sélectionné, focus,
  `prefers-reduced-motion`)
- `client/src/vite-env.d.ts` (+ `VITE_MAP_*`)
- `shared/src/types.ts` (+ `latitude`/`longitude` sur `PublicBarberSearchItem`)
- `server/src/modules/barber/service.ts` (expose `latitude`/`longitude` dans le DTO)
- `tests/src/barber-search.integration.test.ts` (coordonnées exactes, filtres, pages)
- `.env.example`, `README.md`

## Robustesse implémentée

- Sélection bidirectionnelle liste ↔ marqueur ; encart React ; « Voir le profil »
  reste un `Link` de navigation.
- Sélection devenue absente retirée après changement de page/filtres.
- Pas de recentrage à chaque rendu : cadrage uniquement sur changement réel
  (`resultsSignature` id:lat:lng).
- `prefers-reduced-motion` respecté (défilement liste + animations carte).
- Chargement différé, `map.remove()` au démontage, `ResizeObserver` (mobile).
- Erreur tuile ponctuelle (après `load`) ≠ panne persistante (style jamais chargé,
  watchdog 12 s + marge de grâce 4 s). `map.on('error')` géré (l'ErrorBoundary ne
  suffit pas). Bouton « Revenir à la liste » sur mobile en cas d'échec.

## Vérifications

| Commande | Résultat |
|---|---|
| `npm run typecheck` | ✅ shared + server + client |
| `npm run lint` | ✅ 0 erreur, 0 warning |
| `npm test` | ✅ 95/95 (7 fichiers) |
| `npm run build` | ✅ server `dist/index.js` 47.80 KB + client (carte lazy) |
| `npm ls maplibre-gl` | ✅ 6.11.2 (latest) |

### Poids du bundle (gzip niveau 9, mesuré indépendamment)

| Fichier | Minifié | Gzip |
|---|---|---|
| `index-*.js` (bundle principal, sans carte) | 467 940 o | **128 805 o** (~125,8 KiB) |
| `index-*.css` | 17 077 o | 3 938 o |
| `BarbersMap-*.js` (chunk carte, chargé à la demande) | 1 045 692 o | **282 603 o** (~276,0 KiB) |
| `BarbersMap-*.css` | 83 132 o | 10 464 o |

- Téléchargement initial en vue Liste mobile : `index.js` + `index.css` ≈ **132,7 Ko gzip**.
- Surcoût à l'ouverture de la carte : ≈ **293,1 Ko gzip** supplémentaires.
- Le bundle principal ne contient **aucune** occurrence de « maplibre » (0) ; le chunk
  carte en contient 286. Le découpage est donc réel, pas seulement déclaré.

## Tests navigateur (fournisseur SIMULÉ, 26/26)

Harness **extérieur à l'arbre de travail du dépôt** (`C:\Users\mathi\temp-lot4`,
non versionné, n'apparaît pas dans `git status`) : puppeteer-core + Chrome headless,
style `http://localhost:5050/style.json` simulé, aucune requête MapTiler réelle.

1. Desktop : carte montée + `ready`, 12 résultats, marqueurs = résultats.
2. Attribution MapTiler + OSM présente ; badge « Carte : résultats de cette page ».
3. Clic liste → marqueur sélectionné + encart + anneau résultat.
4. Clic marqueur → résultat mis en évidence (bidirectionnel).
5. Pagination : page 2 = 2 résultats, aucun marqueur résiduel, sélection retirée.
6. Filtre ville : liste/carte synchronisées (7/7 Lausanne).
7. Injection HTML : nom rendu en texte littéral, aucun XSS exécuté.
8. Clavier : focus marqueur + Entrée sélectionne.
9. Panne fournisseur persistante (style bloqué) : repli + « Réessayer », liste OK.
10. Erreur de tuile ponctuelle : badge « Certaines tuiles… », carte non déclarée en panne.
11. Mobile : liste par défaut (carte non montée), bascule Carte (canvas dimensionné),
    retour immédiat à la liste.
12. Aucune erreur JS non gérée (pageerror).

## Passe complémentaire : absence de clé + chargement différé (9/9)

Build normal (sans `VITE_MAP_API_KEY`, sans `VITE_MAP_STYLE_URL`) ; API PGlite
en mémoire + 14 barbiers seedés ; Chrome headless.

1. Absence de clé → message « Carte non configurée » + instruction `VITE_MAP_API_KEY`.
2. Recherche fonctionnelle sans clé (12 résultats).
3. **Zéro requête MapTiler** (aucun style, aucune tuile).
4. Vue mobile Liste : carte non montée.
5. Vue mobile Liste : **chunk `BarbersMap-*.js` non chargé** (0 requête).
6. Recherche/filtre fonctionnels en vue Liste (7 résultats Lausanne).
7. Ouverture de la carte : chunk chargé **à ce moment** (1 requête) → différé effectif.
8. Message clair également sur mobile.
9. Toujours zéro requête MapTiler côté mobile.

## Captures

- Produites : `desktop-selection.png` (1440×900), `mobile-list.png` (390×844),
  `mobile-map.png` (390×844), `desktop-unconfigured.png` (1440×900),
  `mobile-unconfigured.png` (390×844) dans `temp-lot4/shots/`.
- **Non inspectées visuellement** : le modèle courant ne lit pas les images. Seules
  leurs dimensions/tailles ont été vérifiées (fichiers non vides). Le rendu visuel
  réel reste à confirmer par l'utilisateur.

## Limites restantes

- Rendu MapTiler réel **non vérifié** (aucune clé fournie) ; seuls des mocks ont été
  utilisés pour le fournisseur de carte.
- PostgreSQL de production non testé de bout en bout (PGlite seul).
- Capture visuelle non inspectée (voir ci-dessus).
- `temp-lot4/` est un harness **extérieur à l'arbre de travail du dépôt**
  (`C:\Users\mathi\temp-lot4`, non versionné, absent de `git status`) ; les
  processus Node qu'il lance doivent être arrêtés manuellement après exécution
  (nettoyage par port dans `run.sh`/`verify-nokey.sh`, `taskkill` sur `$!` peu
  fiable sous git-bash/Windows).

---

# Suivi — passe UI ciblée (avant commit, non commité)

Aucun commit/push/branche/fusion. Modifications limitées au formulaire de
recherche (`BarbersSearchPage.tsx`) et au message « carte non configurée »
(`BarbersMap.tsx`).

## 1. Filtres compacts sur mobile

- Ligne toujours visible : **Ville** + **Rechercher** + **Filtres**
  (+ **Réinitialiser**). Objectif : résultats visibles dès le premier écran.
- Panneau `#advanced-filters` (Nom, Pays, Public, Prestation) **dépliable** sur
  mobile (`<lg`), **toujours visible** en desktop (`lg`).
- Accessible : bouton `aria-expanded` + `aria-controls="advanced-filters"` ;
  replié = `display:none` (champs non focusables) ; Entrée et Espace fonctionnent.
- **Compteur de filtres supplémentaires actifs** (nom, pays, public, prestation)
  affiché en pastille sur le bouton ; exposé via `data-active-filters` pour les tests.
- Valeurs, synchronisation URL et réinitialisation conservées.

## 2. Desktop compact

- Bloc de recherche : `p-4` (au lieu de `p-5`), `space-y-3` (au lieu de `space-y-4`),
  gaps `gap-2` ; conteneur de page `space-y-4` (au lieu de `space-y-6`).
- Champs répartis en 2 lignes (ville+actions, puis 4 champs avancés) au lieu de 3.
- Interface non refaite par ailleurs.

## 3. Carte non configurée (dev vs prod)

- Développement : instructions techniques conservées (« Carte non configurée » +
  `VITE_MAP_API_KEY`).
- Production : message neutre uniquement — « La carte est momentanément
  indisponible. Vous pouvez continuer avec la liste. »
- Bouton « Revenir à la liste » présent sur mobile dans les deux cas.

### Détail technique — correctif build `NODE_ENV` (à la racine)

**Cause** : `client/vite.config.ts` pointe `envDir` sur le `.env` racine (partagé
avec le serveur). Vite interprète un `NODE_ENV=development` présent dans ce
fichier comme une demande explicite de **development build** (code Vite : seule
la valeur `development` y est supportée ; toute autre valeur est ignorée avec
 avertissement). Conséquence : `vite build` produisait un bundle React **dev**
(`jsxDEV`, chemins source) et `import.meta.env.DEV` restait `true`.

**Correctif ciblé** : `NODE_ENV` retiré de `.env.example` **et** du `.env` local.
- Serveur : retombe sur `development` par défaut (`envSchema.default`), PGlite
  locale inchangée ; en production, `NODE_ENV=production` est fourni par
  l'environnement (PostgreSQL + contrôles de secret). Vérifié : le serveur
  compile démarre bien en `development`.
- Vite : `vite build` → production, `vite dev` → development (défauts de commande).

**Présentation corrigée** : le détour antérieur par `import.meta.env.MODE` (au
lieu de `DEV`) a été **annulé**. Il ne corrigeait **pas** le runtime React,
seulement l'affichage du message. La condition du message est revenue à
`import.meta.env.DEV`, cohérente avec le runtime React désormais correct.

**Vérifications séparées** :
- `npm run build` : **aucun `jsxDEV`** → React production ; message neutre
  présent, branche dev absente du bundle.
- `npm run dev` (serveur Vite) : instructions techniques présentes.
- Bundle principal : **129,66 Ko → 73,08 Ko gzip** (passage React dev → prod).

## 4. Vérifications (code final)

| Commande | Résultat |
|---|---|
| `npm run typecheck` | ✅ shared + server + client |
| `npm run lint` | ✅ 0 erreur, 0 warning |
| `npm test` | ✅ 95/95 (7 fichiers) |
| `npm run build` | ✅ server + client (`index` gzip **73,08 Ko** React prod ; chunk carte gzip 284,57 Ko) |

### Tests navigateur (fournisseur SIMULÉ)

- Suite historique : **26/26** (sélection, pagination, filtres, XSS, clavier,
  panne persistante vs tuile ponctuelle, mobile).
- Passe UI ciblée : **16/16** — panneau filtres toujours visible en desktop,
  champ Nom visible sans clic, bouton Filtres masqué en desktop, restauration URL
  (nom+pays+public+prestation), réinitialisation, ville+Rechercher+Filtres visibles
  en mobile, panneau replié par défaut puis ouvert, **Entrée/Espace au clavier**,
  saisie clavier dans le panneau, compteur `data-active-filters=2` avec badge,
  sélections restaurées depuis l'URL, bascule Liste/Carte.
- Absence de clé (build production) : **9/9** — message neutre prod, **0 requête
  MapTiler**, recherche OK, chunk carte non chargé en vue mobile Liste puis chargé
  à l'ouverture.
- Message de développement (`vite dev`) : **3/3** — instructions techniques,
  0 requête MapTiler, recherche OK.

### Captures (`temp-lot4/shots-final/`, non inspectées visuellement)

`desktop-compact.png`, `desktop-selection.png`, `desktop-url-restore.png`,
`desktop-unconfigured.png`, `desktop-dev-hints.png` (1440×900) ;
`mobile-compact.png`, `mobile-list.png`, `mobile-filters-open.png`,
`mobile-map.png`, `mobile-unconfigured.png` (390×844).

## Distinctions maintenues

- **Fournisseur simulé** : toute la vérification navigateur ci-dessus (style mock
  `http://localhost:5050/style.json`).
- **Fournisseur MapTiler réel** : **non testé** (aucune clé fournie). Le rendu
  réel du fond vectoriel `dataviz-v4` reste à confirmer par l'utilisateur.
- **Captures** : produites mais **non inspectées visuellement** (le modèle courant
  ne lit pas les images) ; seules dimensions/tailles vérifiées.

## Limites / points ouverts

- Rendu MapTiler réel non testé (pas de clé) ; `dataviz-v4` vérifié au catalogue.
- `NODE_ENV=development` ne doit **pas** être remis dans le `.env` partagé : Vite
  le lit via `envDir` et forcerait un build React dev. Le serveur a `development`
  par défaut ; en production, définir `NODE_ENV=production` dans l'environnement.
- `temp-lot4/` reste extérieur à l'arbre de travail du dépôt (non versionné).

---

# Suivi — lot 5 : disponibilités hebdomadaires du barbier (non commité)

État : implémenté sur `main`, aucune modification Git (l'utilisateur garde la main).
Aucun commit, push, branche, PR ni fusion, ni changement d'issue.

## Périmètre validé et appliqué

- Profil propriétaire résolu **et verrouillé** (`SELECT … FOR UPDATE`) **dans** la
  transaction, avant `DELETE` + `INSERT` : deux PUT simultanés sont sérialisés, y
  compris sur un planning vide (l'ancre du verrou est la ligne du profil).
- Plusieurs plages par jour, jours ISO 1–7, pauses implicites entre plages, plages
  adjacentes autorisées, aucun passage de minuit, remplacement complet par `PUT`,
  suppression par `{ "intervals": [] }`.
- `endMinute = 1440` conservé, saisi uniquement via le contrôle explicite
  « Fin de journée (24:00) » ; jamais `"24:00"` comme valeur d'un `input type="time"`.
- Heures locales du salon, sans colonne `timezone` : le fuseau IANA du salon sera
  **obligatoire avant le moteur de réservation**, sans déduction automatique depuis
  le pays ni le navigateur. Affiché sur `/pro/working-hours` et documenté (README).
- Aucun développement de réservation ; le moteur de créneaux futur lira cette table.

## Fichiers créés

- `client/src/pages/barber/WorkingHoursPage.tsx`
- `client/src/lib/time.ts` (parse/format minutes ↔ « HH:MM », split/join fin de journée)
- `tests/src/time.test.ts`
- `tests/src/working-hours.validation.test.ts`
- `tests/src/working-hours.integration.test.ts`
- `tests/src/migration-working-hours.test.ts` (tag découvert dans `_journal.json`,
  aucun numéro de migration supposé)
- `server/drizzle/0004_fuzzy_phantom_reporter.sql` + `server/drizzle/meta/0004_snapshot.json`

## Fichiers modifiés

- `shared/src/constants.ts` (`WEEKDAYS`, `WEEKDAY_LABELS`, limites horaires dans `LIMITS`)
- `shared/src/types.ts` (`WorkingHoursInterval`, `WorkingHoursResponse`)
- `shared/src/schema.ts` (table `barber_working_hours`)
- `shared/src/validation/barber.ts` (`workingHoursIntervalSchema`, `workingHoursSchema`,
  `WorkingHoursInput` : bornes, `.strict()`, `start < end`, doublons/chevauchements,
  plafonds 6/jour et 42 au total)
- `server/src/db/client.ts` (table enregistrée dans `schema`)
- `server/src/modules/barber/service.ts` (`getWorkingHours`, `replaceWorkingHours`
  avec verrou `FOR UPDATE` in-transaction)
- `server/src/modules/barber/routes.ts` (`GET`/`PUT /api/barber/working-hours`)
- `client/src/lib/apiClient.ts` (`getWorkingHours`, `replaceWorkingHours`)
- `client/src/app/router.tsx` (route `/pro/working-hours`)
- `client/src/pages/barber/DashboardPage.tsx` (carte « Mes horaires »)
- `README.md`, `suiviDeepseek.md`
- `server/drizzle/meta/_journal.json` (entrée 0004, générée)

## Migration

`0004_fuzzy_phantom_reporter.sql` : purement additive. `CREATE TABLE
barber_working_hours` (id text PK, FK `barber_profile_id` → `barber_profiles` ON
DELETE CASCADE, weekday int, start_minute/end_minute int, timestamps), 4 CHECK
(weekday 1..7, start 0..1439, end 1..1440, start < end), index
`(barber_profile_id, weekday)`, index unique `(barber_profile_id, weekday,
start_minute)`. **Relue avant application.** Aucune retouche de 0000–0003, aucun
backfill. Appliquée sur la base locale de développement (PGlite
`server/data/pglite`), jamais sur une base de production.

## Commandes exécutées et résultats

| Commande | Résultat |
|---|---|
| `npm run db:generate` | ✅ `0004_fuzzy_phantom_reporter.sql` (relue) |
| `npm run db:migrate` | ✅ appliquée (base locale) |
| `npm run typecheck` | ✅ shared + server + client |
| `npm run lint` | ✅ 0 erreur, 0 warning (1 erreur corrigée : variable inutilisée) |
| `npm test` | ✅ **137/137** (11 fichiers ; +42 nouveaux : time 13, validation 13, intégration 15, migration 1) |
| `npm run build` | ✅ server `dist/index.js` 53.97 KB + client |

### Poids du bundle client

Le bundle principal passe de **73,08 Ko → 89,35 Ko gzip** : la page des horaires
importe `workingHoursSchema` (zod) pour la pré-validation locale, conformément au
plan validé. Le serveur reste l'autorité. Si ce surcoût (~16 Ko gzip) est jugé
excessif, une validation manuelle côté client (comme `ServicesPage`) retirerait
zod du bundle — à arbitrer.

## Tests de concurrence et limite PGlite

Deux PUT simultanés testés (planning vide puis déjà rempli) : chaque réponse 200
égale à son propre payload, l'état final correspond **exactement** à l'un des deux
payloads (jamais un mélange), aucune erreur 500.

**Limite documentée** : PGlite exécute les transactions via un mutex interne
(`_runExclusiveTransaction`, une seule connexion). Ces tests prouvent l'absence
de mélange et de 500, mais **ne prouvent pas** le comportement `FOR UPDATE` sous
deux connexions PostgreSQL réelles (pas de serveur Postgres dans l'environnement,
et `server/src/db/client.ts` expose un singleton `db` non injectable). Le
comportement multi-connexions reste à valider sur une vraie base Postgres (CI/recette).

## Point de revue séparé — `updateService` (à vérifier, NON conclu)

`updateService` effectue un remplacement DELETE + INSERT des audiences/techniques
dans une transaction, sans verrouillage explicite du profil. **Hypothèse à
vérifier avant toute conclusion** : vérifier l'ordre exact des opérations dans
`updateService` et les verrous déjà acquis (par les DELETE/INSERT de lignes
existantes) pour déterminer si deux PATCH simultanés sur le même service peuvent
produire une union des catégories. Aucun changement n'a été apporté à
`updateService` dans ce lot, et cette hypothèse n'est **pas présentée comme
confirmée**.

## Limites et tests manuels restants

- Rendu visuel de `/pro/working-hours` non vérifié en navigateur (pas de navigateur
  pilotable) : coche « Fin de journée (24:00) », désactivation du champ Fin,
  ajout/suppression de plages, boutons Enregistrer/Tout effacer — à vérifier
  manuellement.
- Concurrence PostgreSQL multi-connexions non testée (voir ci-dessus).
- PostgreSQL de production non testé de bout en bout (PGlite seul).
- Surcharge zod dans le bundle client (~16 Ko gzip) : arbitrage en attente.

---

## Passe revue — corrections ciblées validées (non commité)

État : corrections appliquées après revue des extraits, uniquement sur les points
autorisés. Aucun autre changement, aucun nettoyage CRLF, aucun commit/push/branche.

### 1. Tout effacer — confirmation

- Panneau de confirmation « Effacer tous vos horaires enregistrés ? » avec
  « Annuler » / « Confirmer » (aucun `window.confirm`).
- « Annuler » ferme le panneau : ni requête, ni modification du brouillon.
- « Confirmer » exécute le PUT `{ intervals: [] }` inchangé, puis synchronise le
  formulaire depuis la réponse (liste vide), sans GET supplémentaire.

### 2. Erreurs de validation rattachées aux plages

- `workingHoursSchema.superRefine` conserve désormais **les indices d'origine du
  payload** dans le `path` de chaque issue (`["intervals", index]`) : chevauchements
  (intervalle en conflit) et plafond par jour (chaque plage excédentaire). Le
  `refine` début/fin expose déjà `["intervals", index, "endMinute"]`. Aucune
  validation serveur supprimée.
- Côté page : `buildPayload` construit une correspondance payload→ligne
  (`meta` : clé de ligne, jour, numéro de plage dans l'ordre d'affichage) ;
  les erreurs de saisie locale et les issues Zod (via `extractIntervalIndex` +
  `formatIntervalError` dans `client/src/lib/time.ts`) sont affichées **sous la
  ligne concernée** sous la forme « Mardi, plage 2 : … ». Les issues sans index
  restent dans le bandeau global.
- Tests ajoutés : chemins des issues (chevauchement → index d'origine, début≥fin →
  index + `endMinute`, plafond → indices excédentaires uniquement) et helpers
  `extractIntervalIndex` / `formatIntervalError`.

### 3. Sauvegarde

- La réponse du PUT est réutilisée pour synchroniser le formulaire
  (`applyIntervals(res.intervals)`), plus de `GET /working-hours` systématique
  après sauvegarde ni après effacement. Le GET ne sert qu'au chargement initial.
- Tous les contrôles du formulaire sont désactivés pendant `saving` (cases jours,
  heures, coche 24:00, suppression, ajout, boutons).
- En cas d'échec (réseau/API), le brouillon reste intact (aucun `setDays` dans les
  chemins d'erreur).
- Correction lint : `applyIntervals`/`loadData` stabilisés via `useCallback`
  (dépendance d'effet manquante signalée, résolue).

### Résultats réellement obtenus

| Commande | Résultat |
|---|---|
| `npm run typecheck` | ✅ shared + server + client |
| `npm run lint` | ✅ 0 erreur, 0 warning (après correction `useCallback`) |
| `npm test` | ✅ **143/143** (11 fichiers ; +6 : time 16, validation 16) |
| `npm run build` | ✅ server `dist/index.js` 54.24 KB + client (`index` gzip 89.91 Ko) |

- Aucune migration nouvelle : `0004_fuzzy_phantom_reporter.sql` inchangée.
- Rendu navigateur des nouveaux comportements (confirmation d'effacement, erreurs
  sous les lignes, désactivation pendant `saving`) : à vérifier manuellement, pas
  de navigateur pilotable.

---

# Suivi — lot 6A : fuseau horaire du salon (non commité)

État : implémenté sur `main` après validation explicite du SQL de migration par
l'utilisateur. Aucune modification Git (l'utilisateur garde la main) : aucun
commit, push, branche, PR.

## Décisions appliquées (option A + précisions validées)

- `barber_profiles.timezone` nullable, sans valeur par défaut, sans backfill :
  les profils existants restent `NULL`. Aucun fuseau inventé.
- Choix explicite uniquement, jamais déduit du pays ni du navigateur ; un fuseau
  devra être renseigné avant de pouvoir réserver (lot ultérieur).
- API : `absent` = valeur conservée (création → NULL) ; `null` ou chaîne vide
  après trim = effacement explicite ; valeur non vide invalide = 400
  `VALIDATION_ERROR` sans écriture partielle.
- Validation : `UTC` accepté explicitement ; sinon identifiant nommé contenant
  `/` validé par `Intl.DateTimeFormat` ; offsets (`+01:00`) et abréviations
  seules (`CET`) refusés ; `Etc/…` refusé sans distinction de casse
  (restriction produit volontaire — état `restricted` dédié, jamais présenté
  comme « invalide ») ; casse corrigée via la liste canonique
  (`Intl.supportedValuesOf`) ; alias avec `/` reconnu par Intl conservé tel
  quel, jamais `resolvedOptions().timeZone`.
- Pas d'exposition publique (profil public et recherche inchangés).
  `DashboardPage` hors périmètre. `WorkingHoursResponse` inchangé : le bandeau
  horaires charge le profil par un GET séparé (état d'erreur distinct de
  « fuseau absent »).

## Fichiers créés

- `shared/src/timezones.ts` (liste canonique + `classifyIanaTimeZone`)
- `tests/src/migration-helpers.ts` (découverte d'une migration PAR CONTENU)
- `tests/src/timezone.test.ts`
- `tests/src/timezone.validation.test.ts`
- `tests/src/migration-timezone.test.ts`
- `server/drizzle/0005_cold_switch.sql` + `server/drizzle/meta/0005_snapshot.json`
  (générés par drizzle-kit, SQL relu et validé avant application)

## Fichiers modifiés

- `shared/src/constants.ts` (`LIMITS.profileTimezone = 64`)
- `shared/src/schema.ts` (colonne `timezone` + CHECK longueur)
- `shared/src/validation/barber.ts` (`timezoneSchema` 3 états)
- `shared/src/types.ts` (`OwnBarberProfile.timezone`)
- `shared/src/index.ts`, `shared/package.json` (export `./timezones`)
- `server/src/modules/barber/service.ts` (mapping + upsert absent/inchangé)
- `client/src/pages/barber/ProfilePage.tsx` (sélecteur groupé, UTC, option
  « valeur enregistrée », repli champ texte, avertissement)
- `client/src/pages/barber/WorkingHoursPage.tsx` (bandeau 3 états :
  fuseau renseigné / non renseigné / indisponible)
- `tests/src/barber.integration.test.ts` (+3 tests fuseau)
- `tests/src/migration-working-hours.test.ts` (cible trouvée par contenu, plus
  par la dernière entrée du journal)
- `README.md`, `suiviDeepseek.md`
- `server/drizzle/meta/_journal.json` (entrée 0005, générée)

## Migration

`0005_cold_switch.sql` : `ALTER TABLE "barber_profiles" ADD COLUMN "timezone"
text;` + `ADD CONSTRAINT "barber_profiles_timezone_length" CHECK ("timezone" IS
NULL OR char_length("timezone") <= 64)`. Purement additive, relue avant
application. Appliquée sur la base locale de développement PGlite
(`server/data/pglite`) uniquement : `NODE_ENV` absent du `.env` (défaut
`development`) → pilote pglite ; `DATABASE_URL` du `.env` ignoré en dev. Aucune
base distante, aucun reset, aucune suppression de données.

## Commandes exécutées et résultats réels

| Commande | Résultat |
|---|---|
| `npm run db:generate` | ✅ `0005_cold_switch.sql` (affichée et validée avant application) |
| `npm run db:migrate` | ✅ appliquée sur la base PGlite locale de dev |
| `npm run typecheck` | ✅ shared + server + client |
| `npm run lint` | ✅ 0 erreur, 0 warning |
| `npm test` | ✅ **162/162** (14 fichiers) — +19 : timezone 7, timezone.validation 8, migration-timezone 1, barber.integration +3 |
| `npm run build` | ✅ server `dist/index.js` 57.09 KB + client (index gzip 91.19 Ko, +~1,3 Ko) |

## Tests ajoutés / adaptés

- Helper (7) : liste + UTC (absent de `supportedValuesOf`), vide ≠ invalide,
  casse canonique, alias conservé sans épingler une version d'ICU (`US/Eastern`
  vérifié conditionnellement), `Etc/…` → `restricted`, rejets `+01:00`, `+23`,
  `-2359`, `CET`, `GMT`, `Mars/Olympus`, `Europe/Zurich/Extra`.
- Zod (8) : absent → `undefined` ; `null`/vide → `null` ; normalisation ;
  rejets sans conversion silencieuse ; `Etc/…` ; longueur > 64 ; `.strict()`.
- Intégration (3 nouveaux) : cycle create/update/keep/clear ; PUT invalide
  (7 valeurs dont > 64) → 400 sans écriture partielle ; `utc` → `UTC` et alias
  reconnu conservé tel quel.
- Migrations : `migration-working-hours.test.ts` et `migration-timezone.test.ts`
  identifient leur cible PAR CONTENU du SQL (`CREATE TABLE
  "barber_working_hours"` / `ADD COLUMN "timezone"`), sans dépendre de la
  dernière entrée du journal.
- Isolation des tests : `NODE_ENV=test` + `PGLITE_DATA_DIR=""` → PGlite en
  mémoire par fichier ; la base de développement n'est jamais touchée.

## Limites non testées / points ouverts

- Rendu navigateur non vérifié (pas de navigateur pilotable dans
  l'environnement) : sélecteur groupé, repli champ texte sans
  `Intl.supportedValuesOf`, injection « valeur enregistrée », bandeau horaires
  (3 états) et avertissement du profil — à vérifier manuellement.
- Concurrence `ON CONFLICT DO UPDATE` (branche absent/inchangé) non démontrable
  sous PGlite (mono-connexion) : à valider sur PostgreSQL réel, comme au lot 5.
- PostgreSQL de production non testé de bout en bout (PGlite seul).
- Drift ICU : une valeur stockée absente de la liste locale est conservée par
  injection d'option côté client ; le moteur de créneaux futur devra traiter
  une valeur devenue inconnue d'ICU comme un état d'erreur explicite.
- `package-lock.json` et les fins de ligne CRLF préexistants volontairement non
  touchés (aucune normalisation, aucune réinstallation).

## Correctif ciblé — bouton « Réessayer » du bandeau fuseau (non commité)

Défaut : le bouton « Réessayer » du bandeau fuseau appelait `loadData` (chargeur
de la page) → `applyIntervals` + `setRowErrors({})` + `setError(null)` +
`setLoading(true)` : un brouillon d'horaires non enregistré et les erreurs de
ligne étaient écrasés, et le message du planning effacé.

Correctif (`client/src/pages/barber/WorkingHoursPage.tsx` uniquement) :
`retryTimezone` dédié (GET `/profile` seulement), garde synchrone `useRef`
libérée dans `finally`, `timezoneStatus="loading"` pendant la relance, bouton
rebranché. La relance ne touche ni `days`, ni `rowErrors`, ni `error`/`success`,
ni le loading global. Chargement initial (`loadData`, `Promise.allSettled`)
inchangé ; contrats API inchangés.

Vérifications réellement exécutées : `npm run typecheck`, `npm run lint`,
`npm test` (162/162), `npm run build` — voir résultats du rapport de lot 6A.

Scénario navigateur : **à vérifier manuellement** (pas de navigateur pilotable).
Procédure : bloquer `*/api/barber/profile` puis recharger `/pro/working-hours`
(horaires OK, bandeau « indisponible » + Réessayer) ; modifier une plage ;
**vider un champ puis cliquer « Enregistrer »** pour déclencher la validation
locale — vider un champ seul n'affiche pas forcément d'erreur de ligne ; cliquer
« Réessayer » et vérifier que brouillon, erreur de ligne et messages du planning
restent strictement identiques, qu'une seule requête `GET /profile` parte, et
que le bandeau passe à « Heures locales du salon (…) » après déblocage.

---

# Suivi — lot 7 : indisponibilités / fermetures exceptionnelles (issue #22, passe 1)

État : code et tests écrits sur `main`, migration **générée mais NON appliquée**.
Aucune branche, aucun commit, push, PR ni changement d'issue. `npm test` et
`npm run db:migrate` **volontairement non exécutés** (arrêt obligatoire avant
application/validation du SQL). Aucune base distante touchée.

## Périmètre validé et appliqué

- Fermetures en journées entières, `startDate` / `endDate` incluses, format
  `AAAA-MM-JJ`. Journée unique = même date.
- Stockage PostgreSQL `date`, mapping Drizzle explicite en chaînes
  (`date("...", { mode: "string" })`). Aucune conversion de fuseau à
  l'écriture/lecture, aucun recours à `Date` local, donc aucun effet du DST.
- Temps du professionnel (pas forcément un salon), libellés neutres :
  « Mes indisponibilités », « Votre fuseau horaire », « Jours indisponibles ».
- Motif facultatif et privé : trim, vide → `null`, maximum 500 caractères.
- Période maximale 366 jours inclus ; maximum 200 périodes par professionnel.
- Dates passées autorisées ; création autorisée sans fuseau (avertissement UI).
- Doublons et chevauchements inclusifs refusés → 409 `TIME_OFF_OVERLAP` ;
  périodes adjacentes sans jour commun autorisées.
- Changement de fuseau : dates civiles inchangées, aucune réécriture.
- Pas de PATCH ni d'édition automatique ; aucun droit ADMIN ; aucune exposition
  publique du motif. Hors périmètre : modes de prestation #19, pauses
  récurrentes, réservations, notifications.

## Routes

- `GET /api/barber/time-off` → `{ timeOff: TimeOff[] }`, tri stable
  `start_date`, puis `end_date`, puis `id`.
- `POST /api/barber/time-off` → 201 `{ timeOff }` (CSRF).
- `DELETE /api/barber/time-off/:timeOffId` → 204 (CSRF), 404 si inexistant ou
  appartenant à un autre professionnel.

## Fichiers créés

- `shared/src/dates.ts` (helpers calendaires purs : validité, comparaison,
  nombre de jours inclus en UTC)
- `client/src/lib/date.ts` (affichage `AAAA-MM-JJ` → `JJ.MM.AAAA` sans décalage)
- `client/src/pages/barber/TimeOffPage.tsx`
- `tests/src/dates.test.ts`, `tests/src/time-off.validation.test.ts`,
  `tests/src/time-off.integration.test.ts`, `tests/src/migration-time-off.test.ts`
- `server/drizzle/0006_glorious_pretty_boy.sql` +
  `server/drizzle/meta/0006_snapshot.json` (générés par drizzle-kit)

## Fichiers modifiés

- `shared/src/constants.ts` (`LIMITS.timeOffReason=500`,
  `timeOffMaxRangeDays=366`, `timeOffMaxPerBarber=200`)
- `shared/src/schema.ts` (table `barber_time_off`, types)
- `shared/src/types.ts` (`TimeOff`, `TimeOffResponse`)
- `shared/src/validation/barber.ts` (`timeOffCreateSchema`, `.strict()`, dates
  réelles, `start <= end`, plage max, motif)
- `shared/src/index.ts`, `shared/package.json` (export `./dates`)
- `server/src/db/client.ts` (table enregistrée dans `schema`)
- `server/src/modules/barber/service.ts` (`listTimeOff`, `createTimeOff` avec
  verrou `FOR UPDATE` du profil avant plafond puis chevauchement, `deleteTimeOff`
  scoped id + profil ; traduction d'une violation d'unicité en
  `TIME_OFF_OVERLAP`, jamais `EMAIL_TAKEN`)
- `server/src/modules/barber/routes.ts` (3 routes, auth + rôle + CSRF)
- `client/src/lib/apiClient.ts` (méthodes `getTimeOff`/`createTimeOff`/
  `deleteTimeOff` ; 204 déjà géré en tête de `apiFetch`)
- `client/src/app/router.tsx` (route `/pro/time-off`)
- `client/src/pages/barber/DashboardPage.tsx` (carte « Mes indisponibilités »)

## Migration générée (relue, NON appliquée)

`server/drizzle/0006_glorious_pretty_boy.sql` : `CREATE TABLE
"barber_time_off"` (id text PK, FK `barber_profile_id` → `barber_profiles` ON
DELETE CASCADE, `start_date`/`end_date date NOT NULL`, `reason text`,
timestamps), 3 CHECK (`start_date <= end_date`, `end_date - start_date <= 365`,
`reason` NULL ou `char_length <= 500`), index
`(barber_profile_id, start_date)`, index unique
`(barber_profile_id, start_date, end_date)`. Purement additive : aucune
retouche de `0000`–`0005`, aucun backfill. Le CHECK de durée utilise une valeur
littérale (`sql.raw`) et non un paramètre (interdit dans un CHECK).

## Commandes réellement exécutées et résultats

| Commande | Résultat |
|---|---|
| `npm run typecheck` | ✅ shared + server + client |
| `npm run db:generate` | ✅ `0006_glorious_pretty_boy.sql` générée (relue) |
| `npm run lint` | ✅ 0 erreur, 0 warning |
| `npm run build` | ✅ server `dist/index.js` 64.69 KB ; client `index` gzip 93.14 Ko (+~2 Ko) |
| `npm test` | ⛔ **non exécuté** (arrêt avant migration) |
| `npm run db:migrate` | ⛔ **non exécuté** (arrêt avant validation du SQL) |

## En attente de validation

1. Relecture/validation du SQL `0006_glorious_pretty_boy.sql` par l'utilisateur.
2. Après validation seulement : `npm run db:migrate`, puis `npm test`
   (les tests d'intégration et de migration appliquent les migrations sur
   PGlite en mémoire), puis smoke test local éventuel.
3. Rendu navigateur de `/pro/time-off` non vérifié (pas de navigateur
   pilotable) : formulaire, confirmation de suppression, bandeau fuseau 3 états,
   conservation du formulaire en cas d'échec — à vérifier manuellement.
4. Concurrence réelle PostgreSQL non prouvée : PGlite exécute les transactions
   via un mutex mono-connexion ; le verrou `FOR UPDATE` du profil reste à
   valider sur une vraie base Postgres (comme aux lots 5 et 6A).
5. Formulaire non persisté au rechargement ; pas de limite UI au-delà du
   `maxLength` du motif et du message « 366 jours ».

---

# Suivi — lot 7 : passe 2 (application et vérifications) — issue #22

État : SQL `0006_glorious_pretty_boy.sql` validé par l'utilisateur et **appliqué
sur la base PGlite locale de développement**. Vérifications complètes exécutées.
Aucune branche, commit, push, PR ni changement d'issue ; #22 et #2 restent
ouvertes.

## Environnement cible confirmé

- `NODE_ENV` non défini dans le shell ni dans `.env` → valeur par défaut
  `development` → `driverKind = "pglite"`. `DATABASE_URL` présent dans `.env`
  mais **ignoré en développement** ; aucune base distante/production utilisée.
- `PGLITE_DATA_DIR=./data/pglite`, résolu (cwd = `server/`) en
  `server/data/pglite`. Cible = base PGlite locale de développement.
- Aucun processus `node.exe`/`tsx` en cours avant la sauvegarde et l'application
  → aucun écrivain concurrent dans PGlite.

## Sauvegarde préalable

- Copie récursive de `server/data/pglite` (1008 fichiers, ~39 Mo) vers
  `C:/Users/mathi/AppData/Local/Temp/findbarber-pglite-backup-20261001-204702`,
  **hors dépôt et non versionnée**. Après application : 1013 fichiers dans la
  base de dev (migration), tests isolés en mémoire.

## Commande d'application

- `npm run db:migrate` → `[migrate] Migrations applied.`

## Résultats réels des commandes

| Commande | Résultat |
|---|---|
| `npm run db:migrate` | ✅ appliquée sur PGlite locale de dev |
| `npm run typecheck` | ✅ shared + server + client |
| `npm run lint` | ✅ 0 erreur, 0 warning |
| `npm test` | ✅ **199/199** (18 fichiers) — +37 : dates 8, validation 11, intégration 17, migration 1 |
| `npm run build` | ✅ server `dist/index.js` 64.69 KB ; client `index` gzip 93.14 Ko |

Isolation des tests : `tests/setup.ts` force `NODE_ENV=test` et
`PGLITE_DATA_DIR=""` avant l'import de `server/src/config/env.ts` → PGlite en
mémoire par fichier. Les tests n'ont pas touché `server/data/pglite` (1013
fichiers après migration, inchangé par les tests) ni aucune base distante.

## Tests confirmés

- Journée unique, période, dates bissextiles (validation + intégration +
  helpers de dates).
- 366 jours inclus acceptés, 367 refusés (validation, API, contrainte DB).
- Doublons/chevauchements refusés (409 `TIME_OFF_OVERLAP`), périodes adjacentes
  acceptées.
- Plafond de 200 périodes (201e refusée, 409 `TIME_OFF_LIMIT_REACHED`).
- Auth (401), rôle (403 CLIENT), CSRF (403 `CSRF_INVALID`), propriété et
  isolation entre professionnels (404 sur l'id d'autrui).
- Suppression et réponse 204.
- Dates civiles inchangées après ajout/changement de fuseau.
- Motif absent des réponses publiques.
- Migration additive découverte par contenu, données préexistantes conservées,
  table `barber_time_off` vide avant insertion.

**Limite** : les tests de concurrence PGlite (mutex mono-connexion) ne
prouvent **pas** le comportement multi-connexions PostgreSQL ; le verrou
`FOR UPDATE` reste à valider sur une vraie base Postgres.

## Interface `/pro/time-off`

**Non exécutés** : aucun navigateur pilotable (ni Playwright, ni Puppeteer, ni
Cypress installés). Le rendu n'est **pas** déclaré validé. Procédure manuelle :

1. Se connecter en BARBER (`/pro`), créer un profil si besoin.
2. Aller sur `/pro/time-off` (ou carte « Mes indisponibilités » du dashboard).
3. Créer une journée unique (même date début/fin) → succès et apparition triée.
4. Créer une période puis tenter une période chevauchante → message d'erreur,
   formulaire conservé, liste intacte.
5. Cliquer « Supprimer » → confirmation ; « Annuler » ne supprime rien ;
   « Confirmer » supprime (204) et retire la ligne.
6. Couper le réseau (onglet Network → offline) puis « Ajouter » → message
   d'erreur, brouillon et données conservés.
7. Bandeau « Votre fuseau horaire » : renseigné / non renseigné / indisponible
   (bloquer `*/api/barber/profile` + « Réessayer » sans perdre le formulaire).

## Documentation README.md

Ajouts : 3 routes `time-off` dans la section API ; nouvelle section
« Indisponibilités / fermetures exceptionnelles (barber) » (dates inclusives,
366 jours, 200 périodes, motif privé 500 car., chevauchements, fuseau et
changement de fuseau sans réécriture, pas d'exposition publique).

## Échecs / points ouverts

- Aucun échec de test ou de build.
- Interface navigateur non testée (voir ci-dessus).
- Concurrence PostgreSQL multi-connexions non prouvée.
- PostgreSQL de production non testé de bout en bout (PGlite seul).

---

# Suivi — lot 7 : revue finale ciblée — issue #22

État : corrections limitées au helper de dates et à ses tests ; migration `0006`
**non régénérée ni modifiée**. Aucune branche, commit, push, PR ni changement
d'issue.

## Correction appliquée

`shared/src/dates.ts` → `splitCalendarDate` refuse désormais l'année `0000`
(`if (year < 1) return null;`) tout en conservant la gestion littérale des
années `0001..0099` (via `setUTCFullYear`, jamais `Date.UTC`). Le format à
quatre chiffres borne déjà l'année haute à `9999`. Cette règle s'applique donc
aussi à `isValidCalendarDate`, `toUtcMillis` et `inclusiveDayCount`. Aucun
changement de base de données (le type PostgreSQL `date` accepte déjà
0001..9999) ; migration inchangée.

## Tests ajoutés

- Helper : `0000-01-01` et `0000-02-29` refusés ; `0001`, `0099` acceptés ;
  `0099-02-29` refusé (99 non bissextile) ; `0400-02-29` accepté,
  `1900-02-29` refusé, `2000-02-29` accepté ; `9999-12-31` accepté.
- Helper : `inclusiveDayCount` sur années précoces (`0001`, `0099`,
  `0099-01-01`→`0100-01-01` = 366).
- Zod : année `0000` refusée ; années `0001` et `0099` acceptées.
- API : POST année `0000` → `400 VALIDATION_ERROR`, aucune insertion, aucune
  500 ; POST année `0099` → 201 avec dates exactes.
- Cas `0000` ajouté à la liste des payloads invalides (aucun résidu en base).

## Code relu (point 3)

- Signatures explicites : `createTimeOff(userId: string, input: TimeOffCreateInput): Promise<TimeOff>`,
  `deleteTimeOff(userId: string, timeOffId: string): Promise<void>`.
- Motif absent des DTO publics : `PublicBarberProfile`, `PublicBarberService`,
  `PublicBarberSearchItem`, `PublicBarberProfileWithServices` ne contiennent ni
  `reason` ni `timeOff` ; `reason` n'existe que dans `TimeOff` (privé).
- DELETE 204 : `apiFetch` court-circuite avant toute lecture JSON
  (`if (res.status === 204) return undefined as T;`).
- Suppression annulée sans requête : bouton « Annuler » → `setConfirmingId(null)`
  uniquement.
- Relance du fuseau sans effacement du brouillon : `retryTimezone` n'appelle que
  `GET /profile` et ne touche ni au formulaire, ni à la liste, ni aux messages.

## Résultats réels (revue finale)

| Commande | Résultat |
|---|---|
| `npm run typecheck` | ✅ shared + server + client |
| `npm run lint` | ✅ 0 erreur, 0 warning |
| `npm test` | ✅ **204/204** (18 fichiers) — +5 (dates +2, validation +1, intégration +2) |
| `npm run build` | ✅ server `dist/index.js` 64.73 KB ; client `index` gzip 93.14 Ko |

Tests navigateur : **non exécutés** (aucun navigateur pilotable). Rendu non
déclaré validé.

---

# Suivi — lot 8 : lieux de prestation et localisation approximative (issue #19, passe 1)

État : code, tests et documentation écrits sur `main`. Migration `0007` **générée
mais NON appliquée**. Passe limitée au sous-lot « profils, zones et recherche ».
Aucune branche, commit, push, PR ni changement d'issue. `npm test` et
`npm run db:migrate` **volontairement non exécutés** (arrêt avant validation du SQL).

## Décisions appliquées

- Trois modes cumulables **au niveau du profil** : `SALON`, `AT_PROVIDER`,
  `AT_CLIENT` (constants partagées + libellés). Pas de mode par prestation.
- Au moins un mode requis à la création et à chaque PUT du profil ; profils
  historiques laissés sans mode (aucune attribution automatique).
- Adresse privée obligatoire si `SALON` ou `AT_PROVIDER`, facultative pour
  `AT_CLIENT` seul (vide → `null`).
- `travelRadiusKm` entier 1..100, requis si et seulement si `AT_CLIENT` ; `null`
  sinon (rayon non nul hors `AT_CLIENT` refusé côté serveur).
- Ville, pays et coordonnées de référence restent requis.
- Contrat public : `address` retirée des DTO/reponses ; coordonnées publiques
  **arrondies à deux décimales** via `server/src/lib/location.ts` ; le point privé
  exact n'est jamais exposé. Stockage jamais réécrit.
- Filtre `place` ajouté à `GET /api/barbers` ; sans filtre, les profils
  historiques restent renvoyés ; avec filtre, ceux sans mode correspondant sont
  exclus.
- Horaires et indisponibilités inchangés (communs au professionnel).

## Fichiers créés

- `server/src/lib/location.ts` (arrondi public, ne garantit pas l'anonymat)
- `tests/src/service-places.validation.test.ts`
- `tests/src/service-places.integration.test.ts`
- `tests/src/migration-service-places.test.ts`
- `server/drizzle/0007_fantastic_kid_colt.sql` + `server/drizzle/meta/0007_snapshot.json`

## Fichiers modifiés

- `shared/src/constants.ts` (`SERVICE_PLACES`, `SERVICE_PLACE_LABELS`,
  `APPROXIMATE_LOCATION_LABEL`, `APPROXIMATE_DISTANCE_LABEL`, bornes du rayon)
- `shared/src/schema.ts` (enum `service_place`, table `barber_profile_places`,
  `address` nullable, `travel_radius_km` + CHECK)
- `shared/src/types.ts` (DTO public sans `address`, `places`, `travelRadiusKm`
  privé)
- `shared/src/validation/barber.ts` (`placeListSchema`, `profileSchema`
  conditionnel, filtre `place`)
- `server/src/db/client.ts` (table enregistrée)
- `server/src/modules/barber/service.ts` (`loadPlaces`, mappings, `upsertProfile`
  transactionnel, recherche, filtre)
- `client/src/lib/apiClient.ts` (`place` dans `BarbersSearchParams`)
- `client/src/pages/barber/ProfilePage.tsx` (cases lieux, adresse privée, rayon)
- `client/src/pages/client/BarberProfilePage.tsx` (badges lieux, plus d'adresse)
- `client/src/pages/client/BarbersSearchPage.tsx` (filtre lieu, badges, mentions)
- `client/src/components/BarbersMapCard.tsx` (badges lieux, localisation
  approximative)
- Tests existants adaptés (`places` par défaut dans les payloads, coordonnées
  approximatives attendues, adresse absente du public)
- `README.md`

## Migration générée (relue, NON appliquée)

`0007_fantastic_kid_colt.sql` : `CREATE TYPE service_place`, `CREATE TABLE
barber_profile_places` (PK composite, FK CASCADE, index `place`),
`ALTER TABLE barber_profiles ALTER COLUMN address DROP NOT NULL`,
`ADD COLUMN travel_radius_km integer`, CHECK `travel_radius_km IS NULL OR BETWEEN
1 AND 100`. Non destructive, aucun backfill de lieu.

## Commandes réellement exécutées (passe 1)

| Commande | Résultat |
|---|---|
| `npm run typecheck` | ✅ shared + server + client |
| `npm run db:generate` | ✅ `0007_fantastic_kid_colt.sql` (relue) |
| `npm run lint` | ✅ 0 erreur, 0 warning |
| `npm run build` | ✅ server `dist/index.js` 70.17 KB ; client `index` gzip 94.33 Ko |
| `npm test` | ⛔ non exécuté (arrêt avant migration) |
| `npm run db:migrate` | ⛔ non exécuté (arrêt avant validation du SQL) |

## En attente de validation

1. Validation du SQL `0007_fantastic_kid_colt.sql` puis `npm run db:migrate`.
2. `npm test` (migrations appliquées en mémoire par les tests).
3. Rendu navigateur `/pro/profile`, profil public et recherche (filtre lieu)
   **non vérifié** (aucun navigateur pilotable).
4. Concurrence réelle PostgreSQL non démontrée (PGlite mono-connexion).
5. Ce sous-lot ne termine pas #19 : restent le choix du lieu à la réservation,
   l'adresse client privée et ses autorisations, le refus hors zone côté serveur
   et la prise en compte des déplacements.

---

# Suivi — lot 8 : passe 2 (application et vérifications) — issue #19

État : SQL `0007_fantastic_kid_colt.sql` validé par l'utilisateur et **appliqué
sur la base PGlite locale de développement**. Ajustement UI demandé appliqué.
Aucune branche, commit, push, PR ni changement d'issue.

## Environnement cible confirmé

- `NODE_ENV` non défini (shell et `.env`) → défaut `development` → pilote
  `pglite`. `DATABASE_URL` présent mais ignoré en dev ; aucune base
  distante/production.
- `PGLITE_DATA_DIR=./data/pglite` → `server/data/pglite` (base locale de dev).
- Aucun processus `node.exe`/`tsx` en cours avant sauvegarde/application.
- Sauvegarde hors dépôt :
  `C:/Users/mathi/AppData/Local/Temp/findbarber-pglite-backup-20261001-211229`
  (1013 fichiers, ~39 Mo), non versionnée.

## Ajustement UI (validé)

- Libellé isolé « Distance approximative » **retiré** de l'interface
  (`BarbersSearchPage.tsx`) ; « Localisation approximative » conservé.
- La règle des futures distances (position approximative + libellé
  `APPROXIMATE_DISTANCE_LABEL`) reste documentée dans `README.md`, pas affichée
  à vide.
- Helper `approximateCoordinate` : normalise `-0` en `0` (aucun zéro négatif).

## Commandes et résultats réels

| Commande | Résultat |
|---|---|
| `npm run db:migrate` | ✅ appliquée sur PGlite locale de dev |
| `npm run typecheck` | ✅ shared + server + client |
| `npm run lint` | ✅ 0 erreur, 0 warning |
| `npm test` | ✅ **231/231** (22 fichiers) |
| `npm run build` | ✅ server `dist/index.js` 70.21 KB ; client `index` gzip 94.32 Ko |

Tests ciblés #19 en verbose : **27/27** (`location` 5, `service-places.validation`
12, `service-places.integration` 9, `migration-service-places` 1).

Isolation des tests : `tests/setup.ts` force `NODE_ENV=test` et
`PGLITE_DATA_DIR=""` → PGlite **en mémoire** ; la base de dev et toute base
distante ne sont pas touchées.

## Vérifications ciblées couvertes

- Création mobile sans adresse ; `SALON`/`AT_PROVIDER` sans adresse (vide
  comprise) refusés ; `AT_CLIENT` sans rayon refusé ; rayons 1 et 100 acceptés,
  0/101/décimaux/chaîne refusés.
- Retrait d'`AT_CLIENT` avec rayon `null` : ancienne valeur effacée (mise à jour
  `travel_radius_km` inconditionnelle dans `upsertProfile`).
- Sans `AT_CLIENT`, rayon non nul refusé ; PUT avec lieux vides/absents refusé.
- Profils historiques conservés sans attribution automatique (migration) ;
  recherche sans filtre non régressée ; filtre `place` correct.
- Adresse absente des réponses publiques ; coordonnées publiques arrondies via
  le helper ; coordonnées privées et stockées inchangées.
- Coordonnées négatives et bornes `±90`/`±180` ; un arrondi déjà à deux
  décimales peut être égal à la valeur exacte (règle testée, pas d'inégalité
  systématique).
- Auth/rôle/CSRF/propriété ; non-régression horaires et indisponibilités.

## Migration sur profils préexistants (test)

`tests/src/migration-service-places.test.ts` : applique `0007` sur une base
peuplée (profil avec adresse + service + horaires + indisponibilité). Résultat :
profil/service/horaires/indisponibilité conservés, adresse historique intacte,
`barber_profile_places` vide, `travel_radius_km` NULL, relaxation `address`
fonctionnelle, CHECK 1..100 appliqué, enum et unicité vérifiés.

## Limites / suite

- Rendu navigateur (`/pro/profile`, profil public, filtre lieu) **non exécuté**
  (aucun navigateur pilotable).
- Concurrence PostgreSQL multi-connexions non démontrée (PGlite mono-connexion).
- Ce sous-lot **ne termine pas #19** : restent le choix du lieu à la réservation,
  l'adresse client privée et ses autorisations, le refus hors zone côté serveur
  et la prise en compte des déplacements.

---

# Suivi — lot 9 : réservation de base (issue #19, suite)

État : code, tests, README et migration écrits sur `main`. Migration `0008` **générée
mais NON appliquée** à la base PGlite de dev (vérifié : `bookings`/`booking_status`
absents). Aucune branche, commit, push, PR ni changement d'issue. Aucune interface
client de réservation dans ce lot.

## Décisions appliquées (validation utilisateur)

- **Pas de nouvel enum `booking_place`** : réutilisation de l'enum existant
  `service_place` (`SALON`, `AT_PROVIDER`, `AT_CLIENT`) pour `bookings.service_place`.
- **Enum complet des statuts** `booking_status` : `PENDING`, `CONFIRMED`, `CANCELLED`,
  `COMPLETED`, `NO_SHOW`. Seules les transitions sont câblées : création client →
  `PENDING` ; confirmation barber `PENDING` → `CONFIRMED` (pas d'auto-confirmation) ;
  annulation (`PENDING`/`CONFIRMED`) → `CANCELLED`. `COMPLETED`/`NO_SHOW` sans logique
  métier.
- **Snapshot barber minimal** figé à la création : `barber_display_name` (NOT NULL),
  `service_name` (NOT NULL), `service_description` (nullable), `duration_minutes`,
  `price_minor`, `currency`. Les colonnes `client_*` (adresse) sont nullables et
  inutilisées dans ce lot.
- **Délais figés** : délai minimal 30 min (`bookingLeadTimeMinutes`), horizon maximal
  60 jours (`bookingHorizonDays`), annulation client jusqu'à 2 h avant
  (`bookingClientCancelMinMinutes`) ; le barber annule sans limite.
- **Grille non fixe (pas de pas de 15 minutes)** : la grille suit la durée de la
  prestation. `computeBookingSlots` n'a plus de paramètre `stepMinutes` ; le pas est
  `durationMinutes`. Deux créneaux d'une même prestation ne se chevauchent donc jamais.

## Contrôle serveur strict

- Le client ne fournit que `barberId`, `serviceId`, `date`, `startMinute`, `place`
  (Zod `.strict()` : tout champ inconnu est rejeté). Aucun instant UTC, prix ni durée
  acceptés depuis le frontend.
- Le créneau est **recalculé** côté serveur et doit correspondre exactement à
  `startMinute` (hors grille → `409 SLOT_UNAVAILABLE`).
- Création dans une transaction avec verrou `SELECT … FOR UPDATE` sur le profil : les
  créations simultanées du même barber sont sérialisées ; l'anti-double-réservation est
  applicatif (pas de contrainte d'exclusion : `btree_gist` indisponible sous PGlite).
- Propriété vérifiée sur confirm/cancel/list (anti-IDOR, 404 sinon) ; rôles et CSRF
  contrôlés par les middlewares existants.

## Fichiers créés

- `server/src/modules/booking/routes.ts` + `service.ts`
- `shared/src/booking.ts` (moteur de créneaux pur)
- `shared/src/validation/booking.ts`
- `server/drizzle/0008_panoramic_inertia.sql` + `server/drizzle/meta/0008_snapshot.json`
- `tests/src/slots.test.ts`
- `tests/src/booking.validation.test.ts`
- `tests/src/booking.integration.test.ts`
- `tests/src/migration-bookings.test.ts`

## Fichiers modifiés

- `shared/src/constants.ts` (`BOOKING_STATUSES`, `ACTIVE_BOOKING_STATUSES`, bornes
  réservation ; suppression de `bookingSlotStepMinutes`)
- `shared/src/schema.ts` (enum `booking_status`, table `bookings`)
- `shared/src/types.ts` (`Booking`, `BookingSlotDto`, réponses)
- `shared/src/dates.ts` (`calendarDateToUtcMillis`, `weekdayFromCalendarDate`)
- `shared/src/timezones.ts` (`zonedTimeToUtc`, `utcToZonedParts`)
- `shared/src/index.ts`, `shared/src/validation/index.ts`, `shared/package.json`
  (exports `./booking`, validation booking)
- `server/src/app.ts` (`/api/bookings`)
- `server/src/db/client.ts` (table `bookings` enregistrée)
- `server/src/modules/barber/publicRoutes.ts` (`GET /api/barbers/:barberId/slots`)
- `server/drizzle/meta/_journal.json` (entrée 0008)
- `README.md` (routes + section « Réservations de base (lot 9) »)

## Migration générée (relue, NON appliquée)

`0008_panoramic_inertia.sql` : `CREATE TYPE booking_status` (5 valeurs), `CREATE TABLE
bookings` (24 colonnes, `service_place` réutilise l'enum `service_place`, snapshots,
CHECK période/prix/durée/lat/lon, FK CLIENT cascade / profil cascade / service restrict),
3 index (`(barber_profile_id, start_at)`, `(client_user_id, start_at)`, `status`).
`npm run db:generate` confirme « No schema changes » après coup. Non destructive,
additive uniquement, aucun backfill.

## Commandes réellement exécutées

| Commande | Résultat |
|---|---|
| `npm run typecheck` | ✅ shared + server + client |
| `npm run lint` | ✅ 0 erreur, 0 warning |
| `npm test` | ✅ **276/276** (26 fichiers) — +32 vs lot 8 |
| `npm run build` | ✅ server `dist/index.js` 91.28 KB ; client `index` gzip 94.47 Ko |
| `npm run db:generate` | ✅ « No schema changes, nothing to migrate » |
| `npm run db:migrate` | ⛔ non exécuté (SQL non validé, voir ci-dessous) |

## Points de vigilance / suite

- SQL `0008` **non appliqué** : en attente de validation utilisateur avant
  `npm run db:migrate` (même processus que les lots précédents).
- Sémantique « grille non fixe » interprétée comme **pas = durée de la prestation** ;
  à confirmer si un pas configurable par professionnel est attendu plus tard.
- Concurrence PostgreSQL multi-connexions non démontrée (PGlite mono-connexion) ; le
  verrou applicatif est le seul filet en production (pas de contrainte d'exclusion).
- Rendu navigateur non exécuté (aucun navigateur pilotable) ; aucune UI de réservation
  dans ce lot.
- Restent hors lot : interface client, `COMPLETED`/`NO_SHOW`, adresse client privée et
  autorisations, refus hors zone et temps de déplacement (#19).

---

# Suivi — lot 9 : passe 2 (application et vérifications) — issue #19

État : SQL `0008_panoramic_inertia.sql` validé par l'utilisateur et **appliqué sur la
base PGlite locale de développement**. Aucune branche, commit, push, PR ni changement
d'issue.

## Environnement

- Aucun processus serveur/dev en cours : les deux `node.exe` présents sont l'agent
  d'exécution lui-même, pas un serveur tenant la base ouverte.
- `NODE_ENV` non défini → défaut `development` → pilote `pglite` ; `PGLITE_DATA_DIR`
  `./data/pglite` → `server/data/pglite` (base locale de dev).

## Commandes et résultats réels

| Commande | Résultat |
|---|---|
| `npm run db:migrate` | ✅ `[migrate] Migrations applied.` |
| `npm test` | ✅ **276/276** (26 fichiers) |
| `npm run build` | ✅ server `dist/index.js` 91.28 KB ; client `index` gzip 94.47 Ko |
| `npm run db:generate` | ✅ « No schema changes, nothing to migrate » (aucune migration 0009 générée) |

## Vérifications post-migration

- Table `bookings` présente dans la base de dev : 24 colonnes dont `service_place` de
  type `service_place` (enum réutilisé) et `status` de type `booking_status`.
- Aucune dérive de schéma : `npm run db:generate` ne produit aucun nouveau fichier et
  le journal reste sur l'entrée `0008`.
- Aucune migration supplémentaire dans `server/drizzle/` ni dans `git status`.

## Limites / suite (inchangées)

- Concurrence PostgreSQL multi-connexions non démontrée (PGlite mono-connexion) ; le
  verrou applicatif est le seul filet en production.
- Rendu navigateur non exécuté ; aucune UI de réservation dans ce lot.
- Restent hors lot : interface client, `COMPLETED`/`NO_SHOW`, adresse client privée et
  autorisations, refus hors zone et temps de déplacement (#19).

---

# Suivi — lot 9 passe A : flux privé « prestation chez le client » (issue #19)

État : code, tests et documentation écrits sur `main`. Migration **NON générée ni
appliquée** (instruction : présenter le SQL avant `db:generate`/`db:migrate`). Aucune
branche, commit, push, PR ni issue. `npm test`, `npm run build`, `npm run lint`,
`db:generate` et `db:migrate` volontairement NON lancés. `npm run typecheck` exécuté ✅.

## Décisions appliquées

- `AT_CLIENT` : `clientAddress` obligatoire (Zod), géocodée côté serveur, refus hors
  rayon via `travel_radius_km` (`409 OUT_OF_SERVICE_AREA`).
- `SALON` / `AT_PROVIDER` : `clientAddress` refusée (400) et rien n'est stocké.
- Adresse et coordonnées exactes client privées : exposées uniquement au CLIENT
  propriétaire, au BARBER concerné et à ADMIN, via `GET /api/bookings/:bookingId`.
  Jamais dans les listes ni les routes publiques.
- Coordonnées client jamais acceptées du navigateur : seules celles du géocodeur
  serveur font foi.
- Abstraction de géocodage injectable (`server/src/lib/geocoding.ts`), fournisseur
  MapTiler uniquement si `MAPTILER_GEOCODING_API_KEY` présente ; timeout 5 s ;
  erreurs `ADDRESS_NOT_FOUND` (404) et `GEOCODING_UNAVAILABLE` (503) ; aucune fuite
  de l'adresse dans les messages.
- Distance Haversine pure + validation de coordonnées dans `server/src/lib/location.ts`
  (message d'erreur générique, aucune coordonnée privée).

## Fichiers créés

- `server/src/lib/geocoding.ts`
- `tests/src/geocoding.test.ts`
- `tests/src/booking-at-client.test.ts`

## Fichiers modifiés

- `shared/src/schema.ts` (CHECK `bookings_client_coordinates_together`)
- `shared/src/constants.ts` (`LIMITS.clientAddress = 200`)
- `shared/src/validation/booking.ts` (`clientAddress` conditionnel AT_CLIENT)
- `shared/src/types.ts` (`BookingDetails`)
- `server/src/lib/location.ts` (Haversine + validation coordonnées)
- `server/src/config/env.ts` (`MAPTILER_GEOCODING_API_KEY` optionnelle)
- `server/src/modules/booking/service.ts` (géocodage/zone + `getBookingDetails`)
- `server/src/modules/booking/routes.ts` (`GET /api/bookings/:bookingId`)
- `.env.example` (variable serveur MapTiler documentée, sans clé)
- `README.md` (routes + section AT_CLIENT/privée)
- `tests/src/location.test.ts` (Haversine + validation)

## Migration attendue (NON générée — SQL prévisionnel)

```sql
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_client_coordinates_together" CHECK (("bookings"."client_latitude" IS NULL) = ("bookings"."client_longitude" IS NULL));
```

Additive uniquement, aucune colonne ajoutée (les colonnes `client_*` existent déjà
depuis le lot 9), pas de trigger, pas de renommage.

## Variables d'environnement

- `MAPTILER_GEOCODING_API_KEY` (serveur, secrète, optionnelle). Absente → géocodage
  indisponible, réservations AT_CLIENT refusées (`503 GEOCODING_UNAVAILABLE`).

## Routes / DTO

- Nouvelle route : `GET /api/bookings/:bookingId` (auth + CLIENT/BARBER/ADMIN), renvoie
  `BookingDetails` (adresse + coordonnées) au seul propriétaire autorisé, 404 sinon.
- `POST /api/bookings` accepte `clientAddress` uniquement pour `AT_CLIENT`.
- `Booking` (public) inchangé ; `BookingDetails extends Booking` privé.

## Stratégie de tests

- `tests/src/geocoding.test.ts` : MapTilerGeocoder avec `fetch` mocké (succès, vide →
  ADDRESS_NOT_FOUND, HTTP 500/réseau → GEOCODING_UNAVAILABLE, coordonnées invalides) +
  injection `setGeocoder`.
- `tests/src/booking-at-client.test.ts` : intégration supertest avec géocodeur injecté —
  adresse manquante (400), dans le rayon (201 + persistance + détail propriétaire),
  hors rayon (409 OUT_OF_SERVICE_AREA), géocodeur indisponible (503) / introuvable
  (404), SALON/AT_PROVIDER sans adresse + refus, détail CLIENT/BARBER/ADMIN autorisés,
  autre client/barber 404, aucune fuite dans les routes publiques.
- `tests/src/location.test.ts` : Haversine (0, Genève→Zurich ≈ 224 km, symétrie) et
  validation de coordonnées.

## Commandes NON lancées (attente validation)

`npm run lint`, `npm test`, `npm run build`, `npm run db:generate`, `npm run db:migrate`.

## Risques / décisions restantes

- Le géocodage réel MapTiler n'est pas testé de bout en bout (aucun appel HTTP en test).
- `clientCity`/`clientPostalCode`/`clientCountryCode` restent non renseignés (seule
  l'adresse libre + les coordonnées sont stockées) : à décider si le géocodeur doit
  renvoyer aussi les composants structurés.
- La limite de longueur d'adresse est appliquée côté Zod (`LIMITS.clientAddress = 200`),
  pas en CHECK SQL (convention existante : `profileAddress` également sans CHECK).

---

# Suivi — lot 10 : UI de réservation complète (client + barber)

État : interface client construite sur le backend de réservation existant. Aucun
commit / branche / push / PR / issue. Aucune modification du backend métier. Tests,
lint, build, typecheck et migrations volontairement NON lancés (attente validation).

## Décisions appliquées

- Aucun endpoint inventé : seuls les endpoints réels sont consommés
  (`GET /api/barbers/:barberId/slots`, `POST /api/bookings`, `GET /api/bookings`,
  `GET /api/bookings/:bookingId`, `POST /api/bookings/:bookingId/confirm`,
  `POST /api/bookings/:bookingId/cancel`).
- Adresse privée : jamais affichée dans les listes ; uniquement sur le détail
  (`GET /api/bookings/:bookingId`) pour une réservation `AT_CLIENT`, à la demande.
- Validation serveur = source de vérité ; validation frontend limitée au blocage
  des soumissions incomplètes (service, lieu, date, créneau, adresse si AT_CLIENT).
- Erreurs serveur affichées telles quelles (message déjà en français).

## Fichiers créés

- `client/src/lib/booking.ts` (validation du formulaire + helpers de dates locales)
- `client/src/components/BookingForm.tsx`
- `client/src/components/BookingStatusBadge.tsx`
- `client/src/pages/client/BookingsPage.tsx` (Mes rendez-vous)
- `client/src/pages/barber/BookingsPage.tsx` (gestion des réservations barber)
- `tests/src/booking-form.test.ts`

## Fichiers modifiés

- `client/src/lib/apiClient.ts` (bookingApi + getSlots)
- `client/src/lib/formatters.ts` (formatDateTime)
- `client/src/pages/client/BarberProfilePage.tsx` (intégration BookingForm)
- `client/src/pages/client/HomePage.tsx` (lien Mes rendez-vous)
- `client/src/pages/barber/DashboardPage.tsx` (carte Mes réservations)
- `client/src/app/router.tsx` (routes /appointments et /pro/bookings)
- `README.md`, `suiviDeepseek.md`

## Routes UI ajoutées

- `/appointments` — CLIENT : liste de ses réservations, annulation, adresse privée
  AT_CLIENT sur le détail uniquement.
- `/pro/bookings` — BARBER : demandes PENDING/CONFIRMED/CANCELLED, confirmation,
  annulation, adresse privée AT_CLIENT sur le détail uniquement.
- `/barbers/:barberId` — ajout du formulaire de réservation public.

## Commandes NON lancées (attente validation)

`npm run typecheck`, `npm run lint`, `npm test`, `npm run build`.

## Risques / points d'attention

- La date affichée d'un rendez-vous est formatée dans le fuseau local du visiteur
  (le fuseau du barber n'est pas exposé publiquement) ; la sélection de créneau, elle,
  affiche bien la minute murale (`startMinute`) choisie.
- Le login ne conserve pas la page de retour : un visiteur non connecté est invité à
  se connecter puis revient manuellement sur le profil pour réserver.

---

# Suivi — lot 11 : avis post-rendez-vous et statut COMPLETED

État : backend + interface réalisés sur la base de réservation existante. Aucun
commit / branche / push / PR / issue. Typecheck, tests, lint et build volontairement
NON lancés (attente validation). Migration Drizzle `0010_*` générée (non appliquée).

## Décisions appliquées

- `POST /api/bookings/:bookingId/complete` : BARBER propriétaire uniquement,
  `CONFIRMED → COMPLETED` ; tout autre statut → 409 `INVALID_STATUS_TRANSITION` ;
  CLIENT/ADMIN → 403 (aucune convention ADMIN existante sur les réservations).
- `POST /api/bookings/:bookingId/review` : CLIENT propriétaire d'un booking `COMPLETED`
  uniquement. `barberId`/`clientId` jamais acceptés du body (Zod `.strict()`) : le
  barber noté est déduit du booking, l'auteur de la session.
- Avis unique par booking : index unique `reviews_booking_id` en base (protection
  finale contre la concurrence) + catch `isUniqueViolation` → 409 `REVIEW_ALREADY_EXISTS`.
- `Booking` n'embarque PAS l'avis complet : uniquement `hasReview: boolean` (décision
  passe B). Le commentaire/détail d'avis reste réservé à la lecture publique.
- `GET /api/barbers/:barberId/reviews` : public, paginé (page défaut 1, pageSize défaut
  5 max 20), whitelist `{ id, rating, comment, createdAt, clientName }`, moyenne
  arrondie à 2 décimales, `null` si aucun avis. Jamais d'email/adresse/bookingId/userId.
- Validation : `rating` entier 1..5 ; `comment` facultatif trimé ≤ 1000 (CHECK SQL en
  dernier ressort).

## Fichiers créés

- `shared/src/validation/review.ts`
- `server/src/modules/review/service.ts`
- `server/drizzle/0010_eminent_kat_farrell.sql` (+ snapshot + journal)
- `client/src/lib/review.ts`
- `client/src/components/ReviewForm.tsx`
- `tests/src/review.integration.test.ts`
- `tests/src/migration-reviews.test.ts`
- `tests/src/review-form.test.ts`

## Fichiers modifiés

- `shared/src/constants.ts` (`REVIEW_LIMITS`, `LIMITS.reviewRatingMin/Max`, `LIMITS.reviewComment`)
- `shared/src/schema.ts` (table `reviews`)
- `shared/src/types.ts` (`PublicReview`, `BarberReviewsSummary`, `BarberReviewsResponse`, `Booking.hasReview`)
- `shared/src/validation/barber.ts` (`integerParam` exporté)
- `shared/src/validation/index.ts` (export review)
- `server/src/db/client.ts` (`reviews` au schéma)
- `server/src/modules/booking/routes.ts` (`complete`, `review`)
- `server/src/modules/booking/service.ts` (`completeBooking`, `hasReview` dans listes/détail)
- `server/src/modules/barber/publicRoutes.ts` (`GET /:barberId/reviews`)
- `client/src/lib/apiClient.ts` (`complete`, `createReview`, `getReviews`)
- `client/src/pages/client/BookingsPage.tsx` (avis)
- `client/src/pages/barber/BookingsPage.tsx` (terminer)
- `client/src/pages/client/BarberProfilePage.tsx` (bloc avis)
- `README.md`, `suiviDeepseek.md`

## Commandes NON lancées (attente validation)

`npm run typecheck`, `npm run lint`, `npm test`, `npm run build`.
`npm run db:generate` a été lancé (génération de la migration `0010_*`) ;
`npm run db:migrate` n'a PAS été lancé.

## Risques / points d'attention

- Le détail `GET /api/bookings/:bookingId` renvoie `hasReview` (cohérent avec `Booking`),
  mais pas le contenu de l'avis.
- Le profil public charge les avis via un second appel (`getReviews`) pour rester paginable.
- La note moyenne est calculée en SQL (`avg(rating)::float8`) et arrondie en JS à 2 décimales.

---

# Suivi — lot 13 : policies d'autorisation et contrôle d'accès strict (anti-IDOR)

État : refactor d'autorisation ciblé sur l'ownership des réservations + tests et
documentation. Aucun commit / branche / push / PR / issue. Typecheck, tests, lint
et build volontairement NON lancés (attente validation). Aucune migration touchée.

## Décisions appliquées

- Nouvelle couche pure `server/src/lib/authorization.ts` : `AuthUser`,
  `BookingOwnership`, `bookingNotFound`, `isBookingClientOwner`,
  `isBookingBarberOwner`, `assertBookingReadAccess`, `assertBookingClientOwner`.
  Pas de framework générique ni de sur-abstraction.
- `requireRole` reste la source des refus globaux en **403** ; l'ownership renvoie
  toujours **404** (ressource inexistante ou non possédée) pour ne pas divulguer
  l'existence.
- Convention ADMIN inchangée : lecture du détail booking uniquement
  (`GET /api/bookings/:bookingId`), aucun autre droit.
- Résolution du profil barber de l'utilisateur connecté centralisée dans
  `booking/service.ts` (`findOwnBarberProfileId` / `requireOwnBarberProfileId`),
  utilisée par `listBookings`, `getBookingDetails`, `confirmBooking`,
  `completeBooking`, `cancelBooking`.
- Branches de rôle fragiles rendues explicites : `listBookings` et `cancelBooking`
  distinguent désormais `BARBER` / `CLIENT` / sinon `403 FORBIDDEN` (défensif).
- Mutations barber (services `:serviceId`, time-off `:timeOffId`) conservées en
  queries SQL scopées par profil (aucun SELECT d'ownership supplémentaire).
- Codes publics inchangés (`BARBER_NOT_FOUND` vs `BARBER_PROFILE_NOT_FOUND`).
- DTO publics et migrations non touchés.

## Fichiers créés

- `server/src/lib/authorization.ts`
- `tests/src/authorization.test.ts` (policies pures)
- `tests/src/authorization.integration.test.ts` (matrice anti-IDOR)

## Fichiers modifiés

- `server/src/modules/booking/service.ts` (helpers de profil + policies + branches explicites)
- `server/src/modules/review/service.ts` (`createReview` via `assertBookingClientOwner`)
- `server/src/modules/booking/routes.ts` (passage de `req.user` à la policy)
- `README.md` (section « Autorisation et anti-IDOR »)
- `suiviDeepseek.md`

## Convention d'erreurs documentée

- 401 : non authentifié.
- 403 : refus global de rôle, CSRF invalide, compte suspendu.
- 404 : ressource privée inexistante OU non possédée (anti-IDOR, pas de fuite).

## Plan de tests

- Unitaires : prédicats d'ownership et asserts (404 `BOOKING_NOT_FOUND` pour
  non-propriétaire / BARBER sans profil ; ADMIN autorisé en lecture seule).
- Intégration : client B / barber B sur réservation de A (détail, cancel, confirm,
  complete, review), refus de rôle (CLIENT/BARBER/ADMIN → 403), 401 anonyme,
  IDOR services et time-off (404), non-fuite de l'adresse `AT_CLIENT` dans les
  routes publiques.

## Commandes NON lancées (attente validation)

`npm run typecheck`, `npm test`, `npm run lint`, `npm run build`,
`npm run db:generate`, `npm run db:migrate`.

## Risques / points d'attention

- Aucune faille IDOR n'existait avant ce lot : il s'agit d'un durcissement et
  d'une centralisation, pas d'une correction de vulnérabilité active.
- `getBookingDetails` conserve le `404 BOOKING_NOT_FOUND` (et non
  `BARBER_PROFILE_NOT_FOUND`) lorsqu'un BARBER n'a pas de profil, pour ne rien
  divulguer.

---

# Suivi — issue #12 : durcissement HTTP (rate limiting, en-têtes, anti-brute-force)

État : passe B implémentée côté Express (helmet, trust proxy configurable,
3 rate limiters, `safeText`). Aucun commit / push / PR / issue / migration.
Commandes de vérification volontairement NON lancées (attente validation).
Aucune dépendance ajoutée autre que `helmet` (déclarée dans `server/package.json`,
pas encore installée).

## Décisions appliquées

- Helmet configuré pour `/api` uniquement : nosniff, X-Frame-Options DENY,
  Referrer-Policy no-referrer, CSP JSON `default-src 'none'`, suppression
  X-Powered-By. HSTS uniquement en `NODE_ENV=production`.
- `TRUST_PROXY_HOPS` optionnel, entier positif (`z.coerce.number().int().positive()`),
  jamais `true`. Absent → aucun trust proxy.
- 3 rate limiters distincts : login (60 s / 5), register (10 min / 5),
  mutations sensibles (`/api/bookings` + `/api/barber`, méthodes mutantes,
  15 min / 60). Skip par défaut en test tant qu'aucune option `rateLimits.*`.
- `safeText(max)` : trim + max + rejet des caractères de contrôle ; appliqué aux
  champs libres (nom, profil, services, time-off, adresse client, avis). Le texte
  n'est pas transformé.
- CSP SPA (MapLibre) documentée au niveau proxy (README), non appliquée par Express.

## Fichiers créés

- `server/src/middleware/security.ts`
- `server/src/middleware/rateLimit.ts`
- `shared/src/validation/safeText.ts`
- `tests/src/security-headers.test.ts`
- `tests/src/rate-limit.integration.test.ts`
- `tests/src/safe-text.validation.test.ts`

## Fichiers modifiés

- `server/src/app.ts` (helmet, trust proxy, 3 limiters, `AppOptions.rateLimits`)
- `server/src/config/env.ts` (LOGIN/REGISTER/MUTATION_RATE_LIMIT_*, TRUST_PROXY_HOPS)
- `server/package.json` (helmet)
- `shared/src/validation/{auth,barber,booking,review}.ts` (safeText)
- `shared/src/validation/index.ts` (export safeText)
- `tests/src/auth.integration.test.ts` (option `rateLimits.register`)
- `.env.example`, `README.md`, `suiviDeepseek.md`

## Commandes NON lancées (attente validation)

`npm install`, `npm run typecheck`, `npm test`, `npm run lint`, `npm run build`,
`npm run db:generate`, `npm run db:migrate`.

## Points d'attention

- `helmet` est déclaré mais **non installé** : `npm install` est requis avant
  typecheck/tests/build.
- La CSP SPA est documentée pour le proxy, non appliquée par Express (décision).
- `express-rate-limit` clé par IP ; derrière un proxy, renseigner
  `TRUST_PROXY_HOPS` pour éviter un bucket partagé.

---

# Suivi — issue #20 : statistiques et tableau de bord d'activité du barber

État : passe B implémentée (lot serveur + lot client minimal). Aucun commit /
push / PR / issue / migration / dépendance. Commandes de vérification
volontairement NON lancées (attente validation).

## Décisions appliquées

- Route `GET /api/barber/stats` réservée à BARBER (CLIENT et ADMIN → 403).
- `refused = CANCELLED + cancelled_by = BARBER` ; taux en fractions 0..1 sur le
  total de la période.
- `range=month` = du 1er du mois local au jour local courant ; plage custom max
  366 jours inclus.
- `topServices` compte toutes les réservations ; `busiest*` exclut les CANCELLED ;
  revenus = COMPLETED uniquement ; rating global permanent.
- Fuseau obligatoire → `409 BARBER_TIMEZONE_MISSING`.
- `computeBarberStats` pur (bucketing local via `utcToZonedParts`) ;
  `statsService.ts` orchestre seulement. Aucune donnée personnelle de client.

## Fichiers créés

- `shared/src/stats.ts`
- `shared/src/validation/stats.ts`
- `server/src/modules/barber/statsService.ts`
- `tests/src/barber-stats.test.ts`
- `tests/src/barber-stats.integration.test.ts`
- `client/src/pages/barber/StatsPage.tsx`

## Fichiers modifiés

- `shared/src/constants.ts` (STATS_RANGES, STATS_DEFAULT_RANGE, STATS_LIMITS)
- `shared/src/types.ts` (BarberStatsResponse + sous-types)
- `shared/src/validation/index.ts` (export stats)
- `shared/package.json` (export `./stats`)
- `server/src/modules/barber/routes.ts` (route GET /stats)
- `client/src/lib/apiClient.ts` (barberApi.getStats)
- `client/src/app/router.tsx` (route /pro/stats)
- `client/src/pages/barber/DashboardPage.tsx` (lien « Mes statistiques »)
- `README.md`, `suiviDeepseek.md`

## Commandes NON lancées (attente validation)

`npm install`, `npm run typecheck`, `npm test`, `npm run lint`, `npm run build`,
`npm run db:generate`, `npm run db:migrate`.

## Points d'attention

- Aucune migration : le lot lit uniquement les tables existantes (`bookings`,
  `reviews`, `barber_profiles`).
- Aucune dépendance : graphiques en CSS/Tailwind pur avec alternative textuelle.
- `appointmentsByWeek`/`appointmentsByMonth` comptent toutes les réservations
  (annulées incluses), comme le total de la période ; seuls les jours/heures
  « chargés » excluent les annulées.

---

# Suivi — issue #7 : administration & modération (LOT 1, API admin)

État : LOT 1 implémenté (migration, DTO/validation partagés, routes/service
admin, client apiAdmin, tests). Aucun commit / push / PR / fermeture d'issue.
Commandes de vérification volontairement NON lancées (attente validation).

## Décisions appliquées

- Suspension via `users.status` existant (pas de `suspended_at`/`suspended_reason`).
- Auto-suspension interdite ; dernier ADMIN actif protégé.
- Suspension d'un BARBER → annulation transactionnelle des réservations futures
  PENDING/CONFIRMED avec `cancelled_by = "ADMIN"` (`CANCELLED_BY_ADMIN`).
- Avis : masquage réversible via `reviews.hidden_at` (jamais de DELETE) ; lectures
  publiques et agrégats excluent les avis masqués.
- `GET /api/admin/barbers/:id/stats` réutilise `computeBarberStats` via un
  refactor minimal de `statsService` (`getBarberStatsForAdmin`).
- Mutations admin protégées par `requireAuth` + `requireRole("ADMIN")` +
  `csrfProtection` ; bucket mutations ajouté sur `/api/admin`.

## Migration ajoutée

- `0011_bright_quiet_harbor.sql` : `ALTER TABLE reviews ADD COLUMN hidden_at timestamptz`.
- Snapshot `0011_snapshot.json` + entrée `_journal.json` (idx 11).

## Fichiers créés

- `server/src/modules/admin/service.ts`
- `shared/src/validation/admin.ts`
- `tests/src/admin.integration.test.ts`
- `server/drizzle/0011_bright_quiet_harbor.sql`
- `server/drizzle/meta/0011_snapshot.json`

## Fichiers modifiés

- `server/src/modules/admin/routes.ts` (routes admin complètes)
- `server/src/app.ts` (rate limiting `/api/admin`)
- `server/src/modules/barber/statsService.ts` (refactor + filtre avis masqués)
- `server/src/modules/review/service.ts` (lectures publiques excluent masqués)
- `shared/src/schema.ts` (reviews.hiddenAt)
- `shared/src/constants.ts` (CANCELLED_BY_ADMIN, ADMIN_LIMITS)
- `shared/src/types.ts` (DTO admin)
- `shared/src/validation/index.ts` (export admin)
- `client/src/lib/apiClient.ts` (adminApi)
- `server/drizzle/meta/_journal.json`
- `README.md`, `suiviDeepseek.md`

## Commandes NON lancées (attente validation)

`npm install`, `npm run typecheck`, `npm test`, `npm run lint`, `npm run build`,
`npm run db:generate`, `npm run db:migrate`.

## Points d'attention

- La route `GET /api/admin/status` est conservée pour ne pas casser les tests
  d'authentification existants.
- La règle « dernier ADMIN actif » est une défense en profondeur testée au niveau
  service (au niveau HTTP, l'acteur est lui-même ADMIN actif).
- L'action de démasquage d'un avis (unhide) n'est pas dans ce LOT 1 (seule la
  pose de `hidden_at` est câblée) ; la réversibilité est portée par le modèle.

---

# Suivi — issue #7 : LOT 2 (sécurité du compte suspendu)

État : audit terminé, aucun trou de sécurité serveur constaté. Aucun commit /
push / PR / fermeture d'issue. Commandes de vérification volontairement NON
lancées (attente validation).

## Audit (confirmé, déjà en place)

- `loginUser` refuse SUSPENDED (`403 ACCOUNT_SUSPENDED`), après vérification du
  mot de passe.
- `requireAuth` relit l'utilisateur en base à chaque requête et refuse SUSPENDED
  (`403 ACCOUNT_SUSPENDED`) : aucune session émise avant la suspension ne reste
  valide. Le JWT ne porte ni rôle ni statut (seulement `sub` + `csrf`) : aucun
  rôle/statut figé en cookie.
- `requireRole` s'appuie sur `req.user` fraîchement relu.
- Suspendu = bloqué sur toutes les routes authentifiées (barber, client, admin).
- Côté public : recherche (`users.status = ACTIVE`), profil public (404 si non
  ACTIVE/BARBER), créneaux (`assertActiveBarber` → 404), avis (propriétaire
  actif requis → 404) et nouvelles réservations (`assertActiveBarber` → 404).
- Garde-fous LOT 1 confirmés : auto-suspension interdite, dernier ADMIN actif
  protégé, annulation des seules futures PENDING/CONFIRMED,
  `cancelled_by = ADMIN` distinct de BARBER/CLIENT, réactivation sans
  restauration des réservations annulées (aucun chemin PENDING/CONFIRMED depuis
  CANCELLED : confirm/complete → 409 INVALID_STATUS_TRANSITION).

## Correction minimale (cas métier oublié)

- Affichage du responsable d'annulation : `cancelled_by = "ADMIN"` affiche
  désormais « l'administration » côté barber ET côté client (avant : « vous » /
  « le professionnel », trompeur pour les annulations de suspension).

## Tests ajoutés

- `tests/src/account-suspension.integration.test.ts` : login refusé si SUSPENDED ;
  session émise puis refusée après suspension (relecture DB) ; auto-suspension
  interdite ; dernier ADMIN actif protégé ; endpoints admin refusés à
  CLIENT/BARBER (lecture + mutation) ; suspension barber → annulation des seules
  futures PENDING/CONFIRMED ; `cancelled_by` ADMIN distinct de BARBER ;
  réactivation sans restauration (booking toujours CANCELLED, re-confirmation
  impossible).

## Fichiers modifiés / créés

- `tests/src/account-suspension.integration.test.ts` (créé)
- `client/src/pages/barber/BookingsPage.tsx` (affichage « l'administration »)
- `client/src/pages/client/BookingsPage.tsx` (idem)
- `suiviDeepseek.md`

## Commandes NON lancées (attente validation)

`npm install`, `npm run typecheck`, `npm test`, `npm run lint`, `npm run build`,
`npm run db:generate`, `npm run db:migrate`.

## Points d'attention

- Aucune migration : le LOT 2 ne touche pas au schéma.
- Les réservations futures d'un CLIENT suspendu ne sont PAS annulées (décision
  LOT 1 limitée aux barbers) : à confirmer si un lot ultérieur doit l'étendre.

---

# Suivi — issue #7 : LOT 3 (interface /admin)

État : interface d'administration implémentée (sans dépendance). Aucun commit /
push / PR / fermeture d'issue. Commandes de vérification volontairement NON
lancées (attente validation).

## Décisions appliquées

- `AdminLayout` : coque légère (en-tête, navigation responsive, logout) ;
  aucune redéfinition d'autorisation (`RequireRole` + serveur restent la source
  de vérité).
- Dashboard : cartes (utilisateurs, barbiers actifs, réservations, suspendus,
  en attente, avis masqués) + liens vers users/bookings/reviews.
- Listes paginées avec filtres rôle/statut, états chargement/erreur/vide,
  actions avec confirmation (`window.confirm`), rechargement + message
  contextualisé après mutation.
- Users : bouton « Suspendre » désactivé sur soi-même (contrôle serveur
  conservé) ; lien « Voir les statistiques » si `barberProfileId` présent.
- Bookings : vue globale, aucune adresse privée (absente du DTO admin).
- Reviews : « Masquer » uniquement si l'avis est visible ; statut masqué/visible.
- Stats barber admin : rendu partagé `BarberStatsContent` + `StatsRangeSelector`
  (7 j / 30 j / mois / personnalisé), valeurs textuelles toujours présentes.

## Ajouts additifs côté DTO admin (lecture seule, aucune règle métier)

- `AdminUser.barberProfileId` (lien stats) ;
- `AdminMetrics.barbers.active` (carte « Barbiers actifs ») ;
- `AdminBooking.clientName` / `clientEmail` (colonne client) ;
- libellés partagés `ROLE_LABELS` / `USER_STATUS_LABELS`.

## Fichiers créés

- `client/src/components/AdminLayout.tsx`
- `client/src/components/AdminPagination.tsx`
- `client/src/components/BarberStatsContent.tsx`
- `client/src/lib/admin.ts`
- `client/src/pages/admin/UsersPage.tsx`
- `client/src/pages/admin/BookingsPage.tsx`
- `client/src/pages/admin/ReviewsPage.tsx`
- `client/src/pages/admin/BarberStatsPage.tsx`
- `tests/src/admin-ui.test.ts`

## Fichiers modifiés

- `client/src/pages/admin/DashboardPage.tsx` (dashboard complet)
- `client/src/pages/barber/StatsPage.tsx` (réutilise les composants partagés)
- `client/src/app/router.tsx` (routes admin protégées)
- `shared/src/types.ts` (champs DTO admin additifs)
- `shared/src/constants.ts` (ROLE_LABELS, USER_STATUS_LABELS)
- `server/src/modules/admin/service.ts` (jointures/listes pour les champs additifs)
- `README.md`, `suiviDeepseek.md`

## Commandes NON lancées (attente validation)

`npm install`, `npm run typecheck`, `npm test`, `npm run lint`, `npm run build`,
`npm run db:generate`, `npm run db:migrate`.

## Points d'attention

- Les 3 champs DTO additifs sont en lecture seule et n'altèrent aucune règle
  métier (autorisations, suspension, annulation inchangées).
- Pas de tests DOM (infrastructure non configurée) : seuls les helpers purs
  (`client/src/lib/admin.ts`) sont testés unitairement.

---

# Suivi — issue #8 : LOT 2 (UI avatar + galerie)

État : interface implémentée côté client (aucune dépendance ajoutée). Aucun
commit / push / branche / PR. Commandes de vérification volontairement NON
lancées (attente validation).

## Décisions appliquées

- Avatar : section dédiée sur le tableau de bord barber (upload/suppression,
  pré-validation client format + taille, le serveur reste la référence).
- Galerie barber : page `/pro/gallery` — grille responsive (pas de carrousel),
  ajout (image + légende), suppression avec confirmation, compteur 15 max.
- Galerie publique : section « Galerie » + avatar sur le profil public
  (`/barbers/:barberId`), alimentée par `GET /api/barbers/:id/photos`.
- `resolveUploadUrl(...)` (client) résout `/uploads/...` vers l'origine API.
- Erreurs 400/401/403/404/409/413 : message serveur affiché, 401 reformulé
  (« Session expirée ») ; pré-validation 400/413 côté client.
- `PublicBarberProfile.avatarPath` exposé (URL `/uploads/avatars/...`) via
  `barber/service.ts`, sans toucher aux routes publiques ni à la recherche.

## Fichiers modifiés

- `client/src/lib/apiClient.ts` (`resolveUploadUrl`, `validateImageFile`,
  `apiErrorMessage`, upload multipart, `userApi`, galerie `barberApi`/`barbersApi`)
- `client/src/app/router.tsx` (route `/pro/gallery` protégée BARBER)
- `client/src/pages/barber/DashboardPage.tsx` (avatar + lien galerie)
- `client/src/pages/client/BarberProfilePage.tsx` (avatar + galerie publique)
- `shared/src/types.ts` (`PublicBarberProfile.avatarPath`)
- `server/src/modules/barber/service.ts` (avatar dans profils public/interne)

## Fichiers créés

- `client/src/pages/barber/GalleryPage.tsx`

## Commandes NON lancées (attente validation)

`npm install`, `npm run db:generate`, `npm run typecheck`, `npm test`,
`npm run lint`, `npm run build`.

## Points d'attention

- La mise à jour de l'avatar ne rafraîchit pas le contexte d'auth global
  (pas de setter dans `AuthProvider`) : l'état local est mis à jour, le contexte
  se resynchronise au prochain `GET /api/auth/me`.
- `publicRoutes.ts`, `barber/routes.ts` et la recherche publique ne sont pas
  modifiés par ce lot.

---

# Suivi — issue #8 : LOT 1 (backend avatars + galerie)

État : implémenté et commité (`90ace42 feat: add avatar upload and barber gallery`).
Rappel des décisions et fichiers pour mémoire.

## Décisions

- Avatar générique `users.avatar_path` (nullable) ; galerie table `barber_photos`
  (FK cascade, index profil/date, CHECK légende, aucune colonne `position`).
- Stockage local sous `env.UPLOAD_DIR` (défaut `./data/uploads`), servi sous
  `/uploads` (nosniff + cache immutable) ; noms UUID générés serveur.
- `multer` mémoire + `sharp` : WebP, avatar 512x512 cover, galerie 1600px max,
  5 Mo, JPEG/PNG/WebP uniquement.
- 15 photos max (`LIMITS.galleryMaxPhotos`), légende ≤ 300.
- API : `PUT/DELETE /api/users/me/avatar` ; `GET/POST/DELETE /api/barber/photos` ;
  `GET /api/barbers/:id/photos` (avant `/:barberId`).

## Fichiers

- Créés : `server/src/lib/storage.ts`, `server/src/lib/images.ts`,
  `server/src/middleware/upload.ts`, `server/src/modules/user/{routes,service}.ts`,
  `shared/src/validation/gallery.ts`, `tests/src/avatar.integration.test.ts`,
  `tests/src/gallery.integration.test.ts`, migration `0011_bright_quiet_harbor`.
- Modifiés : `shared/src/schema.ts`, `shared/src/types.ts`,
  `shared/src/constants.ts`, `shared/src/validation/index.ts`,
  `server/src/config/env.ts`, `server/src/app.ts`,
  `server/src/modules/auth/service.ts`, `server/src/modules/barber/routes.ts`,
  `server/src/modules/barber/publicRoutes.ts`.

## Points d'attention

- Aucune migration écrite à la main : générée via `npm run db:generate`.
- Les couleurs des marqueurs MapLibre ont été alignées plus tard sur le cuivre
  (#16/#17.3).

---

# Suivi — issue #16 : design system et identité visuelle

État : implémenté (non commité au moment de la rédaction). Nom visible
**FindBarber**, nom technique du dépôt conservé `FindBarberNearYou`.

## Décisions

- Thème par défaut `system`, options `system|light|dark` persistées dans
  `localStorage` clé `fb-theme` ; `darkMode: "class"` ; classe `dark` sur
  `document.documentElement` ; script anti-flash dans `client/index.html`.
- Tokens CSS centralisés (`client/src/styles/tokens.css`) en canaux RGB séparés
  par des espaces, consommés via `rgb(var(--fb-*) / <alpha-value>)` ; police
  Inter en premier choix local puis stack système ; `prefers-reduced-motion`
  respecté et étendu.
- Palette cuivre/ambre validée : light `#B86B2B` / `#955421`, dark `#D88745` /
  `#E79A58` ; `brand-*` conservé en palette de compatibilité cuivrée ; or
  réservé aux badges/icônes/touches premium ; vert réservé au succès.
- Composants UI : `Button`, `Input`, `Field`, `Card`, `Badge`, `Skeleton`,
  `Alert` (ajouté en #17.4) ; `Logo`, `ThemeToggle`, `favicon.svg` ;
  `client/src/lib/cn.ts`.
- Header global (Logo + ThemeToggle) masqué sur `/login` et `/register`
  (`AuthLayout` porte alors Logo + ThemeToggle, sans doublon).

## Corrections successives

- Conversion des tokens en canaux RGB et body en CSS natif : suppression du
  blocage `@apply bg-background` sur `index.css`.
- Correctif dark mode : remplacement des fonds fixes des conteneurs racines
  (`bg-brand-50` → `bg-background`, fonds/panneaux → `bg-surface`, etc.).
- Application de la palette cuivre : `tokens.css`, `tailwind.config.js`
  (`brand-*` cuivrés, statuts `success/warning/danger/info`), `favicon.svg`,
  `Button` (danger token), `Badge` (variantes de statut), marqueurs MapLibre et
  contrôles MapLibre tokenisés (`index.css`).

## Fichiers

- Créés : `client/src/styles/tokens.css`, `client/src/app/theme-context.ts`,
  `client/src/app/ThemeProvider.tsx`, `client/src/lib/cn.ts`,
  `client/src/components/ui/{Button,Input,Field,Card,Badge,Skeleton,Alert}.tsx`,
  `client/src/components/Logo.tsx`, `client/src/components/ThemeToggle.tsx`,
  `client/public/favicon.svg`, `client/src/components/ui/README.md`.
- Modifiés : `client/index.html`, `client/tailwind.config.js`,
  `client/src/styles/index.css`, `client/src/main.tsx`, `client/src/App.tsx`.

## Points d'attention

- La migration visuelle des pages a été faite par lots (#17.1 → #17.5).
- Le style de carte sombre est optionnel via `VITE_MAP_STYLE_DARK_URL` (#17.3).

---

# Suivi — issue #17.1 : refonte Login / Register

État : implémenté.

- Coque partagée `AuthLayout` (desktop 2 colonnes : panneau de marque cuivre +
  formulaire dans une `Card` centrée ; mobile : en-tête compact Logo +
  ThemeToggle) et `AuthBrandPanel` (titre « Le bon barber, au bon moment. »,
  description, 3 bénéfices).
- `client/src/lib/authMessages.ts` : traduction française des codes d'erreur
  connus, fallback obligatoire sur `err.message`.
- Login : « Content de vous revoir. », CTA « Se connecter », lien vers Register,
  mot de passe affichable/masquable (`aria-label` dynamique), titres navigateur
  « Connexion — FindBarber » / « Inscription — FindBarber ».
- Register : « Créez votre compte. », CTA « Créer mon compte », segmented control
  accessible « Je cherche un barber » / « Je suis barber » (jamais ADMIN),
  message de succès après redirection vers `/login` (`state.registered`).
- Logique conservée : `useAuth().login`, `ROLE_HOME`, `authApi.register`,
  payload, redirection `/login`, pas d'auto-login, garde anti-double-soumission.
- `App.tsx` masque le header global uniquement sur `/login` et `/register`.
- Fichiers : `client/src/components/auth/{AuthLayout,AuthBrandPanel}.tsx`,
  `client/src/lib/authMessages.ts`, `client/src/pages/auth/{LoginPage,RegisterPage}.tsx`,
  `client/src/App.tsx`.

---

# Suivi — issue #17.2 : navigation globale et accueil client

État : implémenté.

- `HomePage` transformée en accueil connecté : hero de bienvenue (salutation
  « Bonjour, {prénom}. » ou « Bienvenue sur FindBarber. », avatar/initiale),
  recherche par ville → `/barbers?city=<encodée>` (ou `/barbers` si vide),
  chips de prestations (`technique=COUPE|DEGRADE|BARBE|TRESSES|COLORATION`),
  section « Barbers à découvrir » via `barbersApi.search` (AbortController,
  skeletons, erreur `role="alert"` + Réessayer, vide + CTA), raccourci
  « Vos rendez-vous » → `/appointments`, étapes « 1. Cherchez / 2. Comparez /
  3. Réservez », déconnexion discrète.
- Contrat d'URL de la recherche préservé (`q, city, countryCode, audience,
  technique, place, page`).
- Fichiers : `client/src/components/home/{HomeHero,CategoryChips,BarberPreviewCard}.tsx`,
  `client/src/pages/client/HomePage.tsx`. `App.tsx` non modifié (header global
  inchangé).

---

# Suivi — issue #17.3 : recherche de barbers, résultats, filtres et carte

État : implémenté.

- `SearchFilters` : formulaire refactorisé avec `Field`/`Input`/`Button`/`Card`,
  selects HTML natifs tokenisés, filtres mobiles repliables
  (`aria-expanded`/`aria-controls`, compteur), cibles ≥ 44 px.
- `BarberResultCard` : whitelist `PublicBarberSearchItem` uniquement (nom, ville
  + pays, services actifs, audiences accent doux, techniques/lieux `Badge`
  neutral, CTA « Voir le profil »), carte sélectionnée `ring-accent`.
- États liste : skeletons, erreur `role="alert"` + Réessayer, vide + reset,
  page vide + retour page 1 ; carte : overlays tokenisés (`bg-surface`,
  `text-foreground(-muted)`, CTA accent) et pastille tuiles.
- MapLibre : conservation intégrale des marqueurs/événements/ResizeObserver/
  watchdog/fitBounds/easeTo/reducedMotion ; style sombre **optionnel** via
  `VITE_MAP_STYLE_DARK_URL` (`getMapSettings(theme)`, `map.setStyle(url,
  { diff: false })` dans un `try/catch`, sans remount ni perte de caméra/
  marqueurs ; fallback style clair si absente). Contrôles MapLibre tokenisés en
  dark (`.dark .maplibregl-ctrl*`).
- Fichiers : `client/src/components/search/{SearchFilters,BarberResultCard}.tsx`,
  `client/src/pages/client/BarbersSearchPage.tsx`, `client/src/components/BarbersMap.tsx`,
  `client/src/components/BarbersMapCard.tsx`, `client/src/lib/mapConfig.ts`,
  `client/src/vite-env.d.ts`, `client/src/styles/index.css`, `.env.example`.

---

# Suivi — issue #17.4 : fiche barber publique et réservation

État : implémenté.

- `BarberProfilePage` : grille desktop `1fr + 22rem` (colonne principale
  profil/services/galerie/avis, `BookingForm` sticky à droite) ; mobile
  une colonne, réservation juste après l'en-tête.
- Composants : `BarberProfileHeader` (avatar/initiale, nom, description, ville +
  pays, lieu(x), localisation approximative, note + total uniquement si avis,
  étoile gold discrète), `BarberServices` (lecture seule, audiences accent doux,
  techniques `Badge` neutral, prix/durée), `BarberGallery` (skeletons, erreur +
  retry, vide, grille responsive, pas de carrousel/lightbox), `BarberReviews`
  (lecture seule, loading/erreur/vide/succès).
- `BookingForm` : logique intégralement conservée (props, `barbersApi.getSlots`
  + AbortController, `validateBookingForm`, payload `BookingCreateInput`,
  garde CLIENT, `bookingApi.create`, adresse `AT_CLIENT`) ; UI tokenisée
  (`Card`, champs `bg-surface-muted`, créneaux ≥ 44 px `bg-accent` si
  sélectionnés, `Alert` pour erreurs/succès, champs désactivés pendant l'envoi).
- `BookingStatusBadge` : variantes de statut `warning`, `success`, `neutral`,
  `info`, `danger` : statuts, libellés et props inchangés.
- Ajout `client/src/components/ui/Alert.tsx` (info/success/warning/danger,
  `role="alert"` pour danger, `status` sinon).
- Fichiers : `client/src/pages/client/BarberProfilePage.tsx`,
  `client/src/components/BookingForm.tsx`, `client/src/components/BookingStatusBadge.tsx`,
  `client/src/components/barber/{BarberProfileHeader,BarberServices,BarberGallery,BarberReviews}.tsx`,
  `client/src/components/ui/Alert.tsx`.

---

# Suivi — issue #17.5 : espace client, rendez-vous, annulation et avis

État : implémenté.

- `BookingsPage` : sections « À venir » (PENDING/CONFIRMED futurs) et
  « Passés » (COMPLETED/CANCELLED/NO_SHOW ou `startAt` passé), regroupement
  purement frontend, ordre serveur conservé ; skeletons au chargement ; erreur
  liste `Alert danger` + Réessayer ; vide avec CTA « Rechercher un barber ».
- `BookingCard` (présentational, aucun appel API) : données existantes,
  `BookingStatusBadge`, annulation inline en deux étapes (uniquement
  PENDING/CONFIRMED, `Button` danger `isLoading`, erreur contextuelle
  `Alert danger`, mention « L'annulation est soumise aux conditions
  applicables. »), adresse client chargée à la demande (`bg-surface-muted`),
  bloc avis (merci / déjà laissé / `ReviewForm` / bouton).
- `ReviewForm` : props, `validateReviewDraft`, handlers et payload inchangés ;
  textarea natif et boutons de note tokenisés, `aria-pressed`, erreurs
  `role="alert"`, envoi `Button` `isLoading`, annuler `Button secondary`.
- Logique conservée : `bookingApi.{list,cancel,getDetails,createReview}`,
  payloads, confirmation en deux étapes, `hasReview` mis à jour localement,
  `reviewThanksId`, chargement d'adresse à la demande, aucune règle frontend de
  délai d'annulation (serveur source de vérité).
- Fichiers : `client/src/components/client/BookingCard.tsx`,
  `client/src/pages/client/BookingsPage.tsx`, `client/src/components/ReviewForm.tsx`.

---

# État de publication

- Lots #7, #8 et #12–#20 déjà commités/poussés sur `main` lors des sessions
  précédentes ; le travail #16 et #17.1 → #17.5 est regroupé dans un commit
  dédié et poussé sur `origin/main` (voir message de commit).
- Fichiers explicitement hors périmètre, non suivis et non commités :
  `server/src/scripts/seed-demo.ts`, `genreVisuelSite/*.png`.
- Aucune nouvelle dépendance, aucun secret ajouté ; `VITE_MAP_STYLE_DARK_URL`
  reste optionnelle et vide par défaut.
