/*
  Warnings:

  - You are about to drop the column `typeProjet` on the `clients` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "clients" DROP COLUMN "typeProjet",
ADD COLUMN     "besoin" TEXT,
ADD COLUMN     "typeProjetId" INTEGER;

-- CreateTable
CREATE TABLE "types_projet" (
    "id" SERIAL NOT NULL,
    "companyId" INTEGER NOT NULL,
    "nom" TEXT NOT NULL,
    "description" TEXT,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "types_projet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prestations_compositions" (
    "id" SERIAL NOT NULL,
    "prestationId" INTEGER NOT NULL,
    "materiauId" INTEGER,
    "serviceMainOeuvreId" INTEGER,
    "quantiteParUnite" DOUBLE PRECISION NOT NULL DEFAULT 1,

    CONSTRAINT "prestations_compositions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "types_projet_companyId_idx" ON "types_projet"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "types_projet_companyId_nom_key" ON "types_projet"("companyId", "nom");

-- CreateIndex
CREATE INDEX "prestations_compositions_prestationId_idx" ON "prestations_compositions"("prestationId");

-- CreateIndex
CREATE INDEX "clients_typeProjetId_idx" ON "clients"("typeProjetId");

-- AddForeignKey
ALTER TABLE "types_projet" ADD CONSTRAINT "types_projet_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clients" ADD CONSTRAINT "clients_typeProjetId_fkey" FOREIGN KEY ("typeProjetId") REFERENCES "types_projet"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prestations_compositions" ADD CONSTRAINT "prestations_compositions_prestationId_fkey" FOREIGN KEY ("prestationId") REFERENCES "prestations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prestations_compositions" ADD CONSTRAINT "prestations_compositions_materiauId_fkey" FOREIGN KEY ("materiauId") REFERENCES "materiaux"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prestations_compositions" ADD CONSTRAINT "prestations_compositions_serviceMainOeuvreId_fkey" FOREIGN KEY ("serviceMainOeuvreId") REFERENCES "services_main_oeuvre"("id") ON DELETE SET NULL ON UPDATE CASCADE;
