-- Application mobile — lot A (18/11/2026)
-- Ajouts seulement (types, colonnes facultatives ou avec valeur par défaut, nouvelles tables).

-- Contrôle des livraisons (bon de livraison, écarts)
CREATE TYPE "ReceptionControle" AS ENUM ('SANS_ECART', 'A_VERIFIER', 'ACCEPTEE', 'REFUSEE');
CREATE TYPE "EcartType" AS ENUM ('MANQUANT', 'EN_TROP', 'INCONNU', 'ABIME');
CREATE TYPE "DepenseStatut" AS ENUM ('BROUILLON', 'VALIDEE', 'REFUSEE');

ALTER TABLE "receptions" ADD COLUMN "statutControle" "ReceptionControle" NOT NULL DEFAULT 'SANS_ECART';
ALTER TABLE "receptions" ADD COLUMN "motifRefus" TEXT;
ALTER TABLE "receptions" ADD COLUMN "controleParId" INTEGER;
ALTER TABLE "receptions" ADD COLUMN "controleLe" TIMESTAMP(3);
CREATE INDEX "receptions_statutControle_idx" ON "receptions"("statutControle");
ALTER TABLE "receptions" ADD CONSTRAINT "receptions_controleParId_fkey" FOREIGN KEY ("controleParId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "receptions_ecarts" (
    "id" SERIAL NOT NULL,
    "receptionId" INTEGER NOT NULL,
    "type" "EcartType" NOT NULL,
    "ligneCommandeId" INTEGER,
    "libelle" TEXT NOT NULL,
    "quantite" DECIMAL(12,3),
    "commentaire" TEXT,

    CONSTRAINT "receptions_ecarts_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "receptions_ecarts_receptionId_idx" ON "receptions_ecarts"("receptionId");
ALTER TABLE "receptions_ecarts" ADD CONSTRAINT "receptions_ecarts_receptionId_fkey" FOREIGN KEY ("receptionId") REFERENCES "receptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "receptions_ecarts" ADD CONSTRAINT "receptions_ecarts_ligneCommandeId_fkey" FOREIGN KEY ("ligneCommandeId") REFERENCES "lignes_commande_fournisseur"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Dépenses (factures fournisseur photographiées)
CREATE TABLE "depenses" (
    "id" SERIAL NOT NULL,
    "companyId" INTEGER NOT NULL,
    "reference" TEXT NOT NULL,
    "fournisseurId" INTEGER,
    "fournisseurNom" TEXT NOT NULL,
    "fournisseurCle" TEXT NOT NULL,
    "numeroFacture" TEXT NOT NULL,
    "numeroNormalise" TEXT NOT NULL,
    "dateFacture" TIMESTAMP(3) NOT NULL,
    "montantHT" DECIMAL(12,2) NOT NULL,
    "montantTVA" DECIMAL(12,2) NOT NULL,
    "montantTTC" DECIMAL(12,2) NOT NULL,
    "chantierId" INTEGER,
    "commandeFournisseurId" INTEGER,
    "champsDouteux" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "notes" TEXT,
    "statut" "DepenseStatut" NOT NULL DEFAULT 'BROUILLON',
    "motifRefus" TEXT,
    "createurId" INTEGER,
    "valideParId" INTEGER,
    "valideLe" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "depenses_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "depenses_reference_key" ON "depenses"("reference");
CREATE UNIQUE INDEX "depenses_companyId_fournisseurCle_numeroNormalise_key" ON "depenses"("companyId", "fournisseurCle", "numeroNormalise");
CREATE INDEX "depenses_companyId_statut_idx" ON "depenses"("companyId", "statut");
CREATE INDEX "depenses_createurId_idx" ON "depenses"("createurId");
ALTER TABLE "depenses" ADD CONSTRAINT "depenses_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "depenses" ADD CONSTRAINT "depenses_fournisseurId_fkey" FOREIGN KEY ("fournisseurId") REFERENCES "fournisseurs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "depenses" ADD CONSTRAINT "depenses_chantierId_fkey" FOREIGN KEY ("chantierId") REFERENCES "chantiers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "depenses" ADD CONSTRAINT "depenses_commandeFournisseurId_fkey" FOREIGN KEY ("commandeFournisseurId") REFERENCES "commandes_fournisseur"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "depenses" ADD CONSTRAINT "depenses_createurId_fkey" FOREIGN KEY ("createurId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "depenses" ADD CONSTRAINT "depenses_valideParId_fkey" FOREIGN KEY ("valideParId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Fichiers liés à une réception ou à une dépense
ALTER TABLE "fichiers" ADD COLUMN "receptionId" INTEGER;
ALTER TABLE "fichiers" ADD COLUMN "depenseId" INTEGER;
CREATE INDEX "fichiers_receptionId_idx" ON "fichiers"("receptionId");
CREATE INDEX "fichiers_depenseId_idx" ON "fichiers"("depenseId");
ALTER TABLE "fichiers" ADD CONSTRAINT "fichiers_receptionId_fkey" FOREIGN KEY ("receptionId") REFERENCES "receptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "fichiers" ADD CONSTRAINT "fichiers_depenseId_fkey" FOREIGN KEY ("depenseId") REFERENCES "depenses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
