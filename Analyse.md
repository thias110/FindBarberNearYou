# FindHairdresserNearYou

## 1. Présentation du projet

FindHairdresserNearYou est une application permettant aux utilisateurs de trouver facilement un coiffeur ou un barbier à proximité, de consulter son profil, ses prestations, ses tarifs et ses avis, puis de prendre rendez-vous directement depuis l'application.

L'application fonctionne comme une marketplace de coiffeurs, avec une expérience principalement basée sur la géolocalisation et la réservation.

Le concept combine :
- Une carte interactive permettant de voir les coiffeurs autour de soi.
- Un système de recherche et de filtres.
- Des profils détaillés pour chaque coiffeur.
- La possibilité de réserver un créneau.
- Un système de notes et commentaires.
- La possibilité pour le coiffeur de proposer plusieurs prestations.
- La possibilité pour certains coiffeurs de proposer leurs services dans leur salon, chez le client ou les deux.

### Objectif
Permettre à une personne de trouver rapidement un coiffeur correspondant à ses besoins, son budget, sa localisation et ses disponibilités.

---

## 2. Problématique

Trouver un bon coiffeur peut être compliqué lorsqu'on ne connaît pas les professionnels présents dans une zone.

Aujourd'hui, un utilisateur peut :
- Rechercher sur Google ;
- Regarder Instagram ou TikTok ;
- Demander des recommandations ;
- Consulter différents sites de réservation ;
- Appeler directement les salons.

Cependant, ces solutions peuvent demander du temps et ne permettent pas toujours de comparer facilement :
- Les prix ;
- Les disponibilités ;
- Les prestations ;
- Les avis ;
- Les distances ;
- Les styles de coiffure.

### Problématique principale
Comment permettre à une personne de trouver et réserver rapidement un coiffeur correspondant à ses besoins et à son budget ?

---

## 3. Public cible

### 3.1 Client
Le client recherche un coiffeur ou un barbier.

#### Ses besoins
- Trouver un coiffeur à proximité.
- Connaître les prix.
- Voir les prestations proposées.
- Consulter les avis.
- Voir des exemples de coiffures.
- Connaître les disponibilités.
- Réserver rapidement.
- Pouvoir choisir entre se déplacer ou faire venir le coiffeur.

### 3.2 Coiffeur / Barbier
Le coiffeur utilise l'application pour développer sa clientèle. Il peut être :
- Un salon de coiffure ;
- Un barbier indépendant ;
- Un coiffeur à domicile ;
- Un professionnel travaillant dans un salon ;
- Un indépendant souhaitant développer sa clientèle.

#### Ses besoins
- Présenter ses services.
- Définir ses tarifs.
- Gérer ses disponibilités.
- Recevoir des réservations.
- Obtenir des avis.
- Développer sa clientèle.

---

## 4. Cas d'utilisation

### Cas 1 — Touriste dans une nouvelle ville
Une personne arrive dans une ville qu'elle ne connaît pas et souhaite se faire couper les cheveux. Elle ouvre FindHairdresserNearYou.

**Parcours :**
1. Elle autorise la localisation.
2. Elle voit les coiffeurs disponibles autour d'elle.
3. Elle filtre les résultats selon son budget.
4. Elle consulte les notes et commentaires.
5. Elle regarde les prestations proposées.
6. Elle consulte les disponibilités.
7. Elle choisit un coiffeur.
8. Elle réserve un créneau.

*L'utilisateur peut donc trouver un coiffeur sans connaître les professionnels de la ville.*

### Cas 2 — Trouver une coupe peu chère
Un utilisateur souhaite se faire couper les cheveux avec un budget limité. Il ouvre l'application et indique son budget maximum.

L'application affiche les coiffeurs correspondant à ses critères. Il peut ensuite comparer :
- Le prix ;
- La distance ;
- Les avis ;
- Les prestations ;
- Les disponibilités.

### Cas 3 — Trouver un coiffeur rapidement
Un utilisateur souhaite se faire couper les cheveux le jour même. Il sélectionne l'option **Disponible aujourd'hui**. L'application affiche les professionnels ayant des créneaux libres, et l'utilisateur réserve directement.

### Cas 4 — Coiffeur indépendant
Un coiffeur indépendant souhaite développer sa clientèle. Il crée un compte professionnel et renseigne :
- Son nom ;
- Sa localisation ;
- Ses prestations ;
- Ses tarifs ;
- Ses horaires ;
- Ses photos ;
- Son mode de déplacement ;
- Ses disponibilités.

Il devient alors visible sur la carte pour les utilisateurs situés dans sa zone d'intervention.

