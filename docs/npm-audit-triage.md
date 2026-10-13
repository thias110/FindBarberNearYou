# Tri des alertes npm (Lot 0)

Date : audit réalisé sur `main` (Node 24 local, npm 11).
Résultat initial : **17 vulnérabilités** (7 modérées, 6 élevées, 4 critiques).
Résultat après tri : **14 vulnérabilités restantes, toutes dev-only** (0 en runtime de production).

## Décisions appliquées

| Paquet | Sévérité | Runtime prod ? | Décision | Raison |
|---|---|---|---|---|
| `sharp` (0.34.x) | high | **oui** (traitement avatar/galerie) | **Corrigé** → `^0.35.5` | CVE libvips/libheif/librsvg exploitables via upload d'image. API utilisée (`rotate/resize/webp/toBuffer`) stable ; seul l'import de type `ResizeOptions` a changé. |
| `concurrently` (via `shell-quote`) | critical | non (dev) | **Corrigé** → `^10.0.6` | Patch non cassant. |

## Décisions différées (documentées, non corrigées)

Toutes les alertes restantes sont **dev-only** : elles concernent l'outillage de
build/test (vitest, tailwindcss, drizzle-kit), pas le serveur Express ni le
client livré.

| Chaîne | Sévérités | Correctif npm | Décision |
|---|---|---|---|
| `vitest` → `tinypool`, `@vitest/mocker` | 2 critical, 1 moderate | `vitest@5` (majeure) | **Différer.** Le RCE de `tinypool` n'est pas exploitable en CI avec du code de confiance. Mise à niveau v3→v5 à planifier séparément (vérifier les 412 tests). |
| `tailwindcss` → `braces`, `chokidar`, `fast-glob`, `micromatch`, `postcss-*` | 5 high, 2 moderate | `tailwindcss@4` (majeure) | **Différer.** Outillage CSS de build uniquement. Migration v3→v4 (PostCSS) à traiter comme une tâche dédiée. |
| `drizzle-kit` → `@esbuild-kit/*`, `esbuild` | 4 moderate | suggère `drizzle-kit@0.18.1` (régression) | **Rejeter le correctif.** C'est un downgrade ; l'advisory `esbuild` ne touche que le serveur de dev local. Surveiller une montée non cassante de `drizzle-kit`. |

## Règle retenue

- `npm audit --omit=dev` doit rester à **0 vulnérabilité** (contrôle CI).
- Les alertes dev-only sont traitées lors des montées majeures planifiées
  (vitest 5, tailwindcss 4), jamais via `npm audit fix --force`.
