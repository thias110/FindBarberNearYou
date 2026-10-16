# 00 — Installation et audit des skills

Date : 2026-10-16. Base : `c85d06d` (branche `claude/busy-tesla-ngq8vr`), working tree propre avant installation.

## Phase 0 — vérifications

| Commande | Résultat |
|---|---|
| `git status --short` | vide |
| `git branch --show-current` | `claude/busy-tesla-ngq8vr` |
| `git log -1 --oneline` | `c85d06d fix(i18n): noms de pays traduits sur les cartes de résultats (helper partagé)` |

## Existence des dépôts sources

Vérifiée avec `git ls-remote --heads https://github.com/<source>.git` : les 6 dépôts répondent.

## Commandes exécutées

Une source à la fois, avec `-y` en plus de la commande type, pour le mode non interactif. L'outil a lui-même détecté un agent et installé sans poser de question.

| # | Commande | Sortie (résumé) |
|---|---|---|
| 1 | `npx skills@latest add mattpocock/skills --skill setup-matt-pocock-skills --skill improve-codebase-architecture --skill domain-modeling --skill codebase-design --skill diagnosing-bugs --skill tdd --skill code-review --skill git-guardrails-claude-code --agent claude-code -y` | « Installed 8 skills ». Analyse de sécurité de l'outil : « Safe, 0 alerts, Low Risk » |
| 2 | `npx skills@latest add davila7/claude-code-templates --skill backend-architect --agent claude-code -y` | « Installed 1 skill » |
| 3 | `npx skills@latest add borghei/claude-skills --skill senior-backend --agent claude-code -y` | « Installed 1 skill » |
| 4 | `npx skills@latest add secondsky/claude-skills --skill database-schema-design --skill api-security-hardening --agent claude-code -y` | « Installed 1 skill » : seulement `api-security-hardening`. Relancée pour `database-schema-design` seul : « x No matching skills found for: database-schema-design » (182 skills listés dans le dépôt) |
| 5 | `npx skills@latest add anthropics/skills --skill frontend-design --agent claude-code -y` | « Installed 1 skill » |
| 6 | `npx skills@latest add nextlevelbuilder/ui-ux-pro-max-skill --skill ui-ux-pro-max --agent claude-code -y` | « Installed 1 skill » |

## Fichiers protégés

Empreintes SHA-256 relevées avant installation et revérifiées après avec `sha256sum -c` : `package.json`, `package-lock.json`, `client/package.json`, `server/package.json`, `shared/package.json` et `.env.example` donnent tous **OK**. Le fichier `.env` n'existe pas dans le dépôt, avant comme après.

## Effets de bord de l'outil

- **`skills-lock.json` créé à la racine du dépôt, hors des zones d'écriture autorisées.** L'outil y enregistre la source et l'empreinte de chaque skill. Il n'est ni commité ni supprimé : **décision à prendre par le propriétaire** (voir la fin du document).
- `.agents/skills/` a été utilisé comme répertoire temporaire pendant l'installation, puis supprimé par l'outil (`ls .agents` ne trouve rien).

## Vérifications finales

`find .claude/skills -name SKILL.md` renvoie 13 fichiers :
`api-security-hardening`, `backend-architect`, `code-review`, `codebase-design`, `diagnosing-bugs`, `domain-modeling`, `frontend-design`, `git-guardrails-claude-code`, `improve-codebase-architecture`, `senior-backend`, `setup-matt-pocock-skills`, `tdd`, `ui-ux-pro-max`.

`git status --short` donne `?? .claude/` et `?? skills-lock.json`.

## Tableau des skills

