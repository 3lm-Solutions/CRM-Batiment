-- CreateEnum
CREATE TYPE "TypeReponse" AS ENUM ('TEXTE', 'CHOIX_UNIQUE', 'CHOIX_MULTIPLE', 'NOMBRE', 'BOOLEEN', 'PHOTO');

-- CreateEnum
CREATE TYPE "TypeInfo" AS ENUM ('MESURE', 'PHOTO', 'OBSERVATION', 'CHOIX');

-- CreateTable
CREATE TABLE "questions_diagnostiques" (
    "id" SERIAL NOT NULL,
    "companyId" INTEGER NOT NULL,
    "categorieId" INTEGER,
    "sousCategorieId" INTEGER,
    "question" TEXT NOT NULL,
    "typeReponse" "TypeReponse" NOT NULL DEFAULT 'CHOIX_UNIQUE',
    "choixPossibles" JSONB,
    "obligatoire" BOOLEAN NOT NULL DEFAULT false,
    "ordre" INTEGER NOT NULL DEFAULT 0,
    "aide" TEXT,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "questions_diagnostiques_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "infos_requises" (
    "id" SERIAL NOT NULL,
    "prestationId" INTEGER NOT NULL,
    "nom" TEXT NOT NULL,
    "typeInfo" "TypeInfo" NOT NULL DEFAULT 'MESURE',
    "unite" TEXT,
    "obligatoire" BOOLEAN NOT NULL DEFAULT false,
    "aide" TEXT,
    "ordre" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "infos_requises_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "questions_diagnostiques_companyId_idx" ON "questions_diagnostiques"("companyId");

-- CreateIndex
CREATE INDEX "questions_diagnostiques_categorieId_idx" ON "questions_diagnostiques"("categorieId");

-- CreateIndex
CREATE INDEX "questions_diagnostiques_sousCategorieId_idx" ON "questions_diagnostiques"("sousCategorieId");

-- CreateIndex
CREATE INDEX "infos_requises_prestationId_idx" ON "infos_requises"("prestationId");

-- CreateIndex
CREATE UNIQUE INDEX "infos_requises_prestationId_nom_key" ON "infos_requises"("prestationId", "nom");

-- AddForeignKey
ALTER TABLE "questions_diagnostiques" ADD CONSTRAINT "questions_diagnostiques_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "questions_diagnostiques" ADD CONSTRAINT "questions_diagnostiques_categorieId_fkey" FOREIGN KEY ("categorieId") REFERENCES "categories_prestations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "questions_diagnostiques" ADD CONSTRAINT "questions_diagnostiques_sousCategorieId_fkey" FOREIGN KEY ("sousCategorieId") REFERENCES "sous_categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "infos_requises" ADD CONSTRAINT "infos_requises_prestationId_fkey" FOREIGN KEY ("prestationId") REFERENCES "prestations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
