# FindBarberNearYou — Audit et architecture cible

Document de cadrage (Phase 1 + Phase 2) avant implémentation. Il sera versionné dans le dépôt sous `docs/ARCHITECTURE.md` une fois la stack validée.

---

## 1. Audit de l'existant

### Dépôt
- Dépôt connecté : **GitHub** `thias110/FindBarberNearYou` (branche `main`, public). Aucun dépôt GitLab n'a été fourni.
- Contenu : **un seul fichier `README.md`**. Aucun code, aucune dépendance, aucune base de données, aucune API.
- 14 issues ouvertes (backlog déjà structuré en 3 phases) : #1 Auth, #2 Profil barber, #3 Recherche/carte, #4 Réservation anti-chevauchement, #5 Avis, #6 DevOps/Seeders, #7 Admin, #8 Galerie, #9 Notifications, #10 Paiement, #11 API mobile, #12 Durcissement sécurité, #13 Policies/anti-IDOR, #14 nLPD/RGPD.

### Images / maquettes
- Aucune image ou capture d'écran n'a été jointe à la demande. Les seules références visuelles disponibles sont les captures de la démo statique réalisée précédemment (palette crème / vert profond, typographie General Sans + Satoshi, cartes salons, flow de réservation en modale).

### Environnement de build disponible
- Node.js 20 + npm disponibles. PHP, Composer, PostgreSQL serveur et Docker **ne sont pas disponibles** dans l'environnement d'exécution utilisé pour construire, tester et prévisualiser l'application.

### Conséquence
Il n'y a rien à préserver ni à migrer : on part d'une page blanche, en respectant le backlog des 14 issues. Le seul vrai choix structurant est la stack.

---

## 2. Décision de stack

| Critère | Option A — TypeScript full-stack (recommandée) | Option B — Laravel + Blade |
|---|---|---|
| Frontend | React 18 + Vite + Tailwind + shadcn/ui | Blade + Tailwind + Alpine |
| Backend | Express 5 + TypeScript + Zod | PHP 8 + Laravel |
| ORM / BDD | Drizzle ORM + **PostgreSQL** (PGlite en local/preview, PostgreSQL serveur en prod, même schéma) | Eloquent + PostgreSQL |
| Typage bout en bout | Oui (types et schémas Zod partagés `shared/`) | Non |
| Réutilisation pour l'app mobile | API JSON déjà en place, types partagés avec React Native | API à exposer séparément (Sanctum) |
| Construction, tests et preview dans cet environnement | Oui, de bout en bout | Non (pas de PHP/Composer) : code livré sans pouvoir être exécuté |

**Recommandation : Option A.** Elle permet de livrer une application réellement fonctionnelle, testée et prévisualisable, avec un seul langage (TypeScript) du schéma de base de données jusqu'aux écrans, et prépare directement l'application mobile. L'issue #11 (Sanctum) sera reformulée en « auth par token JWT/API keys pour mobile ».

Note : l'Option A change la recommandation Laravel faite au début du projet. Ce changement est motivé par (1) la capacité à exécuter et tester réellement le code ici, (2) le typage partagé, (3) la transition mobile.

---

## 3. Structure des dossiers (Option A)

```text
FindBarberNearYou/
├── client/                         # Frontend React (Vite)
│   ├── index.html
│   └── src/
│       ├── app/                    # Router, providers (Query, Theme, Auth), garde de rôles
│       ├── pages/
│       │   ├── auth/               # login, register, forgot-password
│       │   ├── client/             # home, search, barber/[id], booking/[id], bookings, favorites, profile
│       │   ├── barber/             # dashboard, calendar, bookings, clients, services, availability, analytics, profile
│       │   └── admin/              # dashboard, users, barbers, bookings, reviews, reports
│       ├── components/
│       │   ├── ui/                 # design system (shadcn : button, input, card, dialog, badge, skeleton…)
│       │   ├── layout/             # AppShell, BottomNav mobile, Sidebar barber/admin, PageHeader
│       │   ├── booking/            # ServicePicker, DatePicker, SlotGrid, BookingSummary, BookingStatusBadge
│       │   ├── barber/             # BarberCard, BarberHero, ServiceList, ReviewList, Gallery
│       │   ├── calendar/           # DayView, WeekView, MonthView, AppointmentCard
│       │   ├── dashboard/          # StatCard, RevenueChart, TopServicesChart
│       │   └── forms/              # champs réutilisables (PhoneField, PriceField, DurationField, ImageUpload)
│       ├── features/               # logique métier côté client (hooks + appels API + types) par domaine
│       │   ├── auth/  bookings/  barbers/  services/  availability/  reviews/
│       │   ├── favorites/  notifications/  customers/  payments/  admin/
│       ├── hooks/                  # hooks génériques (useDebounce, useGeolocation, useMediaQuery)
│       ├── lib/                    # apiClient, formatters (CHF, dates fr-CH), utils
│       └── styles/                 # tokens CSS, thèmes clair/sombre
├── server/                         # Backend Express
│   ├── index.ts                    # bootstrap
│   ├── app.ts                      # middlewares globaux, montage des modules
│   ├── config/env.ts               # variables d'environnement validées par Zod
│   ├── db/                         # connexion Drizzle, migrations, seed
│   ├── middleware/                 # requireAuth, requireRole, rateLimit, errorHandler, securityHeaders
│   ├── modules/                    # 1 dossier = 1 domaine : routes.ts, service.ts, repository.ts, schemas.ts
│   │   ├── auth/  users/  barbers/  services/  availability/  bookings/
│   │   ├── reviews/  favorites/  customers/  notifications/  payments/  admin/  uploads/
│   └── lib/
│       ├── notifications/          # NotificationDispatcher + canaux (in-app ; email/SMS/push/WhatsApp à brancher)
│       ├── payments/               # PaymentProvider (interface) + ManualProvider + StripeProvider (derrière flag)
│       └── slots/                  # moteur de calcul des créneaux (pur, testé unitairement)
├── shared/                         # Partagé front/back
│   ├── schema.ts                   # tables Drizzle (pg-core)
│   ├── validation/                 # schémas Zod (login, booking, service…)
│   ├── types.ts                    # types dérivés
│   └── constants.ts                # rôles, statuts, devise
├── tests/                          # Vitest : unitaires (slots) + intégration (API auth, booking, permissions)
├── docker-compose.yml              # PostgreSQL pour la prod / dev local
├── .env.example
└── README.md
```

