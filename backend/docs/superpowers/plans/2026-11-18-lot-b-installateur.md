# Lot B — installateur délégué — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Routes for the delegated installation (office follow-up + installer missions, dates, step photos, problems, PV with QR).

**Architecture:** New module `execution/installations` (Installation, InstallationEvenement, Signalement); a hook on `DevisHooks.onSigned` creates the installation of a REGIE job site in the quote's transaction; installer side reuses the SOUS_TRAITANT account (`SousTraitant.installateur`). PV PDF reuses `construirePdf`; receptions of lot A are opened to the installer of the order's job site.

**Tech Stack:** NestJS 11, Prisma 7, PostgreSQL, pdf-lib, Jest + supertest.

**Spec:** `backend/docs/superpowers/specs/2026-11-18-lot-b-installateur-design.md`

## Global Constraints

- Web unchanged; one additive migration `20261118180000_mobile_lot_b`.
- Office routes: ADMIN, ASSISTANTE (`FACTURATION` group, renamed locally `GESTION`). Installer routes: SOUS_TRAITANT whose `SousTraitant` is the installation's installer (else 404).
- No price ever in installer answers (articles: description, quantity, unit only).
- Status changes are POST actions with a conditional `updateMany` on the current step (race → 409 `INSTALLATION_MODIFIEE`).
- Every action writes one `InstallationEvenement` line (chronology) in the same transaction.

## Review Focus

1. A quote signed twice (retry) or a REGIE job site already delegated → still one installation (`chantierId` unique, hook idempotent). Test in Task 2.
2. Installer refuses then the office proposes another installer → the first one no longer sees the mission (404). Test in Task 3.
3. Moving to POSE without any LIVRAISON photo → 422 `PHOTO_ETAPE_MANQUANTE`. Test in Task 3.
4. PV QR of another installation / wrong code → 422 `PV_QR_INVALIDE`, step unchanged. Test in Task 4.
5. Installer reading the order of an installation that is not his → 404 on receptions too. Test in Task 3.

---

### Task 1: Schema, migration, references, installer flag
**Files:** `prisma/schema.prisma`, migration, `common/references/reference.service.ts` (`INSTALLATION: 'INS'`), `core/storage/fichiers.service.ts` (links `installationId`, `installationEtape`, `signalementId`; read: office, uploader, the installer of the installation), `execution/sous-traitants` DTO + select (`installateur: boolean`).
- [ ] Models / enums (`InstallationEtape`, `SignalementType`, `SignalementStatut`), migration applied on a lot A database copy, schema = base.
- [ ] Commit.

### Task 2: Office side (`/installations`)
**Files:** `execution/installations/{installations.module,installations.controller,installations.service,installations.dto,installations.events,installation-rules}.ts` + `installation-rules.spec.ts`; `workflow/devis-workflow.service.ts` (create on signature when the effective mode is REGIE).
**Produces:** `InstallationsService.creerDepuisChantier(tx, chantierId, devisId|null, userId|null)`, `etapeSuivante(etape)`, `alertes(installation, commandes, now)`.
Routes: `GET /installations` (etape?, enRetard?, alerteLivraison?, search?), `GET /installations/compteurs`, `GET /installations/installateurs`, `GET /installations/:id`, `POST /installations {chantierId}`, `POST /:id/attribuer {sousTraitantId, note?, dateSouhaitee?}`, `POST /:id/relancer`, `POST /:id/dates/accepter`, `PATCH /:id {dateSouhaitee?, note?}`, `POST /:id/cloturer`, `DELETE /:id` (before acceptance), `POST /:id/pv/valider`, `POST /:id/pv/rejeter {motif}`, `POST /:id/signalements/:sid/traiter`, `POST /:id/signalements/:sid/sav`, `GET /:id/pv`.
- [ ] e2e: signature of a REGIE quote creates one installation (twice → one); LES_DEUX: none until POST; attribuer → INSTALLATEUR_PROPOSE + installer notified; compteurs; technico → 403.
- [ ] Implement; commit.

### Task 3: Installer side (`/installateur/missions`) + deliveries
**Files:** `execution/installations/installateur.controller.ts`, `installateur.service.ts`; `finance/commandes-fournisseur` scope + roles for SOUS_TRAITANT installer (list / detail / receptions / reception files), amounts stripped.
Routes: `GET /installateur/missions` (filtre `PROPOSEES | EN_COURS | TERMINEES`), `GET /:id`, `POST /:id/accepter`, `POST /:id/refuser {motif}`, `POST /:id/dates/confirmer`, `POST /:id/dates/proposer {date}`, `POST /:id/etapes/:etape/photos` (multipart `photos`), `POST /:id/avancer {etape}`, `POST /:id/signalements` (multipart `type, description, savDemande?, photos`), `GET /:id/pv`, `GET /installateur/pv/verifier?contenu=`, `POST /:id/pv` (multipart `fichier, qrContenu?, latitude?, longitude?`).
- [ ] e2e: accept / refuse (motif) → reattribution, first installer 404; dates propose → office accepts → LIVRAISON; photos then avancer POSE / FINITIONS; avancer without photo → 422; signalement → admin notified → office makes a SAV; reception by installer with gaps, no price; other installer → 404.
- [ ] Implement; commit.

### Task 4: PV with QR
**Files:** `execution/installations/installation-pv.service.ts` (`contenuQrPv`, `genererPv`, `verifierQr`).
- [ ] e2e: PDF downloads (`%PDF`); scan with the right QR → TERMINEE + admin notified; wrong QR → 422 PV_QR_INVALIDE; manual → `pvAVerifier`, office validates → TERMINEE; cloturer → CLOTUREE.
- [ ] Implement; commit.

### Task 5: Notifications, audit, docs, delivery
- [ ] Listener rules; RBAC doc; endpoints txt; delivery txt; zips; final self-review.
