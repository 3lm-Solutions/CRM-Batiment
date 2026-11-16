-- Application mobile — lot B1 (16/11/2026) : notifications push, session mobile (refresh token),
-- commentaires de tâches, pièces jointes des prospects terrain, signature sur place, QR du devis.
-- Ajouts uniquement : aucune table ni colonne existante n'est modifiée ou supprimée.

-- AlterEnum
ALTER TYPE "ModeValidation" ADD VALUE IF NOT EXISTS 'SUR_PLACE';

-- CreateEnum
CREATE TYPE "PieceJointeType" AS ENUM ('PHOTO', 'AUDIO');

-- AlterTable
ALTER TABLE "devis" ADD COLUMN "codeVerification" TEXT,
ADD COLUMN "signataireNom" TEXT,
ADD COLUMN "signatureLatitude" DECIMAL(9,6),
ADD COLUMN "signatureLongitude" DECIMAL(9,6);

-- CreateTable
CREATE TABLE "appareils_push" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "jeton" TEXT NOT NULL,
    "plateforme" TEXT,
    "nom" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "derniereActivite" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "appareils_push_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions_mobile" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "tokenVersion" INTEGER NOT NULL,
    "appareil" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessions_mobile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "taches_commentaires" (
    "id" SERIAL NOT NULL,
    "tacheId" INTEGER NOT NULL,
    "auteurId" INTEGER,
    "texte" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "taches_commentaires_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "demandes_devis_fichiers" (
    "id" SERIAL NOT NULL,
    "demandeDevisId" INTEGER NOT NULL,
    "fichierId" INTEGER NOT NULL,
    "type" "PieceJointeType" NOT NULL,
    "dureeSecondes" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "demandes_devis_fichiers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "appareils_push_jeton_key" ON "appareils_push"("jeton");

-- CreateIndex
CREATE INDEX "appareils_push_userId_idx" ON "appareils_push"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_mobile_tokenHash_key" ON "sessions_mobile"("tokenHash");

-- CreateIndex
CREATE INDEX "sessions_mobile_userId_idx" ON "sessions_mobile"("userId");

-- CreateIndex
CREATE INDEX "taches_commentaires_tacheId_createdAt_idx" ON "taches_commentaires"("tacheId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "demandes_devis_fichiers_fichierId_key" ON "demandes_devis_fichiers"("fichierId");

-- CreateIndex
CREATE INDEX "demandes_devis_fichiers_demandeDevisId_idx" ON "demandes_devis_fichiers"("demandeDevisId");

-- AddForeignKey
ALTER TABLE "appareils_push" ADD CONSTRAINT "appareils_push_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions_mobile" ADD CONSTRAINT "sessions_mobile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "taches_commentaires" ADD CONSTRAINT "taches_commentaires_tacheId_fkey" FOREIGN KEY ("tacheId") REFERENCES "taches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "taches_commentaires" ADD CONSTRAINT "taches_commentaires_auteurId_fkey" FOREIGN KEY ("auteurId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "demandes_devis_fichiers" ADD CONSTRAINT "demandes_devis_fichiers_demandeDevisId_fkey" FOREIGN KEY ("demandeDevisId") REFERENCES "demandes_devis"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "demandes_devis_fichiers" ADD CONSTRAINT "demandes_devis_fichiers_fichierId_fkey" FOREIGN KEY ("fichierId") REFERENCES "fichiers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
