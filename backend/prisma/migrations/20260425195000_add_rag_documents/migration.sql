CREATE TABLE "rag_documents" (
  "id" SERIAL NOT NULL,
  "companyId" INTEGER NOT NULL,
  "titre" TEXT NOT NULL,
  "categorie" TEXT NOT NULL,
  "contenu" TEXT NOT NULL,
  "actif" BOOLEAN NOT NULL DEFAULT true,
  "priorite" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "rag_documents_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "rag_documents_companyId_idx" ON "rag_documents"("companyId");
CREATE INDEX "rag_documents_categorie_idx" ON "rag_documents"("categorie");
CREATE INDEX "rag_documents_actif_idx" ON "rag_documents"("actif");

ALTER TABLE "rag_documents"
ADD CONSTRAINT "rag_documents_companyId_fkey"
FOREIGN KEY ("companyId") REFERENCES "companies"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
