ALTER TABLE "demandes_devis"
ADD COLUMN "reference" TEXT;

CREATE UNIQUE INDEX "demandes_devis_reference_key"
ON "demandes_devis"("reference");

CREATE INDEX "demandes_devis_reference_idx"
ON "demandes_devis"("reference");