CREATE TYPE "FactureType" AS ENUM ('ACOMPTE', 'FINALE');

ALTER TABLE "factures"
ADD COLUMN "dateEcheance" TIMESTAMP(3),
ADD COLUMN "referenceDevis" TEXT,
ADD COLUMN "tauxTVA" DOUBLE PRECISION NOT NULL DEFAULT 20,
ADD COLUMN "typeFacture" "FactureType" NOT NULL DEFAULT 'FINALE',
ADD COLUMN "acomptePercent" DOUBLE PRECISION,
ADD COLUMN "acompteMontant" DOUBLE PRECISION,
ADD COLUMN "nomClient" TEXT,
ADD COLUMN "prenomClient" TEXT,
ADD COLUMN "emailClient" TEXT,
ADD COLUMN "telephoneClient" TEXT,
ADD COLUMN "adresseClient" TEXT,
ADD COLUMN "companyNom" TEXT,
ADD COLUMN "companyEmail" TEXT,
ADD COLUMN "companyTelephone" TEXT,
ADD COLUMN "companyAdresse" TEXT,
ADD COLUMN "companySiret" TEXT,
ADD COLUMN "conditionsPaiement" TEXT,
ADD COLUMN "communicationPaiement" TEXT,
ADD COLUMN "notesLegales" TEXT,
ADD COLUMN "referencePaiement" TEXT,
ADD COLUMN "emailEnvoiClient" TEXT,
ADD COLUMN "dateEnvoiClient" TIMESTAMP(3),
ADD COLUMN "datePaiement" TIMESTAMP(3);

CREATE TABLE "lignes_facture" (
  "id" SERIAL NOT NULL,
  "factureId" INTEGER NOT NULL,
  "description" TEXT NOT NULL,
  "datePrestation" TIMESTAMP(3),
  "quantite" DOUBLE PRECISION NOT NULL DEFAULT 1,
  "unite" TEXT NOT NULL DEFAULT 'UNITE',
  "prixUnitaireHT" DOUBLE PRECISION NOT NULL,
  "tauxTVA" DOUBLE PRECISION NOT NULL DEFAULT 20,
  "montantHT" DOUBLE PRECISION NOT NULL,
  "montantTVA" DOUBLE PRECISION NOT NULL,
  "montantTTC" DOUBLE PRECISION NOT NULL,
  "ordre" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "lignes_facture_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "lignes_facture_factureId_idx" ON "lignes_facture"("factureId");

ALTER TABLE "lignes_facture"
ADD CONSTRAINT "lignes_facture_factureId_fkey"
FOREIGN KEY ("factureId") REFERENCES "factures"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
