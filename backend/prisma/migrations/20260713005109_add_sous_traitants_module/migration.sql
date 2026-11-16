-- CreateTable
CREATE TABLE "sous_traitants" (
    "id" SERIAL NOT NULL,
    "companyId" INTEGER NOT NULL,
    "nom" TEXT NOT NULL,
    "siret" TEXT,
    "contact" TEXT,
    "email" TEXT,
    "telephone" TEXT,
    "adresse" TEXT,
    "specialite" TEXT,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sous_traitants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contrats_sous_traitants" (
    "id" SERIAL NOT NULL,
    "sousTraitantId" INTEGER NOT NULL,
    "reference" TEXT,
    "dateDebut" TIMESTAMP(3) NOT NULL,
    "dateFin" TIMESTAMP(3),
    "montant" DOUBLE PRECISION NOT NULL,
    "description" TEXT,
    "statut" TEXT NOT NULL DEFAULT 'ACTIF',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contrats_sous_traitants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assurances_sous_traitants" (
    "id" SERIAL NOT NULL,
    "sousTraitantId" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "compagnie" TEXT,
    "numeroPolice" TEXT,
    "dateDebut" TIMESTAMP(3) NOT NULL,
    "dateExpiration" TIMESTAMP(3) NOT NULL,
    "montantGarantie" DOUBLE PRECISION,
    "alerteEnvoyee" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "assurances_sous_traitants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "paiements_sous_traitants" (
    "id" SERIAL NOT NULL,
    "sousTraitantId" INTEGER NOT NULL,
    "montant" DOUBLE PRECISION NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reference" TEXT,
    "statut" TEXT NOT NULL DEFAULT 'EN_ATTENTE',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "paiements_sous_traitants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "disponibilites_sous_traitants" (
    "id" SERIAL NOT NULL,
    "sousTraitantId" INTEGER NOT NULL,
    "dateDebut" TIMESTAMP(3) NOT NULL,
    "dateFin" TIMESTAMP(3) NOT NULL,
    "disponible" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "disponibilites_sous_traitants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notations_sous_traitants" (
    "id" SERIAL NOT NULL,
    "sousTraitantId" INTEGER NOT NULL,
    "note" INTEGER NOT NULL,
    "commentaire" TEXT,
    "critere" TEXT,
    "evaluateurId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notations_sous_traitants_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "sous_traitants_companyId_idx" ON "sous_traitants"("companyId");

-- CreateIndex
CREATE INDEX "contrats_sous_traitants_sousTraitantId_idx" ON "contrats_sous_traitants"("sousTraitantId");

-- CreateIndex
CREATE INDEX "assurances_sous_traitants_sousTraitantId_idx" ON "assurances_sous_traitants"("sousTraitantId");

-- CreateIndex
CREATE INDEX "assurances_sous_traitants_dateExpiration_idx" ON "assurances_sous_traitants"("dateExpiration");

-- CreateIndex
CREATE INDEX "paiements_sous_traitants_sousTraitantId_idx" ON "paiements_sous_traitants"("sousTraitantId");

-- CreateIndex
CREATE INDEX "disponibilites_sous_traitants_sousTraitantId_idx" ON "disponibilites_sous_traitants"("sousTraitantId");

-- CreateIndex
CREATE INDEX "notations_sous_traitants_sousTraitantId_idx" ON "notations_sous_traitants"("sousTraitantId");

-- AddForeignKey
ALTER TABLE "sous_traitants" ADD CONSTRAINT "sous_traitants_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contrats_sous_traitants" ADD CONSTRAINT "contrats_sous_traitants_sousTraitantId_fkey" FOREIGN KEY ("sousTraitantId") REFERENCES "sous_traitants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assurances_sous_traitants" ADD CONSTRAINT "assurances_sous_traitants_sousTraitantId_fkey" FOREIGN KEY ("sousTraitantId") REFERENCES "sous_traitants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "paiements_sous_traitants" ADD CONSTRAINT "paiements_sous_traitants_sousTraitantId_fkey" FOREIGN KEY ("sousTraitantId") REFERENCES "sous_traitants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "disponibilites_sous_traitants" ADD CONSTRAINT "disponibilites_sous_traitants_sousTraitantId_fkey" FOREIGN KEY ("sousTraitantId") REFERENCES "sous_traitants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notations_sous_traitants" ADD CONSTRAINT "notations_sous_traitants_sousTraitantId_fkey" FOREIGN KEY ("sousTraitantId") REFERENCES "sous_traitants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
