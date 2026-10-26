# CRM Bâtiment — API

API REST du CRM Bâtiment : NestJS 11 (CommonJS, TypeScript strict), Prisma 7, PostgreSQL 16,
socket.io pour les notifications temps réel.

L'application web est dans le dépôt **crm-batiment-web**.

## Prérequis

- Node.js 22 (`node -v`)
- pnpm : `corepack enable`, puis `pnpm -v`
- Docker Desktop (PostgreSQL et Mailpit)

## Démarrage

```bash
pnpm install
cp .env.example .env            # Windows : copy .env.example .env

pnpm db:up                      # PostgreSQL (port 5433) + Mailpit
pnpm db:migrate --name init     # 1re fois : crée et applique la migration
pnpm db:seed                    # comptes de démo, types de projet, catalogue

pnpm dev                        # http://localhost:3000
```

| URL | Contenu |
|---|---|
| http://localhost:3000/api/v1/health | Health check |
| http://localhost:3000/api/docs | Swagger |
| http://localhost:8025 | Emails envoyés en développement (Mailpit) |

Le web (crm-batiment-web) tourne sur http://localhost:5173 et appelle cette API via le proxy
Vite : aucune configuration CORS n'est nécessaire en développement. En production, mettez
l'URL du web dans `CORS_ORIGINS` et `APP_URL`.

## Commandes

| Commande | Rôle |
|---|---|
| `pnpm dev` | API en mode watch |
| `pnpm build` / `pnpm start:prod` | Build et lancement de production |
| `pnpm typecheck` | Vérification TypeScript |
| `pnpm lint` | ESLint |
| `pnpm test` | Tests unitaires |
| `pnpm test:e2e` | Tests e2e (base démarrée, migrée et seedée) |
| `pnpm db:up` / `pnpm db:down` | Démarre / arrête PostgreSQL et Mailpit |
| `pnpm db:migrate --name xxx` | Migration après modification du schéma |
| `pnpm db:seed` | Données de démo (idempotent) |
| `pnpm db:reset` | Vide la base, rejoue migrations et seed |
| `pnpm db:studio` | Interface graphique Prisma |
| `pnpm demo:exemples` | Ajoute des clients, devis, chantiers… d'exemple (développement) |
| `pnpm demo:reset` | Instance de démo uniquement : efface et recharge toute la base |

## Comptes de démo (après `pnpm db:seed`)

| Rôle | Email | Mot de passe |
|---|---|---|
| ADMIN | admin@batiment-pro.fr | Admin@2026! |
| TECHNICO | technico@batiment-pro.fr | Technico@2026! |
| ASSISTANTE | assistante@batiment-pro.fr | Assistante@2026! |
| CHEF_CHANTIER | chef@batiment-pro.fr | Chef@2026! |
| SOUS_TRAITANT | soustraitant@batiment-pro.fr | Soustraitant@2026! |
| FOURNISSEUR | fournisseur@batiment-pro.fr | Fournisseur@2026! |

## Assistant IA

Sans `OPENAI_API_KEY`, le chatbot fonctionne en mode guidé (sans IA, sans coût). Avec une clé,
il utilise OpenAI (`OPENAI_MODEL`, `gpt-4o-mini` par défaut). Détails : `docs/assistant.md`.

## Devis IA et démo en ligne (étape 15)

- **Devis IA** : dans un devis, « Proposer avec l'IA » → lignes du catalogue + quantités à partir
  d'une description, prix toujours issus du catalogue. Sans clé : recherche par mots-clés.
  Détails : `docs/assistant.md`.
- **Démo en ligne** : instance séparée (`DEMO_MODE=true`, base « …demo… »), connexion en un clic par
  rôle, remise à zéro chaque nuit. Détails : `docs/demo.md`.

## Fichiers déposés

Documents de chantier, attestations d'assurance et photos des rapports sont écrits dans
`STORAGE_DIR` (par défaut `./storage`, ignoré par git) — à sauvegarder avec la base.

## Conventions

- Toutes les routes : `/api/v1/...` ; protégées par défaut (`@Public()` pour ouvrir, `@Roles()` sinon).
- L'API refuse de démarrer si une variable d'environnement est absente ou invalide (`src/config/env.validation.ts`).
- Jamais de `.env`, `uploads/` ou `storage/` dans git.
- Montants en `Decimal`, statuts en enum Prisma.

| Document | Contenu |
|---|---|
| `docs/architecture.md` | Organisation du code, règles de dépendance, fichiers |
| `docs/conventions.md` | Comment écrire un module (controller, service, DTO) |
| `docs/rbac-matrix.md` | Droits par rôle et routes publiques |
| `docs/schema-v2.md` | Changements du schéma par rapport à l'ancien projet |
| `docs/contract.md` | Types partagés avec le web (`src/shared/`) |
| `docs/assistant.md` | Assistant IA (chatbot, Devis IA) : flux, sécurité, configuration OpenAI |
| `docs/demo.md` | Données d'exemple et démo en ligne |
