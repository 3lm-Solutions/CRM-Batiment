/*
  Warnings:

  - You are about to drop the column `equipeId` on the `affectations_taches` table. All the data in the column will be lost.
  - You are about to drop the column `terminee` on the `chat_sessions` table. All the data in the column will be lost.
  - You are about to drop the column `pdfUrl` on the `commandes_fournisseur` table. All the data in the column will be lost.
  - You are about to drop the column `pdfUrl` on the `factures` table. All the data in the column will be lost.
  - You are about to drop the column `datePrestation` on the `lignes_facture` table. All the data in the column will be lost.
  - You are about to drop the `bons_commande` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `equipes` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "RelanceType" AS ENUM ('DEVIS', 'FACTURE');

-- DropForeignKey
ALTER TABLE "affectations_taches" DROP CONSTRAINT "affectations_taches_equipeId_fkey";

-- DropForeignKey
ALTER TABLE "bons_commande" DROP CONSTRAINT "bons_commande_devisId_fkey";

-- DropForeignKey
ALTER TABLE "equipes" DROP CONSTRAINT "equipes_companyId_fkey";

-- AlterTable
ALTER TABLE "affectations_taches" DROP COLUMN "equipeId";

-- AlterTable
ALTER TABLE "chat_sessions" DROP COLUMN "terminee";

-- AlterTable
ALTER TABLE "commandes_fournisseur" DROP COLUMN "pdfUrl";

-- AlterTable
ALTER TABLE "companies" ADD COLUMN     "relanceDevisJours" INTEGER[] DEFAULT ARRAY[7, 14]::INTEGER[],
ADD COLUMN     "relanceFactureJours" INTEGER[] DEFAULT ARRAY[1, 15, 30]::INTEGER[],
ADD COLUMN     "relancesActives" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "factures" DROP COLUMN "pdfUrl";

-- AlterTable
ALTER TABLE "fichiers" ADD COLUMN     "savTicketId" INTEGER;

-- AlterTable
ALTER TABLE "lignes_facture" DROP COLUMN "datePrestation";

-- DropTable
DROP TABLE "bons_commande";

-- DropTable
DROP TABLE "equipes";

-- DropEnum
DROP TYPE "BonCommandeStatut";

-- DropEnum
DROP TYPE "EquipeType";

-- CreateTable
CREATE TABLE "relances" (
    "id" SERIAL NOT NULL,
    "companyId" INTEGER NOT NULL,
    "type" "RelanceType" NOT NULL,
    "devisId" INTEGER,
    "factureId" INTEGER,
    "niveau" INTEGER NOT NULL,
    "automatique" BOOLEAN NOT NULL DEFAULT true,
    "destinataire" TEXT NOT NULL,
    "emailEnvoye" BOOLEAN NOT NULL,
    "userId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "relances_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "relances_devisId_idx" ON "relances"("devisId");

-- CreateIndex
CREATE INDEX "relances_factureId_idx" ON "relances"("factureId");

-- CreateIndex
CREATE INDEX "relances_companyId_createdAt_idx" ON "relances"("companyId", "createdAt");

-- CreateIndex
CREATE INDEX "fichiers_savTicketId_idx" ON "fichiers"("savTicketId");

-- AddForeignKey
ALTER TABLE "relances" ADD CONSTRAINT "relances_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "relances" ADD CONSTRAINT "relances_devisId_fkey" FOREIGN KEY ("devisId") REFERENCES "devis"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "relances" ADD CONSTRAINT "relances_factureId_fkey" FOREIGN KEY ("factureId") REFERENCES "factures"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "relances" ADD CONSTRAINT "relances_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fichiers" ADD CONSTRAINT "fichiers_savTicketId_fkey" FOREIGN KEY ("savTicketId") REFERENCES "sav_tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
