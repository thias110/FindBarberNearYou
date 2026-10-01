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
