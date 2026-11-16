CREATE TABLE "clients_types_projet" (
    "clientId" INTEGER NOT NULL,
    "typeProjetId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "clients_types_projet_pkey" PRIMARY KEY ("clientId","typeProjetId")
);

CREATE INDEX "clients_types_projet_typeProjetId_idx" ON "clients_types_projet"("typeProjetId");

ALTER TABLE "clients_types_projet"
ADD CONSTRAINT "clients_types_projet_clientId_fkey"
FOREIGN KEY ("clientId") REFERENCES "clients"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "clients_types_projet"
ADD CONSTRAINT "clients_types_projet_typeProjetId_fkey"
FOREIGN KEY ("typeProjetId") REFERENCES "types_projet"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "clients_types_projet" ("clientId", "typeProjetId")
SELECT "id", "typeProjetId"
FROM "clients"
WHERE "typeProjetId" IS NOT NULL
ON CONFLICT ("clientId", "typeProjetId") DO NOTHING;
