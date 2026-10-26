-- DropForeignKey
ALTER TABLE "commandes_fournisseur" DROP CONSTRAINT "commandes_fournisseur_devisId_fkey";

-- AlterTable
ALTER TABLE "commandes_fournisseur" ADD COLUMN     "chantierId" INTEGER,
ALTER COLUMN "devisId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "sav_ticket_notes" ADD COLUMN     "visibleClient" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "sav_ticket_historique" (
    "id" SERIAL NOT NULL,
    "ticketId" INTEGER NOT NULL,
    "statut" "SavTicketStatut" NOT NULL,
    "userId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sav_ticket_historique_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "sav_ticket_historique_ticketId_idx" ON "sav_ticket_historique"("ticketId");

-- CreateIndex
CREATE INDEX "commandes_fournisseur_chantierId_idx" ON "commandes_fournisseur"("chantierId");

-- AddForeignKey
ALTER TABLE "commandes_fournisseur" ADD CONSTRAINT "commandes_fournisseur_devisId_fkey" FOREIGN KEY ("devisId") REFERENCES "devis"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commandes_fournisseur" ADD CONSTRAINT "commandes_fournisseur_chantierId_fkey" FOREIGN KEY ("chantierId") REFERENCES "chantiers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sav_ticket_historique" ADD CONSTRAINT "sav_ticket_historique_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "sav_tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sav_ticket_historique" ADD CONSTRAINT "sav_ticket_historique_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
