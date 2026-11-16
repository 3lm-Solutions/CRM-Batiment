-- AlterTable
ALTER TABLE "prestations" ADD COLUMN     "sousCategorieId" INTEGER;

-- CreateTable
CREATE TABLE "sous_categories" (
    "id" SERIAL NOT NULL,
    "companyId" INTEGER NOT NULL,
    "categorieId" INTEGER NOT NULL,
    "nom" TEXT NOT NULL,
    "description" TEXT,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sous_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "options_prestations" (
    "id" SERIAL NOT NULL,
    "prestationId" INTEGER NOT NULL,
    "nom" TEXT NOT NULL,
    "description" TEXT,
    "obligatoire" BOOLEAN NOT NULL DEFAULT false,
    "ordre" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "options_prestations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "choix_options" (
    "id" SERIAL NOT NULL,
    "optionId" INTEGER NOT NULL,
    "nom" TEXT NOT NULL,
    "description" TEXT,
    "impactPrix" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "ordre" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "choix_options_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "sous_categories_companyId_idx" ON "sous_categories"("companyId");

-- CreateIndex
CREATE INDEX "sous_categories_categorieId_idx" ON "sous_categories"("categorieId");

-- CreateIndex
CREATE UNIQUE INDEX "sous_categories_categorieId_nom_key" ON "sous_categories"("categorieId", "nom");

-- CreateIndex
CREATE INDEX "options_prestations_prestationId_idx" ON "options_prestations"("prestationId");

-- CreateIndex
CREATE UNIQUE INDEX "options_prestations_prestationId_nom_key" ON "options_prestations"("prestationId", "nom");

-- CreateIndex
CREATE INDEX "choix_options_optionId_idx" ON "choix_options"("optionId");

-- CreateIndex
CREATE UNIQUE INDEX "choix_options_optionId_nom_key" ON "choix_options"("optionId", "nom");

-- CreateIndex
CREATE INDEX "prestations_sousCategorieId_idx" ON "prestations"("sousCategorieId");

-- AddForeignKey
ALTER TABLE "sous_categories" ADD CONSTRAINT "sous_categories_categorieId_fkey" FOREIGN KEY ("categorieId") REFERENCES "categories_prestations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prestations" ADD CONSTRAINT "prestations_sousCategorieId_fkey" FOREIGN KEY ("sousCategorieId") REFERENCES "sous_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "options_prestations" ADD CONSTRAINT "options_prestations_prestationId_fkey" FOREIGN KEY ("prestationId") REFERENCES "prestations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "choix_options" ADD CONSTRAINT "choix_options_optionId_fkey" FOREIGN KEY ("optionId") REFERENCES "options_prestations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
