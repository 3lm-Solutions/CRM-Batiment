-- CreateTable
CREATE TABLE "choix_options_compositions" (
    "id" SERIAL NOT NULL,
    "choixOptionId" INTEGER NOT NULL,
    "materiauId" INTEGER,
    "serviceMainOeuvreId" INTEGER,
    "quantiteParUnite" DOUBLE PRECISION NOT NULL DEFAULT 1,

    CONSTRAINT "choix_options_compositions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "choix_options_compositions_choixOptionId_idx" ON "choix_options_compositions"("choixOptionId");

-- AddForeignKey
ALTER TABLE "choix_options_compositions" ADD CONSTRAINT "choix_options_compositions_choixOptionId_fkey" FOREIGN KEY ("choixOptionId") REFERENCES "choix_options"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "choix_options_compositions" ADD CONSTRAINT "choix_options_compositions_materiauId_fkey" FOREIGN KEY ("materiauId") REFERENCES "materiaux"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "choix_options_compositions" ADD CONSTRAINT "choix_options_compositions_serviceMainOeuvreId_fkey" FOREIGN KEY ("serviceMainOeuvreId") REFERENCES "services_main_oeuvre"("id") ON DELETE SET NULL ON UPDATE CASCADE;