---

## 4. Modèle de données

| Table | Rôle | Points clés |
|---|---|---|
| `users` | Compte unique (email, hash mot de passe, rôle `CLIENT`/`BARBER`/`ADMIN`, nom, téléphone, avatar, statut `ACTIVE`/`SUSPENDED`) | Index unique `email`. Pas de table `clients` séparée : un client est un `user` de rôle CLIENT, ce qui évite la duplication. |
| `barber_profiles` | Fiche pro liée 1‑1 à un user BARBER (nom commercial, description, adresse, lat/lng, téléphone pro, réseaux, langues, spécialités, photo de couverture, `is_published`) | Index `(lat, lng)` pour la recherche par proximité ; colonnes agrégées `rating_avg`, `rating_count` mises à jour par trigger applicatif. |
| `barber_photos` | Galerie / portfolio | `position` pour l'ordre. |
| `services` | Prestations (nom, description, prix en centimes, durée en minutes, image, `is_active`) | Index `(barber_id, is_active)`. |
| `working_hours` | Horaires hebdomadaires : `weekday`, `start`, `end`. Plusieurs segments par jour = pauses implicites (09:00‑12:00 puis 13:00‑18:00). | Index `(barber_id, weekday)`. |
| `time_off` | Congés, vacances, indisponibilités exceptionnelles (`start_at`, `end_at`, motif) | Index `(barber_id, start_at)`. |
| `bookings` | Rendez-vous : client, barber, service, `start_at`, `end_at`, prix figé, statut `PENDING`/`CONFIRMED`/`COMPLETED`/`CANCELLED`/`NO_SHOW`, motif d'annulation | Index `(barber_id, start_at)`, `(client_id, start_at)`. **Contrainte d'exclusion PostgreSQL** (`btree_gist`) sur `(barber_id, tstzrange(start_at,end_at))` pour les statuts actifs : deux réservations qui se chevauchent sont impossibles même en cas de requêtes concurrentes. |
| `reviews` | Note 1‑5 + commentaire, liée 1‑1 à un `booking` `COMPLETED` | Unique `booking_id` : un seul avis par rendez-vous, et impossible sans rendez-vous terminé. |
| `favorites` | Client ↔ barber | Clé primaire composite. |
| `notifications` | In‑app : destinataire, type, titre, corps, payload JSON, `read_at` | Index `(user_id, read_at)`. |
| `payments` | Montant, devise, statut (`PENDING`/`PAID`/`REFUNDED`/`FAILED`), provider, référence externe, lié à un booking | Prêt pour Stripe, fonctionne sans. |
| `customer_notes` | Notes privées d'un barber sur un client | Unique `(barber_id, client_id)`. |
| `reports` | Signalements (avis, profil) pour la modération admin | |

Les stats CRM (dernière visite, nombre de RDV, dépenses, service préféré) sont **calculées** depuis `bookings`, pas dupliquées.

---

## 5. Pages principales

- **Auth** : `/login`, `/register` (choix client/barber), `/forgot-password`.
- **Client** : `/` (accueil + recherche), `/search` (liste + carte Leaflet), `/barbers/:id` (profil, bouton Réserver collant sur mobile), `/barbers/:id/book` (flow 5 étapes), `/bookings` (à venir / historique, modifier, annuler, noter), `/favorites`, `/profile`, `/notifications`.
- **Barber** : `/pro/dashboard`, `/pro/calendar` (jour/semaine/mois), `/pro/bookings`, `/pro/clients` + `/pro/clients/:id`, `/pro/services`, `/pro/availability`, `/pro/analytics`, `/pro/profile`.
- **Admin** : `/admin`, `/admin/users`, `/admin/barbers`, `/admin/bookings`, `/admin/reviews`, `/admin/reports`.

