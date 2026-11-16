-- Devis « terrain » du 05/11/2026 : remis en main propre, lien WhatsApp, signature papier
-- vérifiée par l'ADMIN. Ajouts uniquement. Écrit pour être rejoué sans erreur sur une base
-- déjà créée avec l'ancienne migration unique du 05/11 (IF NOT EXISTS partout).

-- AlterEnum
ALTER TYPE "DevisStatut" ADD VALUE IF NOT EXISTS 'SIGNE_PAPIER';

-- AlterEnum
ALTER TYPE "CanalEnvoi" ADD VALUE IF NOT EXISTS 'WHATSAPP';

-- AlterEnum
ALTER TYPE "ModeValidation" ADD VALUE IF NOT EXISTS 'PAPIER';

-- AlterTable
ALTER TABLE "devis" ADD COLUMN IF NOT EXISTS "remisLe" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "signaturePapierFichierId" INTEGER,
ADD COLUMN IF NOT EXISTS "signaturePapierLe" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "signaturePapierParId" INTEGER,
ADD COLUMN IF NOT EXISTS "signaturePapierRejet" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "devis_signaturePapierFichierId_key" ON "devis"("signaturePapierFichierId");

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'devis_signaturePapierFichierId_fkey') THEN
    ALTER TABLE "devis" ADD CONSTRAINT "devis_signaturePapierFichierId_fkey" FOREIGN KEY ("signaturePapierFichierId") REFERENCES "fichiers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'devis_signaturePapierParId_fkey') THEN
    ALTER TABLE "devis" ADD CONSTRAINT "devis_signaturePapierParId_fkey" FOREIGN KEY ("signaturePapierParId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
