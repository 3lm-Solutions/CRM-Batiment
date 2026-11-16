-- Application mobile — lot 1 (16/11/2026)
-- Ajouts seulement (colonnes facultatives, nouvelles tables) : aucune donnée existante n'est modifiée.

-- Prospect terrain
ALTER TYPE "LeadSource" ADD VALUE IF NOT EXISTS 'TERRAIN';

-- Mode d'installation : réglage de l'entreprise, modifiable sur chaque chantier
CREATE TYPE "ModeInstallation" AS ENUM ('POSE', 'REGIE', 'LES_DEUX');
ALTER TABLE "companies" ADD COLUMN "modeInstallation" "ModeInstallation" NOT NULL DEFAULT 'POSE';
ALTER TABLE "chantiers" ADD COLUMN "modeInstallation" "ModeInstallation";

-- Preuve des fichiers : empreinte SHA-256 et position à la prise
ALTER TABLE "fichiers" ADD COLUMN "sha256" TEXT;
ALTER TABLE "fichiers" ADD COLUMN "latitude" DECIMAL(9,6);
ALTER TABLE "fichiers" ADD COLUMN "longitude" DECIMAL(9,6);

-- Visites programmées
CREATE TYPE "VisiteStatut" AS ENUM ('PREVUE', 'FAITE', 'ANNULEE');

CREATE TABLE "visites" (
    "id" SERIAL NOT NULL,
    "companyId" INTEGER NOT NULL,
    "commercialId" INTEGER NOT NULL,
    "clientId" INTEGER NOT NULL,
    "demandeDevisId" INTEGER,
    "dateHeure" TIMESTAMP(3) NOT NULL,
    "dureeMinutes" INTEGER NOT NULL DEFAULT 60,
    "adresse" TEXT,
    "objet" TEXT,
    "statut" "VisiteStatut" NOT NULL DEFAULT 'PREVUE',
    "compteRendu" TEXT,
    "motifAnnulation" TEXT,
    "rappelEnvoyeLe" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "visites_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "visites_companyId_dateHeure_idx" ON "visites"("companyId", "dateHeure");
CREATE INDEX "visites_commercialId_dateHeure_idx" ON "visites"("commercialId", "dateHeure");
CREATE INDEX "visites_clientId_idx" ON "visites"("clientId");
CREATE INDEX "visites_statut_dateHeure_idx" ON "visites"("statut", "dateHeure");

ALTER TABLE "visites" ADD CONSTRAINT "visites_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "visites" ADD CONSTRAINT "visites_commercialId_fkey" FOREIGN KEY ("commercialId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "visites" ADD CONSTRAINT "visites_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "visites" ADD CONSTRAINT "visites_demandeDevisId_fkey" FOREIGN KEY ("demandeDevisId") REFERENCES "demandes_devis"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Hors ligne : clés Idempotency-Key (renvoi sans doublon, gardées 24 h)
CREATE TABLE "cles_idempotence" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "cle" TEXT NOT NULL,
    "methode" TEXT NOT NULL,
    "chemin" TEXT NOT NULL,
    "statut" TEXT NOT NULL DEFAULT 'EN_COURS',
    "codeHttp" INTEGER,
    "reponse" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cles_idempotence_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "cles_idempotence_userId_cle_key" ON "cles_idempotence"("userId", "cle");
CREATE INDEX "cles_idempotence_createdAt_idx" ON "cles_idempotence"("createdAt");

ALTER TABLE "cles_idempotence" ADD CONSTRAINT "cles_idempotence_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
