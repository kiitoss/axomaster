# AxoMaster

Jeu de cartes à collectionner — collaborateurs, événements, projets — inspiré de WikiMasters.
Les administrateurs créent et publient les cartes ; les joueurs les découvrent dans des boosters
et se les échangent.

## Démarrer

```bash
pnpm install
pnpm db:migrate   # crée la base D1 locale (apps/api/.wrangler)
pnpm db:seed      # comptes de démo : admin / admin1234, alice / alice1234, bob / bob12345
pnpm dev          # http://localhost:5173 (Vite) + API sur :8787 (wrangler dev)
```

Connecté en `admin`, ouvrez la galerie (**Administration**), chargez les cartes d'exemple puis
publiez-les : elles apparaissent face cachée dans le catalogue des joueurs.

| Script            | Rôle                                                    |
| ----------------- | ------------------------------------------------------- |
| `pnpm dev`        | Front (Vite) et API (wrangler) en parallèle             |
| `pnpm build`      | Typecheck + build du front (`apps/web/dist`)            |
| `pnpm typecheck`  | Vérification TypeScript de tout le monorepo             |
| `pnpm test`       | Tests unitaires (`card-model`) et d'intégration (`api`) |
| `pnpm lint`       | ESLint                                                  |
| `pnpm db:migrate` | Applique les migrations D1 en local                     |
| `pnpm release`    | Build + déploiement Cloudflare (voir ci-dessous)        |

## Déploiement

Hébergement gratuit sur Cloudflare (Worker + D1), déclenché par chaque tag poussé :
procédure complète dans **[docs/deploiement.md](docs/deploiement.md)**.

## Structure

```
packages/card-model   Modèle partagé : schémas zod (cartes, paquets, contrats d'API), raretés,
                      tirage des boosters, quota de boosters
apps/api              Cloudflare Worker (Hono + D1) : API /api/* et service du front
  migrations/             Schéma SQL D1
  src/routes/             auth, admin, catalogue/boosters, échanges
  test/                   Tests d'intégration (vitest-pool-workers)
apps/web              App Vue 3 + Vite + Pinia
  src/api/client.ts       Client HTTP (URL relatives)
  src/stores/             auth, cartes (admin), collection (joueur), échanges
  src/components/card     CardView : rendu unique de la carte (630 × 880, mis à l'échelle)
  src/components/editor   Éditeur : calques, canvas interactif, propriétés
```

## Fonctionnalités

**Joueurs**

- **Catalogue** : toutes les cartes publiées, par collection ; celles qu'on ne possède pas restent
  face cachée (seul leur numéro est visible). Compteur d'exemplaires pour les doublons.
- **Boosters** : un booster gratuit par période (un jour par défaut, réglable), cumulables jusqu'à
  une réserve maximale, plus les boosters offerts par l'administrateur. Tirage côté serveur.
- **Échanges** : proposition de cartes contre cartes à un autre joueur, acceptation ou refus ;
  l'échange est atomique (il échoue proprement si une carte n'est plus disponible).

**Administrateurs**

- **Éditeur hybride** : carte structurée + calques libres (texte, image, formes), annuler /
  rétablir, raccourcis clavier.
- **Galerie** : brouillons et cartes publiées, publication en lot, import / export de paquets.
- **Joueurs** : création de comptes, réinitialisation de mot de passe, rôles, désactivation.
- **Réglages** : fréquence et taille des boosters, bouton « Offrir un booster à tous ».

Connexion par identifiant et mot de passe ; la connexion Microsoft (Entra ID) est prévue.

## Format d'échange

```jsonc
{
  "format": "axomaster.pack",
  "version": 1,
  "exportedAt": "2026-10-01T12:00:00.000Z",
  "author": "Camille",
  "categories": [{ "id": "…", "name": "Collaborateurs", "color": "#3f5d8c" }],
  "cards": [/* voir packages/card-model/src/schema.ts */],
  "images": { "<imageId>": "data:image/webp;base64,…" },
}
```

Toute évolution du schéma doit incrémenter `PACK_VERSION` et ajouter une migration dans
`packages/card-model/src/pack.ts`, pour que les anciens fichiers restent lisibles.
