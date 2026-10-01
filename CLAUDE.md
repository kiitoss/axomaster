# CLAUDE.md

AxoMaster : générateur de cartes à collectionner (personnes, événements, projets), inspiré de
WikiMasters. Démo 100 % front, sans backend : tout est stocké dans le navigateur.

## Commandes

```bash
pnpm install
pnpm dev          # app web (Vite)
pnpm typecheck    # tsc (card-model) + vue-tsc (web)
pnpm test         # vitest (card-model)
pnpm lint         # eslint
pnpm build        # typecheck + build de production
```

Avant de considérer une tâche terminée : `pnpm typecheck && pnpm lint && pnpm test`.

## Architecture

Monorepo pnpm (`pnpm-workspace.yaml`), TypeScript strict (`tsconfig.base.json`).

- `packages/card-model` — TS pur, sans dépendance UI. Source de vérité du modèle.
  - `schema.ts` : schémas zod (carte, calques, collections, paquet d'échange). Les types de
    `types.ts` sont **dérivés** des schémas (`z.infer`) : modifier le schéma, pas les types.
  - `pack.ts` : `createPack` / `parsePack` + migrations de version.
  - `rarities.ts`, `defaults.ts` : raretés, dimensions de référence, fabriques (`createBlankCard`,
    `createTextLayer`…), `newId()`.
  - Consommé directement en source (`exports: ./src/index.ts`), pas d'étape de build.
- `apps/web` — Vue 3 (`<script setup>`), Vite, Pinia, vue-router (hash history), lucide-vue-next.
  - `components/card/CardView.vue` : **rendu unique** d'une carte, partout (galerie, plein écran,
    éditeur, export PNG). Dessinée à 630 × 880 px puis mise à l'échelle par `transform: scale`.
  - `components/editor/` : `LayerPanel`, `EditorCanvas` (overlay de sélection / poignées),
    `PropertiesPanel`. L'état est partagé via `provideEditor` / `useEditor`
    (`composables/editor.ts`), pas via des props.
  - `composables/useHistory.ts` : annuler / rétablir par instantanés JSON, regroupés par
    temporisation ; les actions structurelles appellent `checkpoint()`.
  - `stores/cards.ts` : store Pinia (cartes, collections, nom de l'auteur, import / export,
    nettoyage des images orphelines).
  - `storage/` : `repository.ts` (localStorage, derrière l'interface `CardRepository`) et
    `imageStore.ts` (IndexedDB via idb-keyval).

## Conventions et invariants

- **Interface en français** uniquement (pas d'i18n). Commentaires de code en français.
- Coordonnées des calques en **% de la carte** ; tailles de police en px de la carte de référence.
  L'ordre du tableau `layers` est l'ordre d'empilement (dernier = devant).
- Les **images ne vont jamais dans le localStorage** : stocker le blob dans IndexedDB
  (`putImage`) et ne garder que l'`imageId` dans la carte. Compresser avant (`compressImage`,
  WebP ≤ 1200 px). Penser à `collectGarbage()` après suppression.
- Copier les données réactives avec `clone()` (`lib/clone.ts`), pas `structuredClone`.
- **Format d'échange** (`axomaster.pack`) : toute modification du schéma de carte impose
  d'incrémenter `PACK_VERSION` et d'ajouter une migration dans `pack.ts`, avec un test.
- Design sobre et classique : utiliser les tokens CSS de `styles/tokens.css` et les classes de
  `styles/base.css` (`.btn`, `.input`, `.field`, `.segmented`…) ; pas de framework CSS.
  Titres en Cormorant Garamond (serif), interface en Inter, un seul accent doré.
- **Mobile obligatoire** : tout doit fonctionner au doigt sur téléphone. Point de rupture unique
  `max-width: 860px` (`MOBILE_QUERY` dans `composables/useMediaQuery.ts`) ; adaptations tactiles
  via `@media (pointer: coarse)` (pas de survol, cibles ≥ 36 px, champs en 16 px contre le zoom iOS).
  Sur mobile : barre d'onglets en bas, éditeur plein écran avec panneaux en onglets, dialogues en
  feuille basse. Gestes de l'éditeur en Pointer Events (glisser, pincer à deux doigts).
- Formatage : Prettier (sans point-virgule, guillemets simples, 100 colonnes).

## Hors périmètre actuel

Backend, comptes, échange de cartes, boosters, app mobile Flutter. Garder `card-model`
indépendant de Vue pour pouvoir le réutiliser côté serveur et en dériver un JSON Schema.
