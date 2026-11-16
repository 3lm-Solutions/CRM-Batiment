CREATE UNIQUE INDEX "factures_one_acompte_per_devis_key"
ON "factures"("devisId")
WHERE "typeFacture" = 'ACOMPTE';