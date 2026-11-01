-- Données minimales pour tester ai-service.
-- TRUNCATE en tête : relancer ce fichier n'ajoute pas de doublons.

TRUNCATE TABLE
  choix_options_compositions,
  prestations_compositions,
  choix_options,
  options_prestations,
  lignes_devis,
  devis,
  prestations,
  categories_prestations,
  materiaux,
  services_main_oeuvre,
  clients,
  companies
RESTART IDENTITY CASCADE;

INSERT INTO companies (id, nom, "tvaDefaut", devise, "createdAt", "updatedAt")
VALUES (1, 'Bâtiment Test SARL', 20.0, 'EUR', now(), now());

INSERT INTO clients (id, "companyId", nom, prenom, email, source, "createdAt", "updatedAt")
VALUES (1, 1, 'Dupont', 'Jean', 'jean.dupont@example.com', 'AUTRE', now(), now());

INSERT INTO categories_prestations (id, "companyId", nom, actif, "createdAt", "updatedAt")
VALUES (1, 1, 'Revêtements sols', true, now(), now());

INSERT INTO materiaux (id, "companyId", nom, unite, "prixAchatFixe", actif, "createdAt", "updatedAt")
VALUES
  (1, 1, 'Carrelage grès cérame 60x60', 'M2', 35.00, true, now(), now()),
  (2, 1, 'Colle carrelage', 'KG', 2.50, true, now(), now()),
  (3, 1, 'Joint epoxy renforcé', 'KG', 8.00, true, now(), now());

INSERT INTO services_main_oeuvre (id, "companyId", nom, unite, "prixUnitaire", actif, "createdAt", "updatedAt")
VALUES
  (1, 1, 'Pose carrelage ', 'M2', 45.00, true, now(), now()),
  (2, 1, 'Application peinture', 'M2', 18.00, true, now(), now());

INSERT INTO prestations (
  id, "companyId", "categorieId", nom, unite,
  "prixVenteMin", "prixVenteMax", description, actif, "createdAt", "updatedAt"
)
VALUES
  (1, 1, 1, 'Pose carrelage au sol', 'M2', 70.00, 120.00,
   'Fourniture et pose de carrelage au sol, joints inclus', true, now(), now()),
  (2, 1, 1, 'Peinture murs intérieurs', 'M2', 15.00, 35.00,
   'Peinture acrylique deux couches sur murs préparés', true, now(), now());

INSERT INTO prestations_compositions ("prestationId", "materiauId", "quantiteParUnite")
VALUES
  (1, 1, 1.05),
  (1, 2, 5.0);

INSERT INTO prestations_compositions ("prestationId", "serviceMainOeuvreId", "quantiteParUnite")
VALUES
  (1, 1, 1.0),
  (2, 2, 1.0);

-- Options de prestation (OptionPrestation) + choix (ChoixOption) + composition du choix
-- Chaîne : prestation → option_prestations → choix_options → choix_options_compositions
INSERT INTO options_prestations (id, "prestationId", nom, description, ordre, "createdAt", "updatedAt")
VALUES (1, 1, 'Finition joint', 'Type de joint pour le carrelage', 1, now(), now());

INSERT INTO choix_options (id, "optionId", nom, description, ordre, "createdAt", "updatedAt")
VALUES
  (1, 1, 'Joint standard', 'Joint ciment classique', 1, now(), now()),
  (2, 1, 'Joint epoxy renforcé', 'Joint étanche pour pièces humides', 2, now(), now());

INSERT INTO choix_options_compositions ("choixOptionId", "materiauId", "quantiteParUnite")
VALUES (2, 3, 0.3);

-- Remettre les compteurs auto-incrément au bon niveau
SELECT setval(pg_get_serial_sequence('companies', 'id'), 1);
SELECT setval(pg_get_serial_sequence('clients', 'id'), 1);
SELECT setval(pg_get_serial_sequence('categories_prestations', 'id'), 1);
SELECT setval(pg_get_serial_sequence('materiaux', 'id'), 3);
SELECT setval(pg_get_serial_sequence('services_main_oeuvre', 'id'), 2);
SELECT setval(pg_get_serial_sequence('prestations', 'id'), 2);
SELECT setval(pg_get_serial_sequence('options_prestations', 'id'), 1);
SELECT setval(pg_get_serial_sequence('choix_options', 'id'), 2);
