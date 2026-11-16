ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "signatureBase64" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "signatureUpdatedAt" TIMESTAMP(3);

ALTER TABLE "devis" ADD COLUMN IF NOT EXISTS "signatureClientBase64" TEXT;
ALTER TABLE "devis" ADD COLUMN IF NOT EXISTS "signatureClientDate" TIMESTAMP(3);
ALTER TABLE "devis" ADD COLUMN IF NOT EXISTS "signatureConseillerBase64" TEXT;
ALTER TABLE "devis" ADD COLUMN IF NOT EXISTS "signatureConseillerDate" TIMESTAMP(3);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'DevisClientSignatureStatut') THEN
    CREATE TYPE "DevisClientSignatureStatut" AS ENUM (
      'EN_ATTENTE',
      'OTP_ENVOYE',
      'OTP_VERIFIE',
      'SIGNE_CLIENT',
      'BLOQUE',
      'EXPIRE',
      'ANNULE'
    );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "devis_client_signature_requests" (
  "id" SERIAL NOT NULL,
  "devisId" INTEGER NOT NULL,
  "token" TEXT NOT NULL,
  "telephoneClient" TEXT NOT NULL,
  "statut" "DevisClientSignatureStatut" NOT NULL DEFAULT 'EN_ATTENTE',
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "otpCodeHash" TEXT,
  "otpExpiresAt" TIMESTAMP(3),
  "otpAttempts" INTEGER NOT NULL DEFAULT 0,
  "otpSentAt" TIMESTAMP(3),
  "otpVerifiedAt" TIMESTAMP(3),
  "blockedAt" TIMESTAMP(3),
  "clientSignedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "devis_client_signature_requests_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "devis_client_signature_requests_token_key" ON "devis_client_signature_requests"("token");
CREATE INDEX IF NOT EXISTS "devis_client_signature_requests_devisId_idx" ON "devis_client_signature_requests"("devisId");
CREATE INDEX IF NOT EXISTS "devis_client_signature_requests_statut_idx" ON "devis_client_signature_requests"("statut");
CREATE INDEX IF NOT EXISTS "devis_client_signature_requests_expiresAt_idx" ON "devis_client_signature_requests"("expiresAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'devis_client_signature_requests_devisId_fkey'
      AND table_name = 'devis_client_signature_requests'
  ) THEN
    ALTER TABLE "devis_client_signature_requests"
    ADD CONSTRAINT "devis_client_signature_requests_devisId_fkey"
    FOREIGN KEY ("devisId") REFERENCES "devis"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

