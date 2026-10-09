# CLAUDE.md

AxoMaster : jeu de cartes à collectionner (personnes, événements, projets), inspiré de
WikiMasters. Les admins créent et publient les cartes ; les joueurs les obtiennent dans des
boosters et se les échangent. Front Vue + API Cloudflare Worker (D1).

## Commandes

```bash
pnpm install
pnpm db:migrate   # migrations D1 locales
pnpm db:seed      # comptes de démo (admin/admin1234, alice/alice1234, bob/bob12345)
pnpm vapid:keys   # clés des notifications push (à mettre dans apps/api/.dev.vars)
pnpm dev          # Vite (:5173) + wrangler dev (:8787), proxy /api
pnpm dev:lan      # idem, Vite exposé sur le réseau local (test sur téléphone)
pnpm typecheck    # tsc (card-model, api) + vue-tsc (web)
pnpm test         # vitest (card-model) + vitest-pool-workers (api)
pnpm lint         # eslint
pnpm build        # typecheck + build du front
```

Avant de considérer une tâche terminée : `pnpm typecheck && pnpm lint && pnpm test`.

## Architecture

Monorepo pnpm (`pnpm-workspace.yaml`), TypeScript strict (`tsconfig.base.json`).

- `packages/card-model` — TS pur, sans dépendance UI. Source de vérité du modèle.
  - `schema.ts` : schémas zod (carte, calques, catégories, paquet d'échange). `api.ts` : contrats
    de l'API (DTO). Les types de `types.ts` sont **dérivés** (`z.infer`) : modifier le schéma.
  - `pack.ts` : `createPack` / `parsePack` + migrations de version.
  - `booster.ts` (`drawBooster`), `boosterQuota.ts` (stock périodique + bonus, logique pure).
    Un seul booster, tiré parmi toutes les cartes publiées ; le quota est global par joueur.
  - `notifications.ts` : textes des notifications push, partagés par le Worker et l'aperçu admin.
  - Consommé directement en source (`exports: ./src/index.ts`), pas d'étape de build.
- `apps/api` — Cloudflare Worker, Hono, D1. Un seul Worker sert aussi `apps/web/dist`
  (`assets` dans `wrangler.jsonc`) ; seules les routes `/api/*` passent par le code.
  - `migrations/` : schéma SQL (une nouvelle migration par changement, jamais modifier une
    migration appliquée).
  - `src/routes/` : `auth` (login/logout/me), `admin` (cartes, catégories, joueurs, réglages,
    images, import, cadeaux), `player` (catégories, catalogue, boosters, joueurs, images),
    `trades`, `push` (clé publique, abonnements des appareils).
  - `src/lib/` : sessions et mots de passe (PBKDF2 WebCrypto), accès D1, stockage d'images
    (R2 si le binding `IMAGES` existe, sinon table D1), `webpush.ts` (VAPID + chiffrement
    aes128gcm en WebCrypto, sans dépendance), `notify.ts` (`notifyUsers` / `notifyAllUsers`).
  - `src/jobs/boosterRefills.ts` : cron (`scheduled`, toutes les 5 min) qui notifie chaque
    recharge de booster, suivie par `users.booster_notify_at`.
  - `scripts/` : `create-user`, `seed` (via `wrangler d1 execute`), `vapid-keys`.
- `apps/web` — Vue 3 (`<script setup>`), Vite, Pinia, vue-router (hash history), lucide-vue-next.
  - `api/client.ts` : appels HTTP, URL **relatives** (`api/...`).
  - Routeur : `meta.public` / `meta.admin` + garde globale. Espace joueur (`/`, `/boosters`,
    `/echanges`) et espace admin (`/admin/...`), la navigation suit l'espace de la route.
  - Stores : `auth`, `cards` (catégories pour tous, cartes complètes pour l'admin), `collection`
    (catalogue + boosters du joueur), `trades`.
  - `components/card/CardView.vue` : **rendu unique** d'une carte, partout. Dessinée à
    630 × 880 px puis mise à l'échelle. Le dos est `components/booster/CardBack.vue`.
  - `components/editor/` : état partagé via `provideEditor` / `useEditor`. `useHistory` :
    annuler / rétablir par instantanés JSON.
  - PWA : `public/manifest.webmanifest`, icônes PNG, `public/sw.js` (push uniquement, pas de
    cache hors ligne). `composables/usePush.ts` : abonnement de l'appareil (cloche de l'en-tête).

## Conventions et invariants

- **Interface en français** uniquement (pas d'i18n). Commentaires de code en français.
- Coordonnées des calques en **% de la carte** ; tailles de police en px de la carte de référence.
  L'ordre du tableau `layers` est l'ordre d'empilement (dernier = devant).
- **Le serveur fait foi** : tirages de boosters, quotas, inventaires et échanges sont calculés
  côté API. Le front n'a rien de persistant hormis le cookie de session (et la préférence de
  thème en `localStorage`).
- Les **cartes non possédées** ne sortent jamais de l'API (catalogue : `id`, `number`,
  `categoryId` seulement). Idem pour l'inventaire d'un autre joueur et les échanges
  (`SharedCard` : `card` absente si le joueur connecté ne la possède pas). Une carte en brouillon
  est invisible des joueurs.
