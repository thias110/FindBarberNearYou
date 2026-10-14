# Script de démo — FindBarber (8 minutes)

Démo reproductible de la promesse centrale : un client trouve un barber à
Genève, compare une prestation en salon ou à domicile, réserve un créneau
réellement disponible, puis le barber traite la demande. Un passage ADMIN
montre la modération.

## Prérequis

1. `docker compose up -d` puis seed (voir README, section « Démo Docker »).
2. Clé **publique** MapTiler (`VITE_MAP_API_KEY`) restreinte au domaine pour
   afficher la carte (sinon la liste fonctionne, la carte reste vide).
3. Annoncer en début de démo : **données fictives**, e-mails/paiements non
   actifs, carte soumise à configuration MapTiler.

## Comptes (mot de passe unique : `Demo1234!`)

| Rôle | Email | Usage |
|---|---|---|
| CLIENT | `client@demo.ch` | historique vide (création de réservation) |
| CLIENT | `client2@demo.ch` | réservation à terminer + avis |
| BARBER | `karim.plainpalais@demo.ch` | salon Plainpalais (Dégradé, Coupe + barbe) |
| BARBER | `marco.eauxvives@demo.ch` | domicile Eaux-Vives (rayon 5 km) |
| ADMIN | `admin@demo.ch` | modération |

## Déroulé

### 1. Découverte publique — 1 min 30
- Ouvrir `/barbers`, chercher « Genève ».
- Filtrer par technique (ex. Dégradé) et lieu (Salon / Domicile).
- Basculer liste ↔ carte, sélectionner un résultat.

### 2. Confiance — 1 min
- Ouvrir le profil de Karim : photos de galerie, prestations, prix, durée,
  avis et localisation approximative (jamais l'adresse exacte).

### 3. Réservation CLIENT — 2 min
- Se connecter `client@demo.ch` (historique vide).
- Choisir « Dégradé », lieu Salon, date, créneau → créer la réservation.
- La retrouver dans `/appointments`.

### 4. Gestion BARBER — 1 min 30
- Se connecter `karim.plainpalais@demo.ch`, ouvrir `/pro/bookings`.
- Confirmer la demande créée à l'étape 3.
- Montrer le planning, l'indisponibilité du 22 (fermeture démo) et les
  statistiques.

### 5. Après rendez-vous — 1 min
- Utiliser la réservation CONFIRMED de `client2@demo.ch` (hier 14:00).
- Côté barber : la marquer **Terminée**.
- Côté client `client2@demo.ch` : déposer un avis.

### 6. Contrôle ADMIN — 1 min
- Se connecter `admin@demo.ch`, ouvrir `/admin`.
- Montrer les métriques, la liste des utilisateurs.
- Masquer l'avis de démo (5 étoiles) : il disparaît du profil public.
  Le masquage n'est pas annulable depuis l'interface ; re-seeder pour
  retrouver l'avis (voir « Réinitialisation »).

## Réinitialisation

Repartir d'une base vierge (données + uploads) :

```bash
docker compose down -v      # supprime volumes PostgreSQL ET uploads
docker compose up -d
docker compose run --rm app node server/dist/scripts/seed-demo.js
```

Re-seeder sans vider la base (idempotent, remet les mots de passe à
`Demo1234!`) :

```bash
docker compose run --rm app node server/dist/scripts/seed-demo.js
```

## Limites connues de la démo

- Carte : nécessite `VITE_MAP_API_KEY` (clé publique restreinte au domaine).
- Réservations à domicile : nécessitent `MAPTILER_GEOCODING_API_KEY` (clé
  serveur) pour géocoder et vérifier le rayon d'intervention.
- E-mails, vérification de compte et paiements : non actifs (issues #9, #10).
- Données 100 % fictives.
