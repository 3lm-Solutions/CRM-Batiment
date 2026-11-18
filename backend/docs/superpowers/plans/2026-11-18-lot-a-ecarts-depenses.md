# Lot A — écarts de livraison, dépenses, validations, recherche par ville — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the mobile app the routes it still lacks for delivery gaps, supplier invoices (dépenses), the admin validation tabs and client search by city, without changing the web.

**Architecture:** Extend the existing `Reception` (BL photo, gaps, control status) instead of a separate model; a new `DepensesModule` in `finance/`; a small `validations` controller for counters. Events after commit → `NotificationsListener` + `AuditListener`, like the rest of the API.

**Tech Stack:** NestJS 11, Prisma 7, PostgreSQL, class-validator, Jest + supertest (e2e).

**Spec:** `backend/docs/superpowers/specs/2026-11-18-lot-a-ecarts-depenses-design.md`

## Global Constraints

- Web unchanged: no web route removed or made stricter; a reception without `ecarts` behaves exactly as today.
- One additive migration `20261118120000_mobile_lot_a` (new tables / nullable columns / enum values only).
- Validators of receptions with gaps and of dépenses: `ADMIN`, `ASSISTANTE` (constant `FACTURATION`).
- Senders: `STAFF` (ADMIN, TECHNICO, ASSISTANTE, CHEF_CHANTIER).
- The chef never reads an amount: dépense amounts are stripped for `CHEF_CHANTIER` in every response.
- Status changes are POST actions guarded by a conditional `updateMany` (race → 409 `..._MODIFIEE`).
- Errors: `BusinessException(code, message, status?, details?)`; French messages.
- e2e only on the TEST database.

## Review Focus

1. A reception made only of gaps (nothing received: whole delivery missing / wrong items) → accepted (201), stock untouched, status `A_VERIFIER`. Test in Task 3.
2. Two office users decide the same reception / dépense at once → one wins, the other gets 409. Test in Tasks 3 and 4.
3. Same supplier invoice sent twice with a different case or spaces in the number (« fa 12 » vs « FA12 ») → 409 `DEPENSE_EXISTANTE`. Test in Task 4.
4. A chef opens someone else's dépense or its photo → 404, never the amounts. Test in Task 4.
5. HT + TVA ≠ TTC beyond 0,05 € (OCR misread) → 422 `MONTANTS_INCOHERENTS` so the phone asks for a correction (my call). Test in Task 4.

---