### Cas 5 — Coiffeur à domicile
Un utilisateur ne souhaite pas se déplacer. Il applique le filtre **Déplacement à domicile** et réserve une prestation réalisée directement chez lui.

---

## 5. User Stories — Utilisateur

### Recherche
- En tant qu'utilisateur, je veux voir les coiffeurs autour de moi afin de trouver facilement un professionnel à proximité.
- En tant qu'utilisateur, je veux rechercher un coiffeur dans une zone précise afin de préparer une réservation dans une autre ville.
- En tant qu'utilisateur, je veux filtrer les coiffeurs par prix afin de respecter mon budget.
- En tant qu'utilisateur, je veux filtrer les coiffeurs par note afin de trouver des professionnels correspondant à mes attentes.
- En tant qu'utilisateur, je veux filtrer les coiffeurs selon les prestations proposées afin de trouver une coupe spécifique.
- En tant qu'utilisateur, je veux filtrer les coiffeurs selon leur disponibilité afin de pouvoir réserver rapidement.
- En tant qu'utilisateur, je veux filtrer les coiffeurs selon leur mode de prestation afin de choisir entre déplacement et salon.
- En tant qu'utilisateur, je veux voir les coiffeurs disponibles aujourd'hui afin de pouvoir réserver rapidement.

### Profil
- En tant qu'utilisateur, je veux consulter le profil d'un coiffeur afin de voir ses prestations et ses tarifs.
- En tant qu'utilisateur, je veux voir des photos de ses réalisations afin de savoir si son style me correspond.
- En tant qu'utilisateur, je veux consulter les avis des autres clients afin de m'aider dans mon choix.
- En tant qu'utilisateur, je veux voir la distance entre moi et le coiffeur afin de choisir une prestation proche.
- En tant qu'utilisateur, je veux voir les disponibilités du coiffeur afin de choisir un créneau.
- En tant qu'utilisateur, je veux voir le nombre de réservations récentes afin d'avoir une indication de son activité.

### Réservation
- En tant qu'utilisateur, je veux réserver une prestation depuis l'application afin de ne pas avoir à contacter directement le coiffeur.
- En tant qu'utilisateur, je veux choisir une date et une heure afin de réserver le créneau qui me convient.
- En tant qu'utilisateur, je veux recevoir une confirmation de réservation afin de savoir que mon rendez-vous est bien enregistré.
- En tant qu'utilisateur, je veux pouvoir annuler ma réservation selon les conditions du coiffeur afin de gérer mes imprévus.
- En tant qu'utilisateur, je veux consulter mes prochaines réservations afin de savoir quand et où aura lieu mon rendez-vous.
- En tant qu'utilisateur, je veux consulter mon historique afin de retrouver mes anciennes réservations.

### Avis
- En tant qu'utilisateur, je veux noter mon coiffeur après mon rendez-vous afin de partager mon expérience.
- En tant qu'utilisateur, je veux laisser un commentaire afin de donner plus de détails sur mon expérience.
- En tant qu'utilisateur, je veux ajouter une photo à mon avis afin de montrer le résultat de la prestation.

---

## 6. User Stories — Coiffeur

### Inscription
- En tant que coiffeur, je veux créer un compte professionnel afin d'être visible sur l'application.
- En tant que coiffeur, je veux renseigner mon adresse ou ma zone de déplacement afin que les utilisateurs puissent me trouver.
- En tant que coiffeur, je veux ajouter des photos de mes réalisations afin de présenter mon travail.
- En tant que coiffeur, je veux modifier mon profil afin de maintenir mes informations à jour.

### Prestations
- En tant que coiffeur, je veux créer plusieurs prestations afin de proposer différents types de coupes.
- En tant que coiffeur, je veux définir le prix de chaque prestation afin que les clients connaissent le tarif avant de réserver.
- En tant que coiffeur, je veux définir la durée de chaque prestation afin de gérer correctement mon planning.
- En tant que coiffeur, je veux pouvoir modifier ou supprimer une prestation afin de garder mon catalogue à jour.

### Planning
- En tant que coiffeur, je veux définir mes horaires de travail afin que les clients puissent voir mes disponibilités.
- En tant que coiffeur, je veux bloquer certains créneaux afin d'empêcher les réservations lorsque je ne suis pas disponible.
- En tant que coiffeur, je veux consulter mes réservations afin de gérer ma journée.
- En tant que coiffeur, je veux modifier mes disponibilités afin d'adapter mon planning.

### Clients
- En tant que coiffeur, je veux recevoir une notification lorsqu'un client réserve une prestation afin d'être informé rapidement.
- En tant que coiffeur, je veux consulter mes prochains rendez-vous afin d'organiser ma journée.
- En tant que coiffeur, je veux consulter mes avis afin de connaître les retours de mes clients.

