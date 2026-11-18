-- Application mobile — lot B (18/11/2026) : installateur délégué
-- Ajouts seulement (types, colonnes facultatives ou avec valeur par défaut, nouvelles tables).

CREATE TYPE "InstallationEtape" AS ENUM ('DEVIS_SIGNE', 'INSTALLATEUR_PROPOSE', 'MISSION_ACCEPTEE', 'LIVRAISON', 'POSE', 'FINITIONS', 'TERMINEE', 'CLOTUREE');
CREATE TYPE "SignalementType" AS ENUM ('RESERVE', 'RETARD', 'INCIDENT');
CREATE TYPE "SignalementStatut" AS ENUM ('OUVERT', 'TRAITE');

-- Un sous-traitant peut recevoir des installations déléguées
ALTER TABLE "sous_traitants" ADD COLUMN "installateur" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "installations" (
    "id" SERIAL NOT NULL,
    "companyId" INTEGER NOT NULL,
    "reference" TEXT NOT NULL,
    "chantierId" INTEGER NOT NULL,
    "devisId" INTEGER,
    "etape" "InstallationEtape" NOT NULL DEFAULT 'DEVIS_SIGNE',
    "sousTraitantId" INTEGER,
    "noteAttribution" TEXT,
    "dateSouhaitee" TIMESTAMP(3),
    "dateProposee" TIMESTAMP(3),
    "dateConfirmee" TIMESTAMP(3),
    "codePv" TEXT NOT NULL,
    "pvFichierId" INTEGER,
    "pvSigneLe" TIMESTAMP(3),
    "pvAVerifier" BOOLEAN NOT NULL DEFAULT false,
    "relanceLe" TIMESTAMP(3),
    "clotureLe" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "installations_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "installations_reference_key" ON "installations"("reference");
CREATE UNIQUE INDEX "installations_chantierId_key" ON "installations"("chantierId");
CREATE UNIQUE INDEX "installations_pvFichierId_key" ON "installations"("pvFichierId");
CREATE INDEX "installations_companyId_etape_idx" ON "installations"("companyId", "etape");
CREATE INDEX "installations_sousTraitantId_idx" ON "installations"("sousTraitantId");
ALTER TABLE "installations" ADD CONSTRAINT "installations_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "installations" ADD CONSTRAINT "installations_chantierId_fkey" FOREIGN KEY ("chantierId") REFERENCES "chantiers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "installations" ADD CONSTRAINT "installations_devisId_fkey" FOREIGN KEY ("devisId") REFERENCES "devis"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "installations" ADD CONSTRAINT "installations_sousTraitantId_fkey" FOREIGN KEY ("sousTraitantId") REFERENCES "sous_traitants"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "installations" ADD CONSTRAINT "installations_pvFichierId_fkey" FOREIGN KEY ("pvFichierId") REFERENCES "fichiers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "installations_evenements" (
    "id" SERIAL NOT NULL,
    "installationId" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "userId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "installations_evenements_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "installations_evenements_installationId_createdAt_idx" ON "installations_evenements"("installationId", "createdAt");
ALTER TABLE "installations_evenements" ADD CONSTRAINT "installations_evenements_installationId_fkey" FOREIGN KEY ("installationId") REFERENCES "installations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "installations_evenements" ADD CONSTRAINT "installations_evenements_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "signalements" (
    "id" SERIAL NOT NULL,
    "installationId" INTEGER NOT NULL,
    "type" "SignalementType" NOT NULL,
    "description" TEXT NOT NULL,
    "statut" "SignalementStatut" NOT NULL DEFAULT 'OUVERT',
    "savDemande" BOOLEAN NOT NULL DEFAULT false,
    "savTicketId" INTEGER,
    "auteurId" INTEGER,
    "traiteLe" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "signalements_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "signalements_savTicketId_key" ON "signalements"("savTicketId");
CREATE INDEX "signalements_installationId_idx" ON "signalements"("installationId");
ALTER TABLE "signalements" ADD CONSTRAINT "signalements_installationId_fkey" FOREIGN KEY ("installationId") REFERENCES "installations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "signalements" ADD CONSTRAINT "signalements_savTicketId_fkey" FOREIGN KEY ("savTicketId") REFERENCES "sav_tickets"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "signalements" ADD CONSTRAINT "signalements_auteurId_fkey" FOREIGN KEY ("auteurId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Photos d'étape et photos de signalement
ALTER TABLE "fichiers" ADD COLUMN "installationId" INTEGER;
ALTER TABLE "fichiers" ADD COLUMN "installationEtape" "InstallationEtape";
ALTER TABLE "fichiers" ADD COLUMN "signalementId" INTEGER;
CREATE INDEX "fichiers_installationId_idx" ON "fichiers"("installationId");
CREATE INDEX "fichiers_signalementId_idx" ON "fichiers"("signalementId");
ALTER TABLE "fichiers" ADD CONSTRAINT "fichiers_installationId_fkey" FOREIGN KEY ("installationId") REFERENCES "installations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "fichiers" ADD CONSTRAINT "fichiers_signalementId_fkey" FOREIGN KEY ("signalementId") REFERENCES "signalements"("id") ON DELETE CASCADE ON UPDATE CASCADE;
