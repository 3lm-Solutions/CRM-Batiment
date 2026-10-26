/*
  Warnings:

  - You are about to drop the column `typesMateriaux` on the `fournisseurs` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[lienPublicToken]` on the table `factures` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "PointageStatut" AS ENUM ('SOUMIS', 'VALIDE', 'REFUSE');

-- AlterTable
ALTER TABLE "companies" ADD COLUMN     "bic" TEXT,
ADD COLUMN     "iban" TEXT;

-- AlterTable
ALTER TABLE "factures" ADD COLUMN     "companyBic" TEXT,
ADD COLUMN     "companyIban" TEXT,
ADD COLUMN     "lienPublicToken" TEXT;

-- AlterTable
ALTER TABLE "fournisseurs" DROP COLUMN "typesMateriaux";

-- CreateTable
CREATE TABLE "taches_checklist" (
    "id" SERIAL NOT NULL,
    "tacheId" INTEGER NOT NULL,
    "libelle" TEXT NOT NULL,
    "fait" BOOLEAN NOT NULL DEFAULT false,
    "ordre" INTEGER NOT NULL DEFAULT 0,
    "faitLe" TIMESTAMP(3),
    "faitParId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "taches_checklist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pointages" (
    "id" SERIAL NOT NULL,
    "companyId" INTEGER NOT NULL,
    "sousTraitantId" INTEGER NOT NULL,
    "chantierId" INTEGER NOT NULL,
    "tacheId" INTEGER,
    "date" DATE NOT NULL,
    "heures" DECIMAL(4,2) NOT NULL,
    "commentaire" TEXT,
    "statut" "PointageStatut" NOT NULL DEFAULT 'SOUMIS',
    "motifRefus" TEXT,
    "saisiParId" INTEGER,
    "valideParId" INTEGER,
    "valideLe" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pointages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "taches_checklist_tacheId_idx" ON "taches_checklist"("tacheId");

-- CreateIndex
CREATE INDEX "pointages_companyId_statut_idx" ON "pointages"("companyId", "statut");

-- CreateIndex
CREATE INDEX "pointages_sousTraitantId_date_idx" ON "pointages"("sousTraitantId", "date");

-- CreateIndex
CREATE INDEX "pointages_chantierId_idx" ON "pointages"("chantierId");

-- CreateIndex
CREATE UNIQUE INDEX "factures_lienPublicToken_key" ON "factures"("lienPublicToken");

-- AddForeignKey
ALTER TABLE "taches_checklist" ADD CONSTRAINT "taches_checklist_tacheId_fkey" FOREIGN KEY ("tacheId") REFERENCES "taches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "taches_checklist" ADD CONSTRAINT "taches_checklist_faitParId_fkey" FOREIGN KEY ("faitParId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pointages" ADD CONSTRAINT "pointages_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pointages" ADD CONSTRAINT "pointages_sousTraitantId_fkey" FOREIGN KEY ("sousTraitantId") REFERENCES "sous_traitants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pointages" ADD CONSTRAINT "pointages_chantierId_fkey" FOREIGN KEY ("chantierId") REFERENCES "chantiers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pointages" ADD CONSTRAINT "pointages_tacheId_fkey" FOREIGN KEY ("tacheId") REFERENCES "taches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pointages" ADD CONSTRAINT "pointages_saisiParId_fkey" FOREIGN KEY ("saisiParId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pointages" ADD CONSTRAINT "pointages_valideParId_fkey" FOREIGN KEY ("valideParId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
