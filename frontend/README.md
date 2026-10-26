# CRM Bâtiment — Web

Application web du CRM Bâtiment : back-office (bureau, chef de chantier), portails
sous-traitant et fournisseur, pages publiques (lien de devis, espace client, demande de démo).

React 19 · Vite 7 · Tailwind 4 · TanStack Query · React Router 7 · Recharts.

L'API est dans le dépôt **crm-batiment-api** : démarrez-la d'abord (`pnpm dev`, port 3000).

## Démarrage

```bash
pnpm install
cp .env.example .env        # Windows : copy .env.example .env
pnpm dev                    # http://localhost:5173
```

En développement, Vite redirige `/api` et `/socket.io` vers `http://localhost:3000`
(autre adresse : `API_PROXY_TARGET=http://… pnpm dev`). Aucun réglage CORS n'est nécessaire.

Connexion avec un compte de démo de l'API (ex. `admin@batiment-pro.fr` / `Admin@2026!`).

## Commandes

| Commande | Rôle |
|---|---|
| `pnpm dev` | Serveur de développement |
| `pnpm build` | Vérification TypeScript + build de production (`dist/`) |
| `pnpm preview` | Sert le build localement |
| `pnpm typecheck` | Vérification TypeScript |
| `pnpm lint` | ESLint |

## Production

`pnpm build` produit des fichiers statiques (`dist/`) à servir derrière n'importe quel serveur
web, avec une règle « toutes les routes → `index.html` » (routeur côté navigateur).

| Variable | Valeur |
|---|---|
| `VITE_API_URL` | `/api/v1` si l'API est servie sur le même domaine (proxy), sinon `https://api.mon-crm.fr/api/v1` |
| `VITE_WS_URL` | Vide si même domaine, sinon `https://api.mon-crm.fr` |
| `VITE_DEMO_URL` | Facultatif : adresse de la démo en ligne, proposée sur la page `/demo` |

Côté API, ajoutez l'adresse du web dans `CORS_ORIGINS` et `APP_URL`.

## Pages publiques

| URL | Contenu |
|---|---|
| `/` | Page d'accueil (visiteurs) — les utilisateurs connectés vont directement à leur espace |
| `/demo` | Formulaire « demander une démo » |
| `/chat?entreprise=1` | Assistant IA public (chatbot) — à intégrer au site de l'entreprise |
| `/devis/lien/:token` | Lien de devis envoyé au client (accepter, refuser, signer) |
| `/espace-client/:token` | Espace client sans compte : devis, factures, chantiers, SAV |

## Assistant IA sur le site de l'entreprise

```html
<iframe src="https://crm.mon-entreprise.fr/chat?entreprise=1"
        style="position:fixed;bottom:16px;right:16px;width:380px;height:600px;border:0;border-radius:12px;box-shadow:0 10px 30px rgba(0,0,0,.2)"
        title="Assistant"></iframe>
```

`VITE_CHATBOT_COMPANY_ID` fixe l'entreprise par défaut si `?entreprise=` est absent.
Les conversations arrivent dans **Assistant IA** (menu bureau) : statut *À qualifier* dès
que nom + téléphone/email + besoin sont connus, puis « Qualifier » crée la demande de devis.

## Étape 15 : Devis IA et démo en ligne

- **Devis IA** : bouton « Proposer avec l'IA » dans un devis modifiable → description des travaux,
  lignes du catalogue proposées avec quantités, à cocher / corriger avant « Ajouter au devis ».
- **Démo en ligne** : si l'API est une instance de démo (`DEMO_MODE=true`), la page de connexion
  propose un bouton par rôle (sans mot de passe) et un bandeau rappelle que les données sont fictives.
  Rien à configurer côté web : le web le demande à l'API (`GET /public/demo`).

## Documentation

| Document | Contenu |
|---|---|
| `docs/architecture.md` | Organisation du code, règles, design (ancien frontend BÂTIFLOW) |
| `docs/contract.md` | Types partagés avec l'API (`src/shared/`) |
