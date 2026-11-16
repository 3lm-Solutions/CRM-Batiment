ALTER TABLE "users"
ADD COLUMN "signatureBase64" TEXT,
ADD COLUMN "signatureUpdatedAt" TIMESTAMP(3);

ALTER TABLE "devis"
ADD COLUMN "signatureClientBase64" TEXT,
ADD COLUMN "signatureClientDate" TIMESTAMP(3),
ADD COLUMN "signatureConseillerBase64" TEXT,
ADD COLUMN "signatureConseillerDate" TIMESTAMP(3);

CREATE TYPE "DevisClientSignatureStatut" AS ENUM (
  'EN_ATTENTE',
  'OTP_ENVOYE',
  'OTP_VERIFIE',
  'SIGNE_CLIENT',
  'BLOQUE',
  'EXPIRE',
  'ANNULE'
);

CREATE TABLE "devis_client_signature_requests" (
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

CREATE UNIQUE INDEX "devis_client_signature_requests_token_key" ON "devis_client_signature_requests"("token");
CREATE INDEX "devis_client_signature_requests_devisId_idx" ON "devis_client_signature_requests"("devisId");
CREATE INDEX "devis_client_signature_requests_statut_idx" ON "devis_client_signature_requests"("statut");
CREATE INDEX "devis_client_signature_requests_expiresAt_idx" ON "devis_client_signature_requests"("expiresAt");

ALTER TABLE "devis_client_signature_requests"
ADD CONSTRAINT "devis_client_signature_requests_devisId_fkey"
FOREIGN KEY ("devisId") REFERENCES "devis"("id")
ON DELETE CASCADE ON UPDATE CASCADE;