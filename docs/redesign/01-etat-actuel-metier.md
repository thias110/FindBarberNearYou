# 01 — État actuel fonctionnel et métier de FindBarber

- **Auteurs** : sous-agent B (skill domain-modeling), relu et contrôlé par le coordinateur.
- **Base** : commit `c85d06d`. Les chemins sont relatifs à la racine du dépôt.
- **Méthode** : lecture statique du code. Aucun test exécuté par le sous-agent.
- **Vérifications du coordinateur** :
  - `NO_SHOW` est absent de `server/src` (grep) ;
  - dans `server/src/modules/admin/service.ts:323`, l'annulation des réservations est réservée au cas `role === "BARBER"` ;
  - `RADIUS_PAGE_SIZE = 50` dans `client/src/pages/client/BarbersSearchPage.tsx:51` ;
  - les routes `user` se limitent à avatar, langue, export et suppression (`server/src/modules/user/routes.ts:21-72`) ;
  - il n'existe ni `CONTEXT.md`, ni `GLOSSARY.md`, ni `docs/adr/`.

## Constats

### 0. Documents de domaine

- Le dépôt ne contient ni `CONTEXT.md`, ni `GLOSSARY.md`, ni `docs/adr/`.
- `docs/agents/domain.md:7-10` prévoit `CONTEXT.md` et `docs/adr/`, alors que le skill domain-modeling prévoit `GLOSSARY.md`. Les deux conventions se contredisent (voir les questions).

### 1. Routes front (`client/src/app/router.tsx`)

Garde : `RequireRole`.
- Sans session, il renvoie vers `/login`.
- Avec un rôle non autorisé, il renvoie vers `ROLE_HOME[role]` : CLIENT → `/`, BARBER → `/pro/dashboard`, ADMIN → `/admin` (`RequireRole.tsx:27-33`, `shared/src/constants.ts:33-37`).

