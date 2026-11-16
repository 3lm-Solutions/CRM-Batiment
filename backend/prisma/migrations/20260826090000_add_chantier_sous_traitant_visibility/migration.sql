CREATE TABLE "chantiers_sous_traitants" (
    "chantierId" INTEGER NOT NULL,
    "sousTraitantId" INTEGER NOT NULL,

    CONSTRAINT "chantiers_sous_traitants_pkey" PRIMARY KEY ("chantierId", "sousTraitantId")
);

CREATE INDEX "chantiers_sous_traitants_sousTraitantId_idx" ON "chantiers_sous_traitants"("sousTraitantId");

ALTER TABLE "chantiers_sous_traitants" ADD CONSTRAINT "chantiers_sous_traitants_chantierId_fkey" FOREIGN KEY ("chantierId") REFERENCES "chantiers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "chantiers_sous_traitants" ADD CONSTRAINT "chantiers_sous_traitants_sousTraitantId_fkey" FOREIGN KEY ("sousTraitantId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