### Task 1: Schema, migration, file links

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20261118120000_mobile_lot_a/migration.sql`
- Modify: `src/common/references/reference.service.ts` (prefix `DEPENSE: 'DEP'`)
- Modify: `src/modules/core/storage/fichiers.service.ts` (`FichierLinks.receptionId?`, `FichierLinks.depenseId?`; `canRead`: a reception or dépense file → office or uploader only)

**Interfaces — Produces:**
- enum `ReceptionControle { SANS_ECART A_VERIFIER ACCEPTEE REFUSEE }`
- enum `EcartType { MANQUANT EN_TROP INCONNU ABIME }`
- enum `DepenseStatut { BROUILLON VALIDEE REFUSEE }`
- `Reception` + `statutControle ReceptionControle @default(SANS_ECART)`, `motifRefus String?`, `controleParId Int?`, `controleLe DateTime?`, relations `ecarts`, `fichiers`
- model `ReceptionEcart` (`@@map("receptions_ecarts")`): `id`, `receptionId` (cascade), `type EcartType`, `ligneCommandeId Int?`, `libelle String`, `quantite Decimal(12,3)?`, `commentaire String?`
- model `Depense` (`@@map("depenses")`): `id`, `companyId`, `reference @unique`, `fournisseurId Int?`, `fournisseurNom String`, `numeroFacture String`, `numeroNormalise String`, `dateFacture DateTime`, `montantHT/montantTVA/montantTTC Decimal(12,2)`, `chantierId Int?`, `commandeFournisseurId Int?`, `champsDouteux String[]`, `statut DepenseStatut @default(BROUILLON)`, `motifRefus String?`, `createurId Int?`, `valideParId Int?`, `valideLe DateTime?`, `fournisseurCle String`, timestamps; `@@unique([companyId, fournisseurCle, numeroNormalise])` (Step 3)
- `Fichier` + `receptionId Int?` (cascade), `depenseId Int?` (cascade), indexes

- [ ] **Step 1:** Add the enums, models, relations above to `schema.prisma` (back-relations on `Company`, `User`, `Fournisseur`, `Chantier`, `CommandeFournisseur`, `LigneCommandeFournisseur`).
- [ ] **Step 2:** Write the SQL migration by hand (enums, 2 tables, 6 nullable columns on `receptions`/`fichiers`, FKs, indexes, the unique index).
- [ ] **Step 3:** Duplicate key:  `fournisseurCle String` = `f:<fournisseurId>` or `n:<nom normalisé>`; `numeroNormalise` = uppercase, without spaces / `-` / `.` / `/`.
- [ ] **Step 4:** Apply on the local PG over a lot 1 database with data: `prisma migrate deploy` then `verif/schema_vs_db.py` → only the known array false positives.
- [ ] **Step 5:** Commit `feat(db): lot A — écarts de réception, dépenses, liens fichiers`.

### Task 2: Client search by city

**Files:** Modify `src/modules/referentiel/clients/clients.service.ts` (search `OR` + `adresseClient`, `adresseChantier`, `contains`, insensitive). Test: `test/mobile-lot-a.e2e-spec.ts`.

- [ ] **Step 1: failing e2e** `it('clients: search finds the city written in the address')`: create a client with `adresseClient: '12 rue X, 69003 Lyon'`; `GET /clients?search=lyon` contains its id; `search=lille` does not.
- [ ] **Step 2:** Implement; run the e2e test → PASS.
- [ ] **Step 3:** Commit.

### Task 3: Receptions with gaps and their validation

**Files:**
- Modify: `src/modules/finance/commandes-fournisseur/commandes.dto.ts` (`EcartDto`, `ReceptionDto.ecarts?`, `lignes` min 0 when `ecarts` present)
- Modify: `src/modules/finance/commandes-fournisseur/commandes.service.ts` (`receptionner`)
- Create: `src/modules/finance/commandes-fournisseur/receptions.controller.ts`, `receptions.service.ts`, `receptions.events.ts`
- Modify: `commandes.module.ts`, `pilotage/notifications/notifications.listener.ts`, `pilotage/audit/audit.listener.ts`

**Interfaces — Produces:**
- `EcartDto { type: EcartType; ligneId?: number; libelle: string; quantite?: number; commentaire?: string }`
- `ReceptionsService.liste(user, q: { statutControle?: ReceptionControle; commandeId?: number; page; limit })`, `.detail(user, id)`, `.ajouterFichier(user, id, file, position?)`, `.valider(user, id)`, `.refuser(user, id, motif)`
- events `ReceptionEvents.ECARTS = 'reception.ecarts'`, `.CONTROLEE = 'reception.controlee'` with `{ companyId, receptionId, commandeId, reference, auteurId, decision?, userId }`
- Routes: `POST /commandes-fournisseur/:id/receptions` (+ `ecarts`), `GET /receptions` (FACTURATION), `GET /receptions/:id` (STAFF; chef = his orders), `POST /receptions/:id/fichiers` (STAFF, author or office, multipart `fichier` + `latitude`/`longitude`), `POST /receptions/:id/valider`, `POST /receptions/:id/refuser { motif }` (FACTURATION)

- [ ] **Step 1: failing e2e tests**
  - `'reception without gaps: unchanged (SANS_ECART, stock +)'`
  - `'reception with gaps: A_VERIFIER, EN_TROP/INCONNU not in stock, office notified (type LIVRAISON_ECARTS)'`
  - `'gaps only, nothing received: 201, stock unchanged'`
  - `'chef adds the BL photo; admin validates → ACCEPTEE, chef notified; second decision → 409 RECEPTION_MODIFIEE'`
  - `'refuse needs a reason (400 without); technico → 403 on /receptions'`
- [ ] **Step 2:** Implement; ecarts with `ligneId` must belong to the order (else 422 `LIGNE_INTROUVABLE`); `statutControle = ecarts.length ? A_VERIFIER : SANS_ECART`; valider / refuser only from `A_VERIFIER` (else 422 `RECEPTION_NON_A_VERIFIER`); notification link `/commandes-fournisseur/:commandeId` (exists on the web).
- [ ] **Step 3:** Run `pnpm test:e2e -- mobile-lot-a` → PASS; run the old `commercial`/`workflow` suites → PASS.
- [ ] **Step 4:** Commit.

### Task 4: Dépenses (supplier invoices)

**Files:** Create `src/modules/finance/depenses/{depenses.module,depenses.controller,depenses.service,depenses.dto,depenses.events,depense-rules}.ts` + `depense-rules.spec.ts`; register in `app.module.ts`; listeners as in Task 3.

**Interfaces — Produces:**
- `normaliserNumero(n: string): string`, `fournisseurCle(fournisseurId: number | null, nom: string): string`, `assertMontants(ht, tva, ttc): void` in `depense-rules.ts`
- Routes (`/depenses`): `POST` (STAFF, multipart `fichier` + fields), `GET` (`statut?`, `chantierId?`, `search?`, page; chef = his own), `GET /:id`, `PATCH /:id` (BROUILLON, author or office), `DELETE /:id` (BROUILLON, author or office; files removed), `POST /:id/fichiers`, `POST /:id/valider`, `POST /:id/refuser { motif }` (FACTURATION)
- events `DepenseEvents.CREEE`, `.DECIDEE`; notification types `DEPENSE_A_VALIDER`, `DEPENSE_DECIDEE`; link `/validations` is NOT a web page → use `null` link for the office (my call), `/depenses/:id` only in push data

- [ ] **Step 1: unit tests** `depense-rules.spec.ts`: `normaliserNumero(' fa-12/b ') === 'FA12B'`; `assertMontants(100, 20, 120)` ok, `(100, 20, 120.04)` ok, `(100, 20, 130)` throws `MONTANTS_INCOHERENTS`.
- [ ] **Step 2: failing e2e tests**
  - `'chef sends a dépense: 201 BROUILLON; his list and detail have no montant*'`
  - `'same supplier + number written differently → 409 DEPENSE_EXISTANTE (details.depenseId)'`
  - `'other chef → 404 on the dépense and on its file'`
  - `'assistante validates → VALIDEE, author notified; refuse without reason → 400; second decision → 409'`
  - `'office sees amounts; PATCH after validation → 422 DEPENSE_NON_MODIFIABLE'`
- [ ] **Step 3:** Implement; amounts removed for the chef with the existing `stripAmounts` helper of `common/auth/hide-costs.ts` (`montantHT`, `montantTVA`, `montantTTC` are already in `AMOUNT_KEYS`); fournisseur by id must belong to the company.
- [ ] **Step 4:** Run unit + e2e → PASS. Commit.

### Task 5: Validation counters, docs, delivery

**Files:** Create `src/modules/finance/validations/validations.controller.ts` (in `DepensesModule`); modify `docs/rbac-matrix.md`; regenerate the simple endpoints txt; delivery txt + zips.

**Interfaces — Produces:** `GET /validations/compteurs` (FACTURATION) → `{ signaturesPapier: number | null, livraisons: number, depenses: number }` (`signaturesPapier` null for the assistante).

- [ ] **Step 1: failing e2e** `'validation counters follow the queues'`: after Task 3/4 fixtures, counts match; assistante gets `signaturesPapier: null`; chef → 403.
- [ ] **Step 2:** Implement; run all e2e locally where possible; typecheck harness; prettier.
- [ ] **Step 3:** Update rbac-matrix, endpoints txt (new section « Livraisons et dépenses »), delivery txt, zips. Commit.