- **Atomicité D1** : une opération multi-écritures passe par un seul `db.batch()` ; les gardes
  reposent sur les contraintes `CHECK` (quantité ≥ 0, statut d'échange, bonus ≥ 0) qui annulent
  tout le batch. Utiliser `inventoryDelta()` pour toucher aux inventaires.
- **Notifications push** : envoyées depuis les routes via `c.executionCtx.waitUntil(notifyUsers(…))`
  pour ne pas retarder la réponse ; un échec d'envoi ne fait jamais échouer l'action. Sans les
  secrets `VAPID_*`, tout est désactivé silencieusement. Les textes se construisent avec les
  fonctions de `notifications.ts`, jamais en dur dans les routes.
- **Images** : jamais dans les données de carte, seulement un `imageId`. Compresser avant envoi
  (`compressImage`, WebP ≤ 1200 px), puis `putImage` (API). Le nettoyage des orphelines est
  serveur (`collectGarbage()` → `POST /api/admin/images/gc`, délai de grâce de 6 h).
- Copier les données réactives avec `clone()` (`lib/clone.ts`), pas `structuredClone`.
- **Format d'échange** (`axomaster.pack`) : toute modification du schéma de carte impose
  d'incrémenter `PACK_VERSION` et d'ajouter une migration dans `pack.ts`, avec un test.
- **Contrats d'API** : ajouter / modifier le schéma dans `card-model/src/api.ts`, valider les
  entrées côté Worker avec `readJson(c, schema)`, renvoyer les erreurs via `HttpError` (message
  français affiché tel quel par le front).
- Design sobre et classique : utiliser les tokens CSS de `styles/tokens.css` et les classes de
  `styles/base.css` (`.btn`, `.input`, `.field`, `.segmented`…) ; pas de framework CSS.
  Charte graphique : Inter partout (la serif Cormorant Garamond est réservée aux faces de cartes,
  via `--font-serif`), accent violet `--accent` / `--accent-strong`, fond nuit `--night`, logo X
  (`components/brand/AxoX.vue`), dégradé `--brand-gradient` en touche.
- **Thème clair / sombre** : par défaut celui de l'appareil, forçable depuis l'en-tête
  (`composables/useTheme.ts`, `<html data-theme>`, script anti-flash dans `index.html`). Les
  couleurs passent par les tokens (bloc `[data-theme='dark']` de `tokens.css`), jamais en dur.
  Les faces de cartes restent claires ; la page Boosters et la scène d'ouverture restent « nuit ».
- **Mobile obligatoire** : tout doit fonctionner au doigt sur téléphone. Point de rupture unique
  `max-width: 860px` (`MOBILE_QUERY` dans `composables/useMediaQuery.ts`) ; adaptations tactiles
  via `@media (pointer: coarse)` (pas de survol, cibles ≥ 36 px, champs en 16 px contre le zoom iOS).
  Sur mobile : barre d'onglets en bas, éditeur plein écran avec panneaux en onglets, dialogues en
  feuille basse. Gestes de l'éditeur en Pointer Events (glisser, pincer à deux doigts).
- Formatage : Prettier (sans point-virgule, guillemets simples, 100 colonnes).
- Nommer les scripts pnpm autrement que les commandes intégrées (`deploy`, `publish`…) :
  d'où `release`.

## Déploiement

Cloudflare (Worker + D1), via `.github/workflows/deploy.yml` déclenché par chaque tag poussé :
tests, build, `wrangler d1 migrations apply --remote`, `wrangler deploy`. Procédure complète :
`docs/deploiement.md`. Garder `base: './'` dans `vite.config.ts`, `createWebHashHistory()` et des
URL relatives : ne jamais écrire de chemin absolu (`/assets/…`, `/api/…`) côté front.
`VITE_APP_VERSION` contient le tag publié.

## Hors périmètre actuel

Connexion Microsoft Entra ID (prévue : colonne `users.external_id`, routes OIDC dans
`routes/auth.ts`), app mobile Flutter. Garder `card-model` indépendant de Vue pour pouvoir en
dériver un JSON Schema.