---

## 7. Fonctionnalités principales

### Gestion des comptes
- Création de compte utilisateur et coiffeur.
- Connexion et déconnexion.
- Modification du profil et photo de profil.
- Gestion des informations personnelles.

### Carte
- Affichage des coiffeurs sur une carte interactive.
- Géolocalisation de l'utilisateur.
- Affichage de la distance.
- Recherche par zone.
- Aperçu des informations principales et accès au profil complet d'un clic.

### Recherche et filtres
Filtres disponibles :
- Prix
- Distance
- Note
- Type de prestation
- Disponibilité
- Type de coiffure
- Salon ou indépendant
- À domicile ou en salon
- Ouvert actuellement

### Profil du coiffeur
Informations affichées :
- Photo, nom et présentation
- Localisation et distance
- Note moyenne et nombre d'avis
- Nombre de réservations récentes
- Galerie photos des réalisations
- Catalogue des prestations avec prix et durée
- Disponibilités
- Mode d'intervention (salon, domicile)
- Statut de vérification

### Réservation
- Sélection d'une prestation, d'une date et d'une heure.
- Écran de confirmation.
- Historique et annulation de réservations.
- Notifications et rappels avant le rendez-vous.

### Avis
Accessible après une prestation complétée :
- Note de 1 à 5 étoiles.
- Commentaire écrit.
- Ajout optionnel d'une photo.
- Système lié à une réservation validée pour prévenir les faux avis.

---

## 8. Système de confiance

La confiance est un élément clé de la plateforme. Deux niveaux de profils coexistent :

- **Profil non vérifié :** le professionnel crée son profil librement, mais certaines pièces d'identité ou justificatifs manquent.
- **Profil vérifié :** le professionnel a fourni ses documents attestant de son identité et/ou de son activité enregistrée. Il obtient le badge **✓ Profil vérifié**.

---

## 9. Système de prix

Les tarifs doivent être consultables en toute transparence avant validation :

| Prestation       | Prix   | Durée  |
| :--------------- | :----- | :----- |
| Dégradé          | 20 CHF | 30 min |
| Coupe classique  | 25 CHF | 30 min |
| Coupe + barbe    | 35 CHF | 45 min |
| Coupe à domicile | 45 CHF | 45 min |

---

## 10. MVP — Première version

Fonctionnalités ciblées pour la première version :

### Côté utilisateur
- [x] Création de compte et connexion
- [x] Géolocalisation et vue carte
- [x] Recherche avec filtres (prix, distance, note)
- [x] Profil du coiffeur (prestations, prix, créneaux)
- [x] Prise de réservation et historique
- [x] Dépôt d'une note et d'un avis

### Côté coiffeur
- [x] Création de compte pro et complétion du profil
- [x] Gestion du catalogue de prestations et tarifs
- [x] Configuration des plages horaires et gestion du planning
- [x] Gestion des réservations reçues
- [x] Ajout de photos
- [x] Consultation des avis reçus

---

## 11. Fonctionnalités futures

Évolutions prévues après validation du MVP :
- Paiement in-app et gestion des pourboires.
- Messagerie instantanée client-coiffeur.
- Gestion des favoris et réservations récurrentes.
- Codes promotionnels, cartes cadeaux et abonnements.
- Programme de fidélité.
- Dashboard analytique et reporting pour les professionnels.
- Gestion d'équipes et multi-collaborateurs pour les salons.
- Galerie comparative photos avant / après.
- Recommandations algorithmiques personnalisées.
- Gestion des disponibilités en direct (temps réel).
- Portefeuille intégré (wallet in-app) et notifications push.

---

## 12. Modèle économique

### Commission sur les réservations
Prélèvement d'un pourcentage fixe par transaction réalisée via la plateforme.

> **Exemple :**
> - Prestation facturée : 30 CHF
> - Commission plateforme (10 %) : 3 CHF
> - Net perçu par le coiffeur : 27 CHF

### Options de visibilité (Sponsoring)
- Profil mis en avant dans les résultats.
- Priorité de classement dans les recherches thématiques.
- Épinglage sponsorisé sur la carte (clairement étiqueté).

### Abonnements professionnels (SaaS)
Formule payante donnant accès à des outils avancés :
- Statistiques de fréquentation et revenus.
- Synchronisation avancée d'agenda.
- Outils marketing et campagnes promotionnelles.

---

## 13. Stratégie de croissance

Déploiement progressif par ancrage local :

1. **Étape 1 — Une ville pilote :** recruter les premiers partenaires, tester les réservations en conditions réelles et corriger les frictions.
2. **Étape 2 — Échelle métropolitaine :** densifier l'offre sur plusieurs quartiers.
3. **Étape 3 — Multi-villes :** dupliquer le playbook opérationnel dans d'autres agglomérations.
4. **Étape 4 — Expansion globale :** passage à l'échelle cantonale, nationale ou transfrontalière.

