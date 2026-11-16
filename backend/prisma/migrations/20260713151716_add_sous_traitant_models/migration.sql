-- CreateTable
CREATE TABLE "sous_traitants" (
    "id" SERIAL NOT NULL,
    "companyId" INTEGER NOT NULL,
    "nom" TEXT NOT NULL,
    "siret" TEXT,
    "email" TEXT,
    "telephone" TEXT,
    "adresse" TEXT,
    "specialite" TEXT,
    "statut" TEXT NOT NULL DEFAULT 'ACTIF',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sous_traitants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contrats_sous_traitant" (
    "id" SERIAL NOT NULL,
    "companyId" INTEGER NOT NULL,
    "sousTraitantId" INTEGER NOT NULL,
    "chantierId" INTEGER NOT NULL,
    "reference" TEXT NOT NULL,
    "montantHT" DOUBLE PRECISION NOT NULL,
    "statut" TEXT NOT NULL DEFAULT 'BROUILLON',
    "dateDebut" TIMESTAMP(3),
    "dateFin" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contrats_sous_traitant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assurances_sous_traitant" (
    "id" SERIAL NOT NULL,
    "companyId" INTEGER NOT NULL,
    "sousTraitantId" INTEGER NOT NULL,
    "typeAssurance" TEXT NOT NULL,
    "numeroAttestation" TEXT NOT NULL,
    "compagnieAssurance" TEXT NOT NULL,
    "dateExpiration" TIMESTAMP(3) NOT NULL,
    "documentUrl" TEXT,
    "statut" TEXT NOT NULL DEFAULT 'VALIDE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "assurances_sous_traitant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "paiements_sous_traitant" (
    "id" SERIAL NOT NULL,
    "companyId" INTEGER NOT NULL,
    "sousTraitantId" INTEGER NOT NULL,
    "contratId" INTEGER,
    "montantHT" DOUBLE PRECISION NOT NULL,
    "montantTTC" DOUBLE PRECISION NOT NULL,
    "datePaiement" TIMESTAMP(3) NOT NULL,
    "modePaiement" TEXT NOT NULL,
    "statut" TEXT NOT NULL DEFAULT 'REGLE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "paiements_sous_traitant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "disponibilites_sous_traitant" (
    "id" SERIAL NOT NULL,
    "companyId" INTEGER NOT NULL,
    "sousTraitantId" INTEGER NOT NULL,
    "dateDebut" TIMESTAMP(3) NOT NULL,
    "dateFin" TIMESTAMP(3) NOT NULL,
    "disponible" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "disponibilites_sous_traitant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notations_sous_traitant" (
    "id" SERIAL NOT NULL,
    "companyId" INTEGER NOT NULL,
    "sousTraitantId" INTEGER NOT NULL,
    "chantierId" INTEGER,
    "noteQualite" INTEGER NOT NULL,
    "noteDelai" INTEGER NOT NULL,
    "noteCommunication" INTEGER NOT NULL,
    "noteGlobale" DOUBLE PRECISION NOT NULL,
    "commentaire" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notations_sous_traitant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "sous_traitants_companyId_idx" ON "sous_traitants"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "contrats_sous_traitant_reference_key" ON "contrats_sous_traitant"("reference");

-- CreateIndex
CREATE INDEX "contrats_sous_traitant_companyId_idx" ON "contrats_sous_traitant"("companyId");

-- CreateIndex
CREATE INDEX "contrats_sous_traitant_sousTraitantId_idx" ON "contrats_sous_traitant"("sousTraitantId");

-- CreateIndex
CREATE INDEX "contrats_sous_traitant_chantierId_idx" ON "contrats_sous_traitant"("chantierId");

-- CreateIndex
CREATE INDEX "assurances_sous_traitant_companyId_idx" ON "assurances_sous_traitant"("companyId");

-- CreateIndex
CREATE INDEX "assurances_sous_traitant_sousTraitantId_idx" ON "assurances_sous_traitant"("sousTraitantId");

-- CreateIndex
CREATE INDEX "paiements_sous_traitant_companyId_idx" ON "paiements_sous_traitant"("companyId");

-- CreateIndex
CREATE INDEX "paiements_sous_traitant_sousTraitantId_idx" ON "paiements_sous_traitant"("sousTraitantId");

-- CreateIndex
CREATE INDEX "paiements_sous_traitant_contratId_idx" ON "paiements_sous_traitant"("contratId");

-- CreateIndex
CREATE INDEX "disponibilites_sous_traitant_companyId_idx" ON "disponibilites_sous_traitant"("companyId");

-- CreateIndex
CREATE INDEX "disponibilites_sous_traitant_sousTraitantId_idx" ON "disponibilites_sous_traitant"("sousTraitantId");

-- CreateIndex
CREATE INDEX "notations_sous_traitant_companyId_idx" ON "notations_sous_traitant"("companyId");

-- CreateIndex
CREATE INDEX "notations_sous_traitant_sousTraitantId_idx" ON "notations_sous_traitant"("sousTraitantId");

-- CreateIndex
CREATE INDEX "notations_sous_traitant_chantierId_idx" ON "notations_sous_traitant"("chantierId");

-- AddForeignKey
ALTER TABLE "sous_traitants" ADD CONSTRAINT "sous_traitants_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contrats_sous_traitant" ADD CONSTRAINT "contrats_sous_traitant_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contrats_sous_traitant" ADD CONSTRAINT "contrats_sous_traitant_sousTraitantId_fkey" FOREIGN KEY ("sousTraitantId") REFERENCES "sous_traitants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contrats_sous_traitant" ADD CONSTRAINT "contrats_sous_traitant_chantierId_fkey" FOREIGN KEY ("chantierId") REFERENCES "chantiers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assurances_sous_traitant" ADD CONSTRAINT "assurances_sous_traitant_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assurances_sous_traitant" ADD CONSTRAINT "assurances_sous_traitant_sousTraitantId_fkey" FOREIGN KEY ("sousTraitantId") REFERENCES "sous_traitants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "paiements_sous_traitant" ADD CONSTRAINT "paiements_sous_traitant_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "paiements_sous_traitant" ADD CONSTRAINT "paiements_sous_traitant_sousTraitantId_fkey" FOREIGN KEY ("sousTraitantId") REFERENCES "sous_traitants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "paiements_sous_traitant" ADD CONSTRAINT "paiements_sous_traitant_contratId_fkey" FOREIGN KEY ("contratId") REFERENCES "contrats_sous_traitant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "disponibilites_sous_traitant" ADD CONSTRAINT "disponibilites_sous_traitant_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "disponibilites_sous_traitant" ADD CONSTRAINT "disponibilites_sous_traitant_sousTraitantId_fkey" FOREIGN KEY ("sousTraitantId") REFERENCES "sous_traitants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notations_sous_traitant" ADD CONSTRAINT "notations_sous_traitant_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notations_sous_traitant" ADD CONSTRAINT "notations_sous_traitant_sousTraitantId_fkey" FOREIGN KEY ("sousTraitantId") REFERENCES "sous_traitants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notations_sous_traitant" ADD CONSTRAINT "notations_sous_traitant_chantierId_fkey" FOREIGN KEY ("chantierId") REFERENCES "chantiers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
