-- Lecture seule : export plat des relations réellement enregistrées dans devis_ia_test.
SELECT
    p.id AS prestation_id,
    p.nom AS prestation_nom,
    p.description AS prestation_description,
    op.id AS option_id,
    op.nom AS option_nom,
    op."prestationId" AS option_prestation_id,
    co.id AS choix_id,
    co.nom AS choix_nom,
    co."optionId" AS choix_option_id
FROM prestations p
LEFT JOIN options_prestations op ON op."prestationId" = p.id
LEFT JOIN choix_options co ON co."optionId" = op.id
ORDER BY p.id, op.id, co.id;

-- Les deux résultats doivent être 0.
SELECT COUNT(*) AS options_sans_prestation
FROM options_prestations op
LEFT JOIN prestations p ON p.id = op."prestationId"
WHERE p.id IS NULL;

SELECT COUNT(*) AS choix_sans_option
FROM choix_options co
LEFT JOIN options_prestations op ON op.id = co."optionId"
WHERE op.id IS NULL;
