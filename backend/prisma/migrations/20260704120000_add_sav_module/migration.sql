-- CreateEnum
CREATE TYPE "SavTicketStatut" AS ENUM ('OUVERT', 'EN_COURS', 'EN_ATTENTE_CLIENT', 'RESOLU', 'CLOTURE');

-- CreateEnum
CREATE TYPE "SavTicketPriorite" AS ENUM ('BASSE', 'NORMALE', 'HAUTE', 'URGENTE');

-- CreateEnum
CREATE TYPE "SavTicketCategorie" AS ENUM ('DEFAUT_TRAVAUX', 'RETARD', 'FACTURATION', 'QUALITE', 'SAV_TECHNIQUE', 'AUTRE');

-- CreateTable
CREATE TABLE "sav_tickets" (
    "id" SERIAL NOT NULL,
    "companyId" INTEGER NOT NULL,
    "clientId" INTEGER NOT NULL,
    "devisId" INTEGER,
    "factureId" INTEGER,
    "chantierId" INTEGER,
    "createurId" INTEGER,
    "assignedToId" INTEGER,
    "reference" TEXT NOT NULL,
    "titre" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "statut" "SavTicketStatut" NOT NULL DEFAULT 'OUVERT',
    "priorite" "SavTicketPriorite" NOT NULL DEFAULT 'NORMALE',
    "categorie" "SavTicketCategorie" NOT NULL DEFAULT 'AUTRE',
    "dateEcheance" TIMESTAMP(3),
    "dateResolution" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sav_tickets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sav_ticket_notes" (
    "id" SERIAL NOT NULL,
    "ticketId" INTEGER NOT NULL,
    "userId" INTEGER,
    "contenu" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sav_ticket_notes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "sav_tickets_reference_key" ON "sav_tickets"("reference");

-- CreateIndex
CREATE INDEX "sav_tickets_companyId_idx" ON "sav_tickets"("companyId");

-- CreateIndex
CREATE INDEX "sav_tickets_clientId_idx" ON "sav_tickets"("clientId");

-- CreateIndex
CREATE INDEX "sav_tickets_devisId_idx" ON "sav_tickets"("devisId");

-- CreateIndex
CREATE INDEX "sav_tickets_factureId_idx" ON "sav_tickets"("factureId");

-- CreateIndex
CREATE INDEX "sav_tickets_chantierId_idx" ON "sav_tickets"("chantierId");

-- CreateIndex
CREATE INDEX "sav_tickets_statut_idx" ON "sav_tickets"("statut");

-- CreateIndex
CREATE INDEX "sav_tickets_priorite_idx" ON "sav_tickets"("priorite");

-- CreateIndex
CREATE INDEX "sav_tickets_assignedToId_idx" ON "sav_tickets"("assignedToId");

-- CreateIndex
CREATE INDEX "sav_ticket_notes_ticketId_idx" ON "sav_ticket_notes"("ticketId");

-- CreateIndex
CREATE INDEX "sav_ticket_notes_userId_idx" ON "sav_ticket_notes"("userId");

-- AddForeignKey
ALTER TABLE "sav_tickets" ADD CONSTRAINT "sav_tickets_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sav_tickets" ADD CONSTRAINT "sav_tickets_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sav_tickets" ADD CONSTRAINT "sav_tickets_devisId_fkey" FOREIGN KEY ("devisId") REFERENCES "devis"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sav_tickets" ADD CONSTRAINT "sav_tickets_factureId_fkey" FOREIGN KEY ("factureId") REFERENCES "factures"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sav_tickets" ADD CONSTRAINT "sav_tickets_chantierId_fkey" FOREIGN KEY ("chantierId") REFERENCES "chantiers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sav_tickets" ADD CONSTRAINT "sav_tickets_createurId_fkey" FOREIGN KEY ("createurId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sav_tickets" ADD CONSTRAINT "sav_tickets_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sav_ticket_notes" ADD CONSTRAINT "sav_ticket_notes_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "sav_tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sav_ticket_notes" ADD CONSTRAINT "sav_ticket_notes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
