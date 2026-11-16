# Architecture

## Deux dépôts

| Dépôt | Contenu |
|---|---|
| **crm-batiment-api** (celui-ci) | API NestJS 11 — REST `/api/v1`, socket.io, Prisma 7 / PostgreSQL |
| **crm-batiment-web** | React 19 + Vite — back-office, portails, pages publiques |

Le contrat commun (rôles, formats d'erreur et de pagination, types de session) est dans
`src/shared/` des **deux** dépôts — voir `docs/contract.md`.

## Backend (`src`)

```
main.ts / app.setup.ts       Démarrage ; configuration HTTP partagée avec les tests
app.module.ts                Assemble les modules, couche par couche
config/                      Validation des variables d'environnement (zod)
prisma/                      PrismaService (global), type DbClient pour les transactions
generated/                   Client Prisma généré (non versionné)
common/                      Transverse, SANS logique métier
  auth/                        Types JWT/utilisateur, groupes de rôles
  decorators/                  @Public @Roles @CurrentUser @AllowPasswordChangeToken
  guards/                      Authentification (JWT + état du compte) et rôles — globaux
  filters/                     Toute erreur → format ApiErrorResponse
  interceptors/                Decimal → number dans les réponses
  middleware/                  X-Request-Id + journal des requêtes
  exceptions/                  BusinessException (422 + code stable)
  money/                       Calculs monétaires exacts (Decimal)
  pagination/                  DTO de base, skip/take, tri sur liste blanche
  references/                  Numérotation atomique DEV-2026-0001…
  validators/                  Politique de mot de passe, transformations de DTO
modules/
  core/                        health · mail · auth · users · company · storage (fichiers, étape 11)
  referentiel/                 clients · types-projet · fournisseurs · catalogue
    catalogue/
      categories/ materiaux/ services-mo/ prestations/ options/
      compositions/              DTO et validation partagés (prestations ET choix)
      pricing/                   calculator.ts (pur, testé) + service (charge les données)
      overview/                  arbre du catalogue + contrôle de cohérence
  commercial/
    demandes-devis/              demandes + conversion en devis (P0.1)
    devis/
      devis-status.ts              machine à états (pure, testée) — SEUL endroit qui définit les transitions
      devis.calculator.ts          totaux et marge (purs, testés)
      devis.views.ts               ce que voit chaque public : bureau, chef de chantier, client
      devis.service.ts             lecture, création, duplication, recalcul des totaux
      devis-lignes.service.ts      lignes (catalogue + choix, ou libres)
      devis-lifecycle.service.ts   SEUL endroit qui change un statut (transition conditionnelle)
      public/                      liens client : jetons, code à usage unique, routes publiques
  execution/
    chantiers/                   chantiers, tâches, documents, plan 2D, accès sous-traitants
    sous-traitants/              fiche, contrats, assurances (+ tâche quotidienne), paiements, notes
  finance/
    factures/                    acompte, situations, finale, émission numérotée, avoirs
    commandes-fournisseur/       génération P0.4 (material-needs.ts, pur), envoi, réceptions
    stock/                       mouvements atomiques (SEUL endroit qui change un stock)
  pilotage/                    écoutent les événements (SavModule est aussi utilisé par l'espace client)
    audit/                       événements → historique (prix, signatures, devis, factures)
    notifications/               événements → notifications par destinataire + socket.io
    sav/ dashboard/ demo-requests/
    sandbox/                     étape 15 — démo en ligne (instance séparée, remise à zéro chaque nuit)
                                 + données d'exemple (demo-scenario.ts, construit via les vrais services)
  workflow/                    devis accepté → commandes ; devis signé → chantier + acompte
                               (branché sur les « hooks » du devis, dans SA transaction)
  portails/                    étape 11 — les vues extérieures
    sous-traitant/               chantiers ouverts, avancement de ses tâches, dossier
    rapports/                    rapports + photos (portail) ; validation par le bureau/chef
    fournisseur/                 ses commandes : accusé de réception, expédition
    espace-client/               lien emailé (sans compte) : devis, factures, chantiers, SAV
  ia/
    assistant/                   étape 14 — chatbot public, prospects, base de connaissances
      llm/                         interface LlmClient + OpenAI (remplaçable, simulé en test)
      prompt.ts · prospect-fields.ts · sensitive-output.ts   fonctions pures, testées
    devis-ia/                    étape 15 — propose des lignes du catalogue à partir d'une description
      catalogue-match.ts · devis-ia.prompt.ts   fonctions pures, testées (mots-clés, validation)
  …
database/seed/                 données de départ (entreprise, comptes, catalogue JSON, base de connaissances)
                               utilisées par `pnpm db:seed` ET par la démo en ligne
cli.ts                         `pnpm demo:exemples` / `pnpm demo:reset` (application sans serveur HTTP)
```

## Règles de dépendance

```
workflow, portails, pilotage, ia
            ↓
commercial · execution · finance
            ↓
       referentiel
            ↓
 core · common · prisma · config
```

Un module n'importe jamais une couche au-dessus de lui. Les effets de bord (audit,
notifications, emails, WhatsApp) écoutent des **événements** émis après enregistrement
(ex. `catalogue.prix.modifie`) : personne n'a besoin de les importer.

## Machines à états

Chaque statut (devis, demande, chantier, facture, commande, contrat) a sa table de transitions,
déclarée avec `defineStateMachine` (`common/state-machine`). Un changement de statut est une
**action** (`POST /…/:id/emettre`) et une **mise à jour conditionnelle**
(`WHERE id = ? AND statut = <statut lu>`) : deux clics simultanés ne produisent jamais deux effets.

## Forme d'un module

```
clients/
  clients.module.ts       déclare controller + service, exporte ce que d'autres modules utilisent
  clients.controller.ts   HTTP uniquement : routes, @Roles, DTO → service
  clients.service.ts      règles métier + requêtes Prisma, toujours filtrées par companyId
  dto/clients.dto.ts      validation des entrées (class-validator + transforms communs)
```

Quand une logique est calculatoire (prix, totaux, validation), elle va dans une **fonction
pure** à part (`pricing.calculator.ts`, `catalogue-validation.ts`) testée sans base de données.

## Tests

| Type | Où | Base de données |
|---|---|---|
| Unitaires | `src/**/*.spec.ts`, à côté du code | non |
| e2e | `test/*.e2e-spec.ts` (HTTP réel via `test/helpers/test-app.ts`) | oui (migrée + seedée) |
| Couverture RBAC | `test/rbac-coverage.e2e-spec.ts` : chaque route a `@Roles` ou `@Public` | oui |

Voir aussi : `conventions.md`, `rbac-matrix.md`, `schema-v2.md`, `catalogue-seed.md`.

## Fichiers (étape 11)

```
POST /fichiers (multipart « file »)  →  FichiersService.create
   1. type lu dans les premiers octets (JPG, PNG, WebP, PDF) — ni le nom ni le Content-Type ne comptent
   2. StorageService.save → STORAGE_DIR/<companyId>/<aaaa-mm>/<uuid>.<ext>   (hors git, hors base)
   3. ligne Fichier (métadonnées) ; si elle échoue, les octets sont supprimés
GET /fichiers/:id/contenu  →  contrôle d'accès à CHAQUE téléchargement (404 si refusé)
                              → flux + nosniff + CSP sandbox + cache privé
```

Les fichiers ne sont jamais servis en statique. Taille max : `UPLOAD_MAX_MB` (multer, 413).
Sauvegarde : `STORAGE_DIR` avec la base de données. Passer à S3 = réécrire les 3 méthodes de `StorageService`.

