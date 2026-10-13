# Arborescence agent et agents maintenaint

## Projet uberBarber dans Perplexity pro

### Point forts Points faibles et je l'utilise pourquoi
- a mon avis tres fort en recherche sur internet et analyse, possibilité d'utiliser plusieurs modeles ia, la recherche est toujours du dernier moment, dans mon projet je l'utilise actuellement comme chef de projet, en devops et aussi cordinateur je vois il est bien mais quand la conversation devienne longue perd beacoup la memoire de fois je dois lui rappeller les choses que on a deja fais, possibilité d'utiliser le mode Recherche Approfondie(limitée)pour avoir des meilleurs resultat et je l'utilise dans un projet avec des consignes de base, on ne peux pas lui envoyer des fichiers de code et de zip.
### Cout
- Abbo pro etudiant 8 CHF mois et je l'ai gratuit.

## api deepseek ia avec pi 

### Points forts 
- pas chere du tout tres bon en code version 4-1 flash vite en code ce que je vous elle ne pas tres fort est en design apres pour la partie api du project elle me semble fort aussi pour la securitée cependant pour cela je ne suis pas pro du coup je sais pas. 

### Cout 
| Modèle                               | Entrée (cache miss) | Entrée (cache hit) | Sortie | Heures creuses              |
| ------------------------------------ | ------------------- | ------------------ | ------ | --------------------------- |
| DeepSeek V4.1 Flash (deepseek-flash) | $0,30               | $0,006             | $1,20  | Entrée $0,15 · Sortie $0,60 |
| DeepSeek V4 Pro (deepseek-v4-pro)    | $1,32               | $0,044             | $3,96  | Entrée $0,66 · Sortie $1,98 |


# Nouvellle structure envisagée

j'aimerais une ia par partie mon budget est de 30 CHF par mois au maximum, j'ai deja l'abbo perplexity gratuit et j'envisage d'acheter gemini pro pour etudiant et claude pro team pour avoir 1.25 utilisation de plus et 20dollar credit api gratuit par mois, l'arborescence des agents doit etre : 

Toi
 ↓
 Agent— Chef / orchestrateur
 ├── Agent dev — développeur principal
 ├── Agent revue — contrôle du code
 ├── Agent DevOps — tests, build, migrations
 └── Agent spécialisé — frontend, booking, sécurité, maquette...

 Et tout ca c'est pour la partie juste developpement de l'appli puis quand elle vas sortir y'auras de nouveau agents specialisée en plus.

 Du coup pour chaque partie j'essaye de trouver le meilleur agent pour la partie, chaque agent je vais le imposter en mode qu'il soit fais exprex pour la partie de son project, je veux pouvoir aussi faire en mode que chaque agent soit connecté avec les autres. 
