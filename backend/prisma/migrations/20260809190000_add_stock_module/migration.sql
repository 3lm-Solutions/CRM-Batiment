ALTER TABLE "materiaux"
ADD COLUMN "stockActuel" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN "stockMinimum" DOUBLE PRECISION NOT NULL DEFAULT 0;

CREATE TYPE "TypeMouvementStock" AS ENUM ('ENTREE', 'SORTIE', 'AJUSTEMENT');

CREATE TABLE "mouvements_stock" (
  "id" SERIAL NOT NULL,
  "companyId" INTEGER NOT NULL,
  "materiauId" INTEGER NOT NULL,
  "userId" INTEGER,
  "type" "TypeMouvementStock" NOT NULL,
  "quantite" DOUBLE PRECISION NOT NULL,
  "stockAvant" DOUBLE PRECISION NOT NULL,
  "stockApres" DOUBLE PRECISION NOT NULL,
  "motif" TEXT,
  "reference" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "mouvements_stock_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "mouvements_stock_companyId_idx" ON "mouvements_stock"("companyId");
CREATE INDEX "mouvements_stock_materiauId_idx" ON "mouvements_stock"("materiauId");
CREATE INDEX "mouvements_stock_createdAt_idx" ON "mouvements_stock"("createdAt");

ALTER TABLE "mouvements_stock"
ADD CONSTRAINT "mouvements_stock_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "mouvements_stock"
ADD CONSTRAINT "mouvements_stock_materiauId_fkey" FOREIGN KEY ("materiauId") REFERENCES "materiaux"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "mouvements_stock"
ADD CONSTRAINT "mouvements_stock_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
