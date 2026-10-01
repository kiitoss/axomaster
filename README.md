# AxoMaster

Générateur de cartes à collectionner — collaborateurs, événements, projets —
inspiré de WikiMasters. Démo 100 % front : les données restent dans le navigateur.

## Démarrer

```bash
pnpm install
pnpm dev          # http://localhost:5173
```

| Script           | Rôle                                         |
| ---------------- | -------------------------------------------- |
| `pnpm dev`       | Serveur de dev de l'app web                  |
| `pnpm build`     | Typecheck + build de production (`apps/web/dist`) |
| `pnpm typecheck` | Vérification TypeScript de tout le monorepo  |
| `pnpm test`      | Tests unitaires (`card-model`)               |
| `pnpm lint`      | ESLint                                       |

Le build est statique (routes en hash, chemins relatifs) : `apps/web/dist` peut être servi tel quel
depuis n'importe quel hébergement, à la racine comme dans un sous-dossier.

Tester le build de production en local : `pnpm build && pnpm preview`.

## Déploiement (GitHub Pages)

Site : **https://kiitoss.github.io/axomaster/**

Chaque tag poussé déclenche `.github/workflows/deploy.yml` (tests, build, publication) :

```bash
git tag v1.0.0
git push origin v1.0.0
```

Le tag publié s'affiche en bas de la galerie. Le workflow peut aussi être lancé à la main depuis
l'onglet **Actions** (« Run workflow »).

Configuration à faire une seule fois sur GitHub :

1. **Settings → Pages → Build and deployment → Source : GitHub Actions**.
2. **Settings → Environments → github-pages → Deployment branches and tags** : ajouter une règle
   de type **Tag** avec le motif `*`. Par défaut seule la branche `main` peut déployer, et un
   déploiement depuis un tag est refusé (« Tag … is not allowed to deploy to github-pages due to
   environment protection rules »).

## Structure

```
packages/card-model   Modèle de carte partagé : schémas zod, types, raretés, format d'échange versionné
apps/web              App Vue 3 + Vite + Pinia
  src/components/card     CardView : rendu unique de la carte (630 × 880, mis à l'échelle)
  src/components/editor   Éditeur : calques, canvas interactif, propriétés
  src/components/gallery  Plein écran, import / export
  src/storage             localStorage (cartes) + IndexedDB (images), derrière une interface
  src/stores/cards.ts     Store Pinia : CRUD, collections, import / export
```

## Fonctionnalités

- **Éditeur hybride** : carte structurée (nom, sous-titre, description, collection, numéro, rareté,
  photo recadrable) + calques libres (texte, image, rectangle, ellipse, ligne) déplaçables,
  redimensionnables, pivotables, avec magnétisme au centre, verrouillage, masquage, ordre.
  Annuler / rétablir, raccourcis clavier (Ctrl+S, Ctrl+Z/Y, Ctrl+D, Suppr, flèches).
- **Raretés** : Commune → Légendaire, avec cadre et reflet holographique dédiés.
- **Galerie** : recherche, filtres (collection, rareté, provenance / auteur), tri, vue plein écran
  avec navigation clavier, export PNG.
- **Partage** : export d'un paquet `.json` (cartes + images embarquées) ; import avec récapitulatif et
  gestion des doublons. Les cartes importées gardent leur auteur et sont filtrables.

## Format d'échange

```jsonc
{
  "format": "axomaster.pack",
  "version": 1,
  "exportedAt": "2026-10-01T12:00:00.000Z",
  "author": "Camille",
  "categories": [{ "id": "…", "name": "Collaborateurs", "color": "#3f5d8c" }],
  "cards": [/* voir packages/card-model/src/schema.ts */],
  "images": { "<imageId>": "data:image/webp;base64,…" }
}
```

Toute évolution du schéma doit incrémenter `PACK_VERSION` et ajouter une migration dans
`packages/card-model/src/pack.ts`, pour que les anciens fichiers restent lisibles.

## Suite prévue

Backend + comptes, échange de cartes entre joueurs, ouverture de boosters, app mobile Flutter
(le schéma zod de `card-model` pourra être exporté en JSON Schema pour générer les modèles Dart).
