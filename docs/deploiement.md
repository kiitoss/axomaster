# Déployer AxoMaster sur Cloudflare (gratuit)

AxoMaster tourne sur **un seul Cloudflare Worker** : il sert le front (build Vite) et l'API
(`/api/*`), avec une base **D1** (SQLite). Tout tient dans le palier gratuit :

| Service         | Limite gratuite                                   |
| --------------- | ------------------------------------------------- |
| Workers         | 100 000 requêtes / jour, 10 ms de CPU par requête |
| D1              | 5 Go, 5 millions de lignes lues / jour            |
| R2 (facultatif) | 10 Go, moyen de paiement demandé à l'activation   |

Le site est publié sur `https://axomaster.<votre-sous-domaine>.workers.dev` (domaine personnalisé
possible ensuite).

## 1. Préparer le compte (une seule fois)

1. Créer un compte sur <https://dash.cloudflare.com/sign-up> (aucun moyen de paiement requis).
2. Dans **Workers & Pages**, choisir un sous-domaine `workers.dev`.
3. En local, à la racine du dépôt :

   ```bash
   pnpm install
   pnpm --filter @axomaster/api exec wrangler login
   ```

## 2. Créer la base D1

```bash
pnpm --filter @axomaster/api exec wrangler d1 create axomaster
```

Reporter le `database_id` affiché dans `apps/api/wrangler.jsonc` (champ `database_id`, à la place
des zéros), puis committer : cet identifiant n'est pas un secret.

Appliquer le schéma :

```bash
pnpm --filter @axomaster/api db:migrate:remote
```

## 3. (Facultatif) Stocker les images dans R2

Par défaut, les images des cartes (WebP ≤ 1200 px, compressées dans le navigateur) sont stockées
dans D1, ce qui suffit largement pour quelques centaines de cartes. Pour utiliser R2 :

```bash
pnpm --filter @axomaster/api exec wrangler r2 bucket create axomaster-images
```

puis décommenter le bloc `r2_buckets` de `apps/api/wrangler.jsonc`. Les images déjà stockées dans
D1 ne sont pas migrées automatiquement : à faire avant de créer des cartes.

## 4. (Facultatif) Activer les notifications push

Les notifications sont envoyées dans quatre cas : booster rechargé, booster offert, proposition
d'échange reçue, échange accepté ou refusé. Elles exigent trois secrets ; sans eux, l'API
fonctionne normalement mais la cloche n'apparaît pas.

```bash
pnpm vapid:keys      # affiche VAPID_PUBLIC_KEY et VAPID_PRIVATE_KEY
pnpm --filter @axomaster/api exec wrangler secret put VAPID_PUBLIC_KEY
pnpm --filter @axomaster/api exec wrangler secret put VAPID_PRIVATE_KEY
pnpm --filter @axomaster/api exec wrangler secret put VAPID_SUBJECT   # mailto:<adresse de contact>
```

Ne pas régénérer les clés ensuite : tous les appareils abonnés devraient réactiver les
notifications. Les recharges de boosters sont vérifiées par un cron du Worker toutes les 5 minutes
(`triggers` dans `wrangler.jsonc`).

En local, mettre ces trois lignes dans `apps/api/.dev.vars` (ignoré par git). Pour déclencher le
cron à la main : `pnpm --filter @axomaster/api exec wrangler dev --test-scheduled`, puis
`curl "http://localhost:8787/__scheduled"`. Le push exige HTTPS (sauf sur `localhost`) : sur
téléphone, tester sur le site déployé. Sur iPhone, il faut d'abord ajouter le site à l'écran
d'accueil (Partager → Sur l'écran d'accueil), puis activer la cloche depuis l'app installée.

## 5. Premier déploiement

```bash
pnpm release         # build du front + wrangler deploy
```

Créer ensuite le compte administrateur (le mot de passe est demandé dans le terminal) :

```bash
pnpm --filter @axomaster/api create-user <identifiant> --admin --remote --name "Prénom Nom"
```

Se connecter sur le site : l'administrateur crée ensuite les joueurs depuis **Administration →
Joueurs**, et peut charger les cartes d'exemple puis les publier depuis la galerie.

## 6. Déploiement continu (GitHub Actions)

Le workflow `.github/workflows/deploy.yml` se déclenche à chaque tag poussé : vérifications
(typecheck, lint, tests), build, migrations D1 puis déploiement.

1. Dans Cloudflare : **My Profile → API Tokens → Create Token**, modèle **Edit Cloudflare
   Workers**, puis ajouter la permission **Account → D1 → Edit**.
2. Dans GitHub : **Settings → Environments → New environment** `production`, et y ajouter les
   secrets :
   - `CLOUDFLARE_API_TOKEN` : le jeton créé ci-dessus ;
   - `CLOUDFLARE_ACCOUNT_ID` : visible dans la barre latérale du tableau de bord Cloudflare.
3. Publier une version :

   ```bash
   git tag v1.0.0 && git push origin v1.0.0
   ```

L'ancien site GitHub Pages peut être désactivé (**Settings → Pages**).

## Exploitation

- **Journaux en direct** : `pnpm --filter @axomaster/api exec wrangler tail`.
- **Requête SQL ponctuelle** :
  `pnpm --filter @axomaster/api exec wrangler d1 execute axomaster --remote --command "SELECT username, role FROM users"`.
- **Sauvegarde** : `pnpm --filter @axomaster/api exec wrangler d1 export axomaster --remote --output sauvegarde.sql`
  (D1 garde aussi 30 jours d'historique restaurable via _Time Travel_).
- **Mot de passe admin perdu** : relancer `create-user` avec le même identifiant et `--admin`, il remplace le
  mot de passe.

## Plus tard : connexion Microsoft (Entra ID)

La table `users` a déjà une colonne `external_id` (OID Entra). Il faudra une _App registration_
Azure (URI de redirection `https://<site>/api/auth/microsoft/callback`), deux routes OIDC dans
`apps/api/src/routes/auth.ts` qui ouvrent la même session que la connexion par mot de passe, et
les secrets `MICROSOFT_CLIENT_ID` / `MICROSOFT_CLIENT_SECRET` via `wrangler secret put`.
