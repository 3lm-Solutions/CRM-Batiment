-- Drop Devis relation to diagnostic sessions
ALTER TABLE "devis" DROP CONSTRAINT IF EXISTS "devis_sessionDiagId_fkey";
DROP INDEX IF EXISTS "devis_sessionDiagId_idx";
DROP INDEX IF EXISTS "devis_sessionDiagId_key";
ALTER TABLE "devis" DROP COLUMN IF EXISTS "sessionDiagId";

-- Drop diagnostic-related tables
DROP TABLE IF EXISTS "selections_options_devis";
DROP TABLE IF EXISTS "valeurs_infos_requises";
DROP TABLE IF EXISTS "reponses_diagnostiques";
DROP TABLE IF EXISTS "sessions_diagnostiques";
DROP TABLE IF EXISTS "questions_diagnostiques";
DROP TABLE IF EXISTS "infos_requises";

-- Drop obsolete enums
DROP TYPE IF EXISTS "TypeReponse";
DROP TYPE IF EXISTS "TypeInfo";