| Page | Chemin | Rôle | Preuve |
|---|---|---|---|
| Authentification (connexion, inscription, vérification et renvoi d'email, mot de passe oublié, réinitialisation) | `/login`, `/register`, `/verify-email`, `/resend-verification`, `/forgot-password`, `/reset-password` | public | router.tsx:55-60 |
| Recherche | `/barbers` | public | :63 |
| Profil public d'un barber | `/barbers/:barberId` | public | :64 |
| Mentions légales | `/mentions-legales` | public | :66 |
| Accueil | `/` | public et CLIENT ; BARBER et ADMIN sont redirigés | :34-50, :69 |
| Compte | `/account` | CLIENT, BARBER | :70-77 |
| Paramètres | `/settings` | CLIENT, BARBER | :78-85 |
| Mes rendez-vous | `/appointments` | CLIENT | :86-93 |
| Espace pro (9 pages) | `/pro/*` : tableau de bord, profil, prestations, horaires, absences, réservations, statistiques, paiements, galerie | BARBER | :94-165 |
| Admin | `/admin`, `/admin/users`, `/admin/bookings`, `/admin/reviews`, `/admin/audit`, `/admin/barbers/:id/stats` | ADMIN | :166-213 |
| Toute autre adresse | `*` | redirection vers `/` | :215 |

L'ADMIN n'a accès ni à `/account` ni à `/settings` (:73, :81).

### 2. API

Montage des routes : `server/src/app.ts:171-183`.

Protections communes :
- le webhook Stripe est branché avant `express.json` (:51) ;
- un rate limiting est appliqué par groupe de routes (:154-169) ;
- `requireAuth` renvoie 401 pour un compte DELETED, 403 pour un compte SUSPENDED, et refuse toute session émise avant `passwordChangedAt` (`middleware/auth.ts:41-55`) ;
- toutes les mutations authentifiées passent par `csrfProtection`.

| Méthode et chemin | Garde | Résumé | Preuve |
|---|---|---|---|
| GET /api/health ; GET /api/site-config | public | ping ; support, réseaux sociaux, éditeur | app.ts:171 ; site/routes.ts:30 |
| POST /api/auth/register | public, limité | CLIENT ou BARBER ; ADMIN refusé | auth/routes.ts:36 ; auth/service.ts:74-77 |
| POST /api/auth/login | public, limité | cookie JWT et CSRF ; refus si compte suspendu ou email non vérifié | :45 ; service.ts:140-146 |
| POST /api/auth/logout ; GET /api/auth/me | auth | déconnexion ; session | :58, :85 |
| POST /api/auth/verify-email, /resend-verification, /forgot-password, /reset-password | public | jetons à usage unique ; la réinitialisation révoque les sessions | :66, :76, :90, :101 |
| PUT, DELETE /api/users/me/avatar ; PATCH /api/users/me/locale ; GET /api/users/me/export ; DELETE /api/users/me | auth (+ CSRF) | avatar, langue, export JSON, suppression (mot de passe exigé, ADMIN refusé) | user/routes.ts:21-72 |
| /api/notifications (liste, compteur, lu, tout lu) | CLIENT, BARBER | notifications dans l'app | notification/routes.ts:17-52 |
| GET /api/barbers, /popular-techniques, /:id, /:id/slots, /:id/reviews, /:id/photos | public | recherche, top 5 des techniques, profil, créneaux, avis, galerie | barber/publicRoutes.ts:36-100 |
| /api/barber/profile (+ /completion), /address-suggestions, /services, /working-hours, /time-off, /photos, /stats | BARBER | gestion pro ; une prestation se désactive (`isActive`), elle ne se supprime pas ; galerie de 15 photos max | barber/routes.ts:58-325 |
| /api/barber/payments (+ /onboarding) ; POST /api/payments/stripe/webhook | BARBER ; signature Stripe | politique de paiement, Stripe Connect, événements | payments/routes.ts:20-60 |
| POST /api/bookings ; GET /api/bookings ; GET /api/bookings/:id | CLIENT ; CLIENT et BARBER ; + ADMIN | demande (avec URL Checkout si paiement) ; liste ; détail | booking/routes.ts:24-52 |
| POST /api/bookings/:id/confirm, /decline, /complete ; /review ; /cancel | BARBER ; CLIENT ; CLIENT et BARBER | transitions de statut, avis | :66-137 |
| /api/admin/* (metrics, users, suspend et reactivate, certify, uncertify et approve, bookings et cancel, reviews et hide, audit-logs, stats d'un barber) | ADMIN | modération et suivi | admin/routes.ts:31-180 |

### 3. Schéma (`shared/src/schema.ts`)

**users** (:60-99)
- Email unique, `role` (CLIENT par défaut), `status` (ACTIVE / SUSPENDED / DELETED), `name`.
- `locale` avec contrainte CHECK fr/en/it/es, `avatarPath`.
- `emailVerifiedAt`, `passwordChangedAt`, `deletedAt`.

**email_verification_tokens** et **password_reset_tokens** (:108, :134) : seul le hash est stocké ; chaque jeton est à usage unique et expire.

**barber_profiles** (:156-236)
- Présentation : `displayName`, `description`.
- Adresse et localisation :
  - `address` facultative et privée, `city`, `postalCode`, `countryCode` ;
  - `latitude` et `longitude` obligatoires (NOT NULL).
- `currency` : CHF, EUR ou USD.
- `travelRadiusKm` : de 1 à 100.
- `timezone` : facultatif.
- Paiement :
  - `stripeAccountId`, `stripeChargesEnabled` ;
  - `paymentMode` ;
  - `depositPercent` : de 10 à 90, 20 par défaut.
- Modération : `certifiedAt`, `approvedAt`.

**Tables liées au barber**
- **barber_services** (:238-275) : durée de 1 à 480 minutes, prix de 0 à 1 000 000 (unités mineures), `isActive`.
- **Publics et techniques** d'une prestation : **…_audiences** (:277) et **…_techniques** (:291).
- **barber_profile_places** (:309) : SALON, AT_PROVIDER ou AT_CLIENT.
- **barber_working_hours** (:327-375) : jour de 1 à 7, minutes de 0 à 1440, début avant la fin.
- **barber_time_off** (:392-436) : 366 jours maximum, motif privé.

**bookings** (:450-560)
- Créneau et état : `startAt` et `endAt` en UTC, `servicePlace`, `status`.
- Copies figées à la création : prestation, prix, durée, devise et nom du barber.
- Adresse client chiffrée.
- Suivi : `cancelledBy` (texte libre), `declineReason`, `reminderSentAt`.
- Paiement : `paymentStatus`, `amountDueMinor`, `platformFeeMinor`, `paymentExpiresAt`, identifiants Stripe, `paidAt`, `refundedAt`, `paymentError`.
- Contrainte `bookings_no_overlap` : deux réservations PENDING ou CONFIRMED ne peuvent pas se chevaucher (`server/drizzle/0015_woozy_invisible_woman.sql:13`).

**reviews** (:575-608) : un avis par réservation, note de 1 à 5, commentaire de 1000 caractères maximum, `hiddenAt`.

**Autres tables**
- **barber_photos** (:617).
- **notifications** (:656) : unique par utilisateur, type et réservation.
- **audit_logs** (:694).
- **email_outbox** (:726) : `dedupeKey` unique.

**Migrations récentes**
- `0021_barber_approval.sql` : les profils existants sont considérés comme approuvés.
- `0022_user_locale.sql` : ajout de la langue.

### 4. Règles métier observées

**Rôles et comptes**
- **Création d'un ADMIN** : uniquement par script (`server/src/scripts/create-admin.ts`), jamais par inscription.
- **Connexion** : un email vérifié est obligatoire (`auth/service.ts:143-146`).
- **Durées de validité** (`config/env.ts`) : jeton de vérification 24 h, jeton de réinitialisation 1 h, session JWT 7 jours.
- **Suspension** (`admin/service.ts:281-377`) :
  - impossible de se suspendre soi-même, impossible de suspendre le dernier admin actif ;
  - suspendre un **BARBER** annule ses réservations futures, rembourse et notifie les clients ;
  - **suspendre un CLIENT n'annule rien** (:323).

**Approbation et badge certifié**
- **`approvedAt` vide = profil en attente.** Le profil est alors invisible et non réservable : profil, avis, recherche et créneaux renvoient 404 (`barber/service.ts:807-815, 874`, `review/service.ts:128-135`, `booking/service.ts:183-198`).
- **Approbation à sens unique** : ni refus ni retrait (`admin/service.ts:692-740`).
- **Pas d'avis au barber** : aucune notification ni aucun email à l'approbation (`NOTIFICATION_TYPES`, `constants.ts:163-172`).
- **Badge certifié** : il peut être attribué à un profil non approuvé (`admin/service.ts:464-506`).

**Profil barber**
- **Création** : photo obligatoire (`barber/service.ts:322-343`) et au moins un lieu.
- **Contraintes par lieu** (`validation/barber.ts:155-191`) : SALON et AT_PROVIDER exigent une adresse ; AT_CLIENT exige un rayon.
- **Devise** : déduite du pays. Si un changement de pays modifierait la devise, il est refusé (409, `barber/service.ts:384-394`).
- **Fuseau horaire** : identifiant IANA, `Etc/…` refusé. Sans fuseau, créneaux et réservations renvoient 409 `BARBER_TIMEZONE_MISSING` (`booking/service.ts:302-308`).
- **Position publique** : coordonnées arrondies à 2 décimales (`lib/location.ts:18-31`).
- **Checklist de profil** en 5 étapes : AVATAR, PROFILE, SERVICES, WORKING_HOURS, GALLERY (`constants.ts:430-437`).

**Horaires et absences**
- Au plus 6 plages par jour, sans chevauchement ni passage de minuit.
- Au plus 200 absences.
- **Aucun contrôle des réservations existantes** quand on ajoute une absence ou qu'on modifie ses horaires (`barber/service.ts` ne lit `bookings` que pour les avis et le classement des techniques).

**Créneaux** (fonction pure, `shared/src/booking.ts:73-137`)
- La grille avance du pas de la durée de la prestation.
- Un jour d'absence est exclu en entier.
- Délai minimal avant un créneau : 30 minutes. Horizon : 60 jours.
- Les changements d'heure (DST) sont gérés ; les intervalles sont semi-ouverts.
- **Créneau occupé** si une réservation est CONFIRMED, ou PENDING non échue et dont le paiement n'a pas expiré.
- Le serveur recalcule le créneau sous verrou au moment de la réservation (`booking/service.ts:409-500`).

**Cycle de vie d'une réservation** (`shared/src/booking.ts:171-190`)
- Transitions :
  - PENDING → CONFIRMED (barber), DECLINED (barber), CANCELLED (client, barber, admin), EXPIRED (système) ;
  - CONFIRMED → COMPLETED (barber), CANCELLED.
- **NO_SHOW** est défini mais aucune transition n'y mène.
- **Expiration** : 24 h après la création, au début du rendez-vous, ou à la fin du délai de paiement, selon ce qui arrive en premier (`booking.ts:212-222`). Un balayage passe toutes les 5 minutes.
- **Annulation par le client** : impossible à moins de 2 h du rendez-vous. Le barber et l'admin peuvent annuler sans délai.
- **COMPLETED** : seulement après la fin réelle du rendez-vous.
- **Rendez-vous à domicile (AT_CLIENT)** : l'adresse du client est géocodée, et la réservation est refusée si elle est hors du rayon.

**Paiement en ligne (Stripe Connect Express)**
- **Modes** : NONE, DEPOSIT ou FULL. L'acompte est un pourcentage du prix, minimum 1,00, plafonné au prix ; en dessous de 1,00, paiement sur place (`booking.ts:255-267`).
- **Conditions** : clés Stripe configurées et compte du barber activé.
- **Déroulé** :
  1. La demande passe en REQUIRES_PAYMENT. Le créneau est bloqué 35 minutes et la demande reste invisible pour le barber.
  2. La session Checkout expire après 31 minutes. Si Stripe échoue, la demande est annulée (`cancelledBy = SYSTEM`).
  3. Le webhook passe la demande en PAID et notifie le barber.
  4. Un paiement arrivé trop tard est remboursé. Une session expirée passe la demande en EXPIRED.
- **Remboursement** : il est **intégral**, quel que soit l'auteur de l'annulation (`lib/payments.ts:106-115`).
- **Commission de la plateforme** : `STRIPE_PLATFORM_FEE_PERCENT`, 0 par défaut.

**Avis**
- Seul le client de la réservation peut laisser un avis, une seule fois, et seulement si la réservation est COMPLETED.
- Pas de modification, pas de suppression, **pas de réponse du barber**.
- L'admin peut masquer un avis, sans restauration possible. Les avis masqués sont exclus des moyennes.

**Notifications et emails**
- **Notifications dans l'app** : créées dans la même transaction que l'action, sans doublon, jamais vers un compte non ACTIVE. La cloche se rafraîchit toutes les 60 s. L'admin n'en reçoit pas.
- **Emails** : envoyés via la file `email_outbox`.
  - Rappel J-1 unique, pour un rendez-vous CONFIRMED qui commence entre 1 h et 24 h plus tard.
  - 6 tentatives d'envoi au maximum.
  - Purge après 7 jours (emails envoyés) ou 30 jours (échecs).
  - Langue du destinataire.
  - Pas d'email à COMPLETED.

**Recherche**
- **Filtres** : `q` (nom), ville, pays, public et technique (sur la même prestation active), lieu, `maxPrice` (exige une devise), `minRating` (sans avis = exclu), zone géographique (`barber/service.ts:869-957`).
- **Tri** : par nom côté serveur (:1016), par distance côté navigateur quand un rayon est choisi.
- **Limite du mode rayon** : seule la première page de 50 résultats est chargée puis filtrée. Au-delà de 50 barbers dans la zone, des résultats peuvent manquer.
- **Position du visiteur** : gardée seulement en mémoire.

**Multilingue**
- Langues : fr (par défaut et en repli), en, it et es.
- La langue choisie est enregistrée dans le navigateur et sur le compte.
- Les emails sont traduits.

**Données personnelles**
- **Export JSON** : sans données de tiers.
- **Suppression du compte**, en une seule transaction :
  - les réservations futures sont annulées et l'autre partie est notifiée ;
  - la vitrine du barber est vidée ;
  - les adresses client sont effacées ;
  - les commentaires d'avis sont retirés (les notes restent) ;
  - l'email est remplacé par `deleted-<id>@deleted.invalid`.
- **Adresses à domicile** : purgées 30 jours après le rendez-vous.

### 5. Tableau des fonctionnalités

**Légende des états :**
- **complet** : le code va de l'interface à la base, et un fichier de test existe (tests non exécutés par le sous-agent) ;
- **partiel** : une lacune est observée ;
- **non testé en réel** : dépend d'une clé externe ;
- **absent**.

| Fonctionnalité | Rôle | Où | État |
|---|---|---|---|
| Inscription, connexion, vérification d'email, mot de passe oublié | public | `auth/*`, `pages/auth/*` | complet ; email réel non testé (SMTP) |
| Modifier son nom, son email ou son mot de passe une fois connecté | CLIENT, BARBER | aucune route | **absent** |
| Avatar | tous | `user/routes.ts`, `AvatarEditor.tsx` | complet |
| Accueil (techniques populaires, carrousel, recherche) | public, CLIENT | `HomePage.tsx` | complet |
| Recherche avec filtres | public | `BarbersSearchPage.tsx`, `barber/service.ts` | complet |
| Carte et rayon | public | `BarbersMap.tsx` | partiel (limite de 50 résultats) ; tuiles non testées (MapTiler) |
| Profil public (prestations, avis, galerie, badge) | public | `BarberProfilePage.tsx` | complet |
| Créneaux et réservation en salon ou chez le barber | CLIENT | `BookingForm.tsx`, `booking/service.ts` | complet |
| Réservation à domicile (géocodage et rayon) | CLIENT | `booking/service.ts`, `lib/geocoding.ts` | non testé en réel (MapTiler) |
| Mes rendez-vous : annulation, détail, avis | CLIENT | `pages/client/BookingsPage.tsx` | complet |
| Confirmer, refuser, terminer, annuler | BARBER | `pages/barber/BookingsPage.tsx` | complet |
| Signaler un client absent (NO_SHOW) | BARBER | — | **absent** |
| Expiration automatique des demandes | système | `booking/expiry.ts` | complet |
| Profil pro, checklist, prestations | BARBER | `pages/barber/*` | complet ; pas de suppression de prestation |
| Horaires et absences | BARBER | `WorkingHoursPage.tsx`, `TimeOffPage.tsx` | partiel (pas de contrôle des réservations existantes) |
| Galerie, statistiques | BARBER (+ ADMIN pour les stats) | `GalleryPage.tsx`, `statsService.ts` | complet |
| Paiement en ligne | BARBER, CLIENT | `payments/*` | non testé en réel (Stripe) |
| Notifications dans l'app | CLIENT, BARBER | `NotificationBell.tsx` | complet |
| Emails de réservation et rappel J-1 | CLIENT, BARBER | `email/outbox.ts` | non testé en réel (SMTP) |
| Langues et thème clair/sombre | tous | `i18n/*`, `ThemeProvider.tsx` | complet |
| Export et suppression du compte | CLIENT, BARBER | `privacy/service.ts` | complet |
| Admin : utilisateurs et suspension | ADMIN | `UsersPage.tsx` | partiel (la suspension d'un client n'annule pas ses réservations) |
| Admin : approbation des barbers | ADMIN | `admin/service.ts:692-740` | partiel (ni refus, ni notification au barber) |
| Admin : badge certifié | ADMIN | `admin/service.ts:464-506` | complet (mais attribuable à un profil non approuvé) |
| Admin : réservations, avis, journal d'audit | ADMIN | `pages/admin/*` | complet (un avis masqué ne peut pas être restauré) |
| Footer, mentions légales | public | `SiteFooter.tsx`, `LegalNoticePage.tsx` | complet |
| Répondre à un avis | BARBER | — | **absent** |
| Favoris | CLIENT | — | **absent** (rien dans le schéma ni dans les routes) |

## Preuves

Chemins et lignes cités dans chaque constat, plus :
- `client/src/app/{router,RequireRole}.tsx` ;
- `server/src/app.ts`, `server/src/middleware/auth.ts`, `server/src/modules/*/*.ts`, `server/src/lib/*.ts`, `server/src/config/env.ts` ;
- `shared/src/{schema,constants,booking,countries}.ts`, `shared/src/validation/*.ts` ;
- `server/drizzle/0015…, 0021…, 0022….sql` ;
- les tests `tests/src/*.test.ts` et `e2e/*.spec.ts`.

## Limites

- Aucune exécution, ni des tests ni de l'application : « complet » signifie « code et tests présents ».
- Stripe, SMTP et MapTiler n'ont pas pu être vérifiés : les tests s'appuient sur une fausse passerelle, un faux géocodeur et un transport d'email `memory`.
- `.env` n'a pas été lu (interdit). Seul le schéma de configuration a été lu.
- Les écrans n'ont pas été audités un par un (textes et états de l'interface).
- Le skill demande d'écrire `GLOSSARY.md` et des ADR. Ce n'est pas fait, c'est interdit par la mission : les termes à préciser sont listés ci-dessous.

## Questions ouvertes (termes et règles à trancher)

**Vocabulaire**

1. **Barber, Barbier, Professionnel ou Pro** : quel terme canonique ? Le code dit BARBER, le libellé dit « Barbier », les routes disent `/pro`.
2. **Demande ou rendez-vous** : faut-il distinguer une « demande » (PENDING) d'un « rendez-vous » (CONFIRMED) ? Aujourd'hui, la table s'appelle `bookings` et la route `/appointments`.
3. **Prestation, service, technique, catégorie** : à unifier. La table s'appelle `barber_services`, l'interface dit « prestations », et `CategoryChips` affiche des techniques.
4. **« CANCELLED » désigne deux choses** :
   - une réservation annulée ;
   - un « paiement non reçu » (`constants.ts:233`).
5. **`cancelledBy` est un texte libre** et peut valoir SYSTEM (`payments/service.ts:131`), alors que la machine à états ne prévoit SYSTEM que pour l'expiration.
6. **EXPIRED recouvre trois causes** : 24 h sans réponse, début du rendez-vous atteint, paiement non reçu. Faut-il les distinguer pour l'utilisateur ?
7. **Approuvé, Certifié, Profil complet, Réservable** : quatre états différents. Un profil approuvé peut rester non réservable (s'il n'a pas de fuseau), et un profil non approuvé peut être certifié. Est-ce voulu ?

**Règles métier**

8. **Acompte** : il est aujourd'hui remboursé intégralement, quel que soit l'auteur de l'annulation. Quelle règle veut-on ?
9. **Échéance de 24 h d'une demande payée** : elle part de la création de la demande, pas du paiement. Est-ce voulu ?
10. **Absence ajoutée ou horaires modifiés alors que des rendez-vous sont déjà confirmés** : faut-il bloquer, avertir ou annuler ?
11. **Suspension d'un CLIENT** : faut-il annuler ses réservations ?
12. **Approbation** : faut-il pouvoir refuser ou retirer une approbation, et notifier le barber ?
13. **Recherche par rayon au-delà de 50 barbers** : pagination ou tri côté serveur ?
14. **NO_SHOW** : l'implémenter ou le retirer du modèle ?
15. **Modifier son nom, son email ou son mot de passe** une fois connecté : faut-il l'ajouter ?
16. **Convention de documentation** : `CONTEXT.md` (prévu par `docs/agents/domain.md`) ou `GLOSSARY.md` (prévu par le skill) ?

**Skills** : le sous-agent B a lu le SKILL.md de domain-modeling et l'a appliqué **partiellement** : vocabulaire, scénarios limites et recoupement avec le code. Il n'a pas écrit `GLOSSARY.md` ni d'ADR, car c'est interdit dans cette mission.