| Skill | Source | Installé | Fichiers | Points d'attention audit |
|---|---|---|---|---|
| setup-matt-pocock-skills | mattpocock/skills | oui | 7 : SKILL.md, agents/openai.yaml, issue-tracker-{github,gitlab,local}.md, triage-labels.md, domain.md | **À ne pas exécuter.** Il modifie `CLAUDE.md`, écrit dans `docs/agents/`, et crée des labels GitHub (`gh label create`, l. 104), hors des zones autorisées. `disable-model-invocation: true`. Non prévu dans l'ordre d'utilisation. |
| improve-codebase-architecture | mattpocock/skills | oui | 3 : SKILL.md, agents/openai.yaml, HTML-REPORT.md | Écrit un rapport HTML dans le dossier temporaire du système (l. 39), hors du dépôt. Lit `git log`. `disable-model-invocation: true` : seulement à la demande. |
| domain-modeling | mattpocock/skills | oui | 4 : SKILL.md, agents/openai.yaml, GLOSSARY-FORMAT.md, ADR-FORMAT.md | Propose d'écrire `GLOSSARY.md` et des ADR. Pendant cette mission, on n'écrit que dans `docs/redesign/`. |
| codebase-design | mattpocock/skills | oui | 4 : SKILL.md, agents/openai.yaml, DEEPENING.md, DESIGN-IT-TWICE.md | Rien à signaler : méthode d'analyse seulement. |
| diagnosing-bugs | mattpocock/skills | oui | 3 : SKILL.md, agents/openai.yaml, scripts/hitl-loop.template.sh | Suggère des requêtes curl/HTTP vers un serveur de dev (l. 27). Le script n'est qu'un modèle de boucle interactive avec l'utilisateur (`read -p`), sans réseau. Non utilisé dans cette mission. |
| tdd | mattpocock/skills | oui | 4 : SKILL.md, agents/openai.yaml, tests.md, mocking.md | Rien à signaler. Non utilisé (aucun code dans cette mission). |
| code-review | mattpocock/skills | oui | 2 : SKILL.md, agents/openai.yaml | **Même nom que le skill intégré `code-review`** de Claude Code : risque d'ambiguïté. Rien de dangereux dans le contenu. |
| git-guardrails-claude-code | mattpocock/skills | oui | 3 : SKILL.md, agents/openai.yaml, scripts/block-dangerous-git.sh | **Il installe un hook** : il écrit `.claude/settings.json` ou `~/.claude/settings.json` et `.claude/hooks/…`, ce qui modifie la configuration du harnais. Le script bloque `git push`, `reset --hard`, `clean -f` et `branch -D`, utilise `jq` et n'accède pas au réseau. **Non exécuté** : à faire seulement sur ta décision. |
| backend-architect | davila7/claude-code-templates | oui | 1 : SKILL.md | Rien à signaler : guide de conception. Utilisé seulement pour évaluer les nouvelles fonctionnalités. |
| senior-backend | borghei/claude-skills | oui | 9 : SKILL.md, 5 références, scripts/api_load_tester.py, api_scaffolder.py, database_migration_tool.py | **Scripts à risque.** `api_load_tester.py` envoie des requêtes HTTP en charge (`urlopen`, l. 122). `api_scaffolder.py` génère du code. `database_migration_tool.py` génère des migrations. **Aucun script exécuté**, lecture du guide seulement. Ce skill n'est pas prévu dans l'ordre d'utilisation. |
| database-schema-design | secondsky/claude-skills | **non** | — | **Introuvable dans le dépôt** : « No matching skills found ». Comme demandé, aucun remplaçant n'a été cherché. |
| api-security-hardening | secondsky/claude-skills | oui | 2 : SKILL.md, references/python-nginx.md | Rien à signaler : guide de bonnes pratiques. |
| frontend-design | anthropics/skills | oui | 2 : SKILL.md, LICENSE.txt (Apache 2.0) | Rien à signaler. |
| ui-ux-pro-max | nextlevelbuilder/ui-ux-pro-max-skill | oui | 73 (3,7 Mo) : SKILL.md, références, `scripts/search.py`, `core.py`, `validate_data.py`, données CSV, tests | `search.py` lance une recherche **locale** dans des CSV, avec Python 3 et sans dépendance. Le code n'appelle pas le réseau : seul `urllib.parse` est importé dans `validate_data.py`. L'option `--persist` écrit `design-system/<projet>/MASTER.md` : **à ne pas utiliser**, hors zone autorisée. Le SKILL.md dit lui-même qu'il n'installe rien et que ses résultats ne priment pas sur les règles du dépôt (l. 63). |

## Décisions demandées au propriétaire

1. **`skills-lock.json`** (racine, non suivi par git) : le garder non suivi, le supprimer, ou l'ajouter au `.gitignore` dans une mission ultérieure ?
2. **`git-guardrails-claude-code`** : installer son hook ou non. Il n'a pas été exécuté.
3. **`database-schema-design`** : la mission continue sans lui, avec `backend-architect` et `api-security-hardening` pour évaluer les fonctionnalités.

## Chargement par Claude Code

Je ne peux pas lancer `/skills` moi-même : c'est une commande du terminal. J'ai donc vérifié la liste des skills que la session expose à l'agent.

- **Juste après l'installation**, aucun des nouveaux skills n'y figurait.
- **Quelques instants plus tard**, ils sont apparus, chargés à chaud, sans redémarrage : `api-security-hardening`, `backend-architect`, `codebase-design`, `diagnosing-bugs`, `domain-modeling`, `frontend-design`, `git-guardrails-claude-code`, `senior-backend`, `tdd` et `ui-ux-pro-max`.
- **Absents de la liste, et c'est normal** : `improve-codebase-architecture` et `setup-matt-pocock-skills`. Ils déclarent `disable-model-invocation: true`, ils ne s'invoquent donc qu'à la main. Je lis leur `SKILL.md` directement.
- **`code-review`** : un seul skill de ce nom est visible. Je ne peux pas dire si c'est celui du projet ou le skill intégré. Pour lever le doute, la revue de la phase 5 lira directement `.claude/skills/code-review/SKILL.md`.
