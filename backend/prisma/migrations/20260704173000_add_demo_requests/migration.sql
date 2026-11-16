-- Add Mode Demo / Demo requests
CREATE TYPE "DemoRequestStatut" AS ENUM ('PENDING', 'CONTACTED', 'SCHEDULED', 'DONE', 'CANCELED');

CREATE TABLE "demo_requests" (
    "id" SERIAL NOT NULL,
    "companyId" INTEGER,
    "assignedToId" INTEGER,
    "nom" TEXT NOT NULL,
    "prenom" TEXT,
    "email" TEXT NOT NULL,
    "telephone" TEXT,
    "entreprise" TEXT,
    "message" TEXT,
    "statut" "DemoRequestStatut" NOT NULL DEFAULT 'PENDING',
    "source" TEXT NOT NULL DEFAULT 'PUBLIC_FORM',
    "dateContact" TIMESTAMP(3),
    "dateDemo" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "demo_requests_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "demo_requests_companyId_idx" ON "demo_requests"("companyId");
CREATE INDEX "demo_requests_assignedToId_idx" ON "demo_requests"("assignedToId");
CREATE INDEX "demo_requests_statut_idx" ON "demo_requests"("statut");
CREATE INDEX "demo_requests_email_idx" ON "demo_requests"("email");
CREATE INDEX "demo_requests_createdAt_idx" ON "demo_requests"("createdAt");

ALTER TABLE "demo_requests" ADD CONSTRAINT "demo_requests_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "demo_requests" ADD CONSTRAINT "demo_requests_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