---

## 6. API (préfixe `/api`)

| Domaine | Endpoints |
|---|---|
| Auth | `POST /auth/register`, `POST /auth/login`, `POST /auth/logout`, `GET /auth/me` |
| Users | `GET/PATCH /users/me`, `POST /users/me/avatar` |
| Barbers | `GET /barbers` (filtres : q, lat/lng/radius, service, prix max, note min, dispo, tri, pagination), `GET /barbers/:id`, `GET /barbers/:id/reviews`, `GET/PUT /barbers/me/profile`, `POST/DELETE /barbers/me/photos` |
| Services | `GET /barbers/:id/services`, `GET/POST /barbers/me/services`, `PATCH/DELETE /barbers/me/services/:id` |
| Disponibilités | `GET /barbers/:id/slots?serviceId&date`, `GET/PUT /barbers/me/working-hours`, `GET/POST/DELETE /barbers/me/time-off` |
| Bookings | `POST /bookings`, `GET /bookings` (filtré par rôle), `GET /bookings/:id`, `PATCH /bookings/:id/reschedule`, `POST /bookings/:id/cancel`, `POST /bookings/:id/confirm|decline|complete|no-show` (barber) |
| Avis | `POST /bookings/:id/review` |
| Favoris | `GET /favorites`, `PUT/DELETE /favorites/:barberId` |
| CRM | `GET /barbers/me/customers`, `GET /barbers/me/customers/:clientId`, `PUT /barbers/me/customers/:clientId/note` |
| Notifications | `GET /notifications`, `POST /notifications/read-all`, `PATCH /notifications/:id/read` |
| Analytics | `GET /barbers/me/analytics?range=` |
| Paiements | `GET /payments` (historique), `POST /payments/:bookingId/refund` (barber/admin), webhook Stripe désactivé sans clé |
| Admin | `GET /admin/stats`, `GET/PATCH /admin/users/:id` (suspendre/réactiver), `GET /admin/bookings`, `DELETE /admin/reviews/:id`, `GET/PATCH /admin/reports/:id` |

Chaque route : validation Zod, `requireAuth`, `requireRole`, contrôle de propriété dans le service (anti‑IDOR), erreurs normalisées `{ error: { code, message } }`.

---

## 7. Moteur de créneaux (cœur critique)

Entrée : barber, service (durée), date. Calcul :
1. Segments `working_hours` du jour de la semaine.
2. Retrait des `time_off` chevauchants.
3. Retrait des `bookings` actifs (`PENDING`, `CONFIRMED`) chevauchants.
4. Découpage par pas de 15 min ; un créneau est valide si `[start, start+durée]` tient entièrement dans un segment libre et est dans le futur (marge minimale configurable).

À la création : transaction + verrou sur la ligne barber, revalidation du créneau, insertion. La contrainte d'exclusion PostgreSQL est le filet de sécurité final. Tests unitaires sur le moteur, tests d'intégration sur la concurrence (deux requêtes simultanées → une seule réussit).

---

## 8. Sécurité

- Mots de passe hashés (argon2/bcrypt), sessions HTTP‑only + SameSite, CSRF sur mutations.
- `requireRole` côté serveur ; le frontend ne fait que masquer.
- Rate limiting sur `/auth/*`, headers de sécurité (helmet), CSP.
- Uploads : types et taille validés, noms régénérés.
- Secrets uniquement dans `.env` (documentés dans `.env.example`).
- Export et suppression de compte (issue #14) via endpoint dédié + anonymisation des bookings historiques.

---

## 9. Plan d'implémentation

| Étape | Contenu | Issues |
|---|---|---|
| 0 | Scaffold, design system, schéma BDD, seed (barbers genevois fictifs), README | #6 |
| 1 | Auth + rôles + profils utilisateurs + upload avatar | #1, #13 |
| 2 | Profil barber, galerie, services | #2, #8 |
| 3 | Horaires, congés, moteur de créneaux (+ tests) | #2 |
| 4 | Recherche + carte + page profil public | #3 |
| 5 | Flow de réservation, statuts, modification/annulation, anti‑double réservation (+ tests) | #4 |
| 6 | Calendrier barber (jour/semaine/mois) + actions | #4 |
| 7 | Dashboard + analytics (graphiques) | — |
| 8 | CRM clients + notes privées | — |
| 9 | Notifications in‑app + architecture multicanal | #9 |
| 10 | Avis + moyenne automatique | #5 |
| 11 | Paiements (interface provider, manuel par défaut, Stripe derrière flag) | #10 |
| 12 | Administration + signalements | #7 |
| 13 | Sécurité : rate limit, headers, export/suppression compte | #12, #14 |
| 14 | Polish UI, responsive, états, accessibilité, performance ; vérification complète client/barber/admin | — |

Livraison : commits par étape sur une branche dédiée, PR vers `main` (ou push direct sur `main` selon ton choix), preview déployée à chaque étape majeure.
