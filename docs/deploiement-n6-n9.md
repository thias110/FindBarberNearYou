# Déploiement des lots N4, N5, N6, N8 et N9

Checklist de mise en production des lots fusionnés dans `main` le 2026-10-27
(absence du client, favoris, réservation express, pages ville). Chaque point
renvoie au code qui le justifie.

## 1. Variables d'environnement

Le serveur refuse de démarrer en production (`NODE_ENV=production`) si l'une
de ces conditions n'est pas remplie (`server/src/config/env.ts`) :

- [ ] `DATABASE_URL` renseignée (PostgreSQL).
- [ ] `FIELD_ENCRYPTION_KEY` : 32 octets encodés en base64.
- [ ] `JWT_SECRET` : au moins 32 caractères aléatoires, jamais une valeur
      d'exemple (`change-me`, etc.).
- [ ] `MAIL_TRANSPORT=smtp` et `SMTP_HOST` renseigné (plus `SMTP_PORT`,
      `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD` selon le fournisseur).

À renseigner aussi, sans quoi le site démarre mais fonctionne mal :

- [ ] `WEB_ORIGIN` : adresse publique du site (ex. `https://exemple.fr`).
      Avec Docker, elle alimente `FRONTEND_URL` et `CORS_ORIGIN`
      (`docker-compose.yml`). `FRONTEND_URL` sert aux liens des emails, aux
      liens canoniques et au plan du site : si elle pointe vers `localhost`, le
      serveur affiche un avertissement au démarrage
      (`server/src/modules/seo/routes.ts`) et ces liens sont faux.
- [ ] `EMAIL_FROM` : expéditeur réel (le défaut est `no-reply@findbarber.local`).
- [ ] `MAPTILER_GEOCODING_API_KEY` : sans elle, les réservations à domicile
      sont refusées.
- [ ] Optionnel : `CITY_PAGE_MIN_BARBERS` (défaut 3), `TRUST_PROXY_HOPS`
      derrière Nginx, clés Stripe, informations légales et réseaux sociaux.

## 2. Avant le déploiement

- [ ] `npm run build` passe.
- [ ] `npm test` passe.
- [ ] Sauvegarde de la base de production.

## 3. Migrations

Trois nouvelles migrations dans `server/drizzle/` :

- `0023_no_show.sql` (absence du client)
- `0024_favorites.sql` (favoris)
- `0025_express_booking.sql` (réservation express)

- [ ] Appliquer : `npm run db:migrate`.
- [ ] Vérifier que les tables et colonnes sont créées.

## 4. Nginx

`nginx.conf` envoie `/barbers/ville/`, `/sitemap.xml` et `/robots.txt` à l'API
(`app:4000`) au lieu du SPA.

- [ ] `nginx -t` sans erreur, puis rechargement.
- [ ] Une page ville répond : `/barbers/ville/<ville>`.
- [ ] `/sitemap.xml` et `/robots.txt` répondent et utilisent l'adresse publique,
      pas `localhost`.

## 5. Après la mise en ligne

- [ ] Inscription : l'email de vérification arrive et son lien pointe vers
      l'adresse publique.
- [ ] Une réservation express de bout en bout.
- [ ] Autocomplétion de ville avec la vraie clé MapTiler.
- [ ] Soumettre `/sitemap.xml` à la Search Console.
