CREATE TABLE "types_projet_categories" (
    "typeProjetId" INTEGER NOT NULL,
    "categorieId" INTEGER NOT NULL,
    "ordre" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "types_projet_categories_pkey" PRIMARY KEY ("typeProjetId","categorieId")
);

CREATE INDEX "types_projet_categories_categorieId_idx" ON "types_projet_categories"("categorieId");

ALTER TABLE "types_projet_categories"
ADD CONSTRAINT "types_projet_categories_typeProjetId_fkey"
FOREIGN KEY ("typeProjetId") REFERENCES "types_projet"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

ALTER TABLE "types_projet_categories"
ADD CONSTRAINT "types_projet_categories_categorieId_fkey"
FOREIGN KEY ("categorieId") REFERENCES "categories_prestations"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;