---

## 14. Acquisition des premiers coiffeurs

Pour amorcer le réseau face au dilemme de la poule et de l'œuf :
- Prospection directe auprès des barbiers et salons locaux.
- Démarchage des professionnels indépendants sur Instagram et TikTok.
- Gratuité d'accès et taux de commission préférentiel au lancement.
- Accompagnement personnalisé à la création de profil et à la saisie du catalogue.

---

## 15. Acquisition des premiers utilisateurs

Leviers d'acquisition client :
- Présence active sur TikTok et Instagram (vidéos de transformations, avant/après).
- Partenariats avec des créateurs de contenu locaux.
- Campagnes d'offres de lancement et réductions.
- Partenariats de comptoir avec les salons affiliés.
- Programme de parrainage mutuel (*Exemple : 5 CHF offerts au parrain et au filleul*).

---

## 16. Indicateurs de réussite

### Utilisateurs
- Inscriptions totales et utilisateurs actifs (DAU / MAU).
- Volume de recherches et de consultations de profils.
- Volume global de réservations.

### Coiffeurs
- Nombre de professionnels enregistrés et actifs.
- Nombre total de prestations référencées.
- Volume moyen de commandes reçues.

### Marketplace
- Taux de conversion : recherche $\rightarrow$ réservation.
- Panier moyen et fréquence de commande par client.
- Taux d'annulation.
- Satisfaction globale (note moyenne) et taux de rétention.

---

## 17. Exemple de parcours utilisateur

**Contexte :** un utilisateur est de passage en ville et cherche un barbier immédiatement.

1. **Ouverture :** l'utilisateur ouvre l'application et valide la géolocalisation.
2. **Carte :** affichage instantané des professionnels à proximité.
3. **Filtrage :** budget max 30 CHF, note $\ge$ 4/5, filtre "Disponible aujourd'hui".
4. **Consultation profil :** sélection d'un barber (note 4,8/5 sur 127 avis, situé à 1,2 km).
5. **Réservation :** sélection de la coupe, date du jour, créneau à 17h30.
6. **Confirmation :** réception instantanée du récapitulatif de rendez-vous.
7. **Post-prestation :** notification pour noter la prestation et déposer un avis.

---

## 18. Encadrement des indépendants et amateurs

L'ouverture de la plateforme à des prestataires non établis implique un cadre clair :
- Vérification rigoureuse de l'identité (KYC).
- Conditions générales et charte d'hygiène strictes.
- Conformité réglementaire selon les diplômes ou autorisations requises par pays/canton.
- Assurances responsabilité civile professionnelle.
- Gestion contractuelle des litiges et de la responsabilité de la plateforme.
- Traitement sécurisé des annulations.

---

## 19. Proposition de valeur

- **Pour le client :** trouver, comparer et réserver rapidement un coiffeur ou barbier adapté à ses critères (géolocalisation, prix, créneau, retours certifiés).
- **Pour le coiffeur :** booster sa visibilité locale, simplifier son agenda et capter une clientèle additionnelle sans frais fixes initiaux.

---

## 20. Vision à long terme

### Funnel global de l'expérience

```text
Recherche ➔ Comparaison ➔ Choix ➔ Réservation ➔ Paiement ➔ Rendez-vous ➔ Avis ➔ Fidélisation
```

### Diversification sectorielle
Extension future vers l'ensemble des prestations esthétiques et bien-être :
- Barbiers et coiffure à domicile
- Soins du visage et esthétique
- Manucure, onglerie et pédicure
- Maquillage professionnel

---

## 21. Synthèse du projet

FindHairdresserNearYou est une marketplace géolocalisée reliant l'offre et la demande de services capillaires.

### Boucle utilisateur
```text
📍 Trouver ➔ 🔎 Rechercher ➔ ⚙️ Filtrer ➔ 👤 Profils ➔ ⭐ Avis ➔ 📅 Créneaux ➔ 📆 Réserver ➔ 💇 Coupe ➔ ⭐ Noter
```

### Boucle coiffeur
```text
👤 Profil ➔ ✂️ Prestations ➔ 💰 Tarifs ➔ 📅 Plages ➔ 📍 Carte ➔ 📆 Réservations ➔ ⭐ Notations ➔ 📈 Croissance
```

> **Hypothèse centrale du MVP :**  
> Les utilisateurs réservent-ils plus vite et plus facilement un coiffeur adapté lorsque la recherche géolocalisée regroupe en un seul endroit prix, avis, prestations et disponibilités immédiates ?