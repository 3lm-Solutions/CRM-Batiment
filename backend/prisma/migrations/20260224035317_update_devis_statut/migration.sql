-- AlterEnum: Remove old values and add new values for DevisStatut
-- Step 1: Create new enum type
CREATE TYPE "DevisStatut_new" AS ENUM ('BROUILLON', 'ENVOYE', 'ACCEPTE', 'SIGNE', 'REFUSE', 'ANNULE', 'REVISE', 'RENVOYE');

-- Step 2: Alter column to use new enum (cast via text)
ALTER TABLE "devis" ALTER COLUMN "statut" DROP DEFAULT;
ALTER TABLE "devis" ALTER COLUMN "statut" TYPE "DevisStatut_new" USING ("statut"::text::"DevisStatut_new");

-- Step 3: Drop old enum and rename new one
DROP TYPE "DevisStatut";
ALTER TYPE "DevisStatut_new" RENAME TO "DevisStatut";

-- Step 4: Restore default
ALTER TABLE "devis" ALTER COLUMN "statut" SET DEFAULT 'BROUILLON';
