-- Synthetic BTP catalogue for local retrieval tests. Prices are illustrative, not market data.
SET client_encoding TO 'UTF8';
\if :{?company_id}
\else
  \set company_id 1
\endif

WITH seed(sku_catalogue,item_type,label,description,unite,unit_cost,unit_sale_price) AS (
  VALUES
    ('MAT-CAR-6060-GREY','materiau','Carrelage grès cérame 60x60 gris','Carrelage de sol intérieur, grès cérame rectifié gris, format 60 x 60 cm.','M2',28.50,NULL),
    ('MAT-CAR-MUR-WHITE','materiau','Faïence murale blanche 30x60','Faïence blanche brillante pour murs de salle de bain et cuisine.','M2',22.00,NULL),
    ('MAT-CAR-ANTISLIP','materiau','Carrelage antidérapant salle d eau','Carrelage de sol antidérapant R10 adapté aux pièces humides.','M2',34.00,NULL),
    ('MAT-COLLE-C2','materiau','Colle carrelage C2','Mortier colle flexible C2 pour pose de carrelage mural ou sol.','KG',0.62,NULL),
    ('MAT-JOINT-EPOXY','materiau','Joint époxy hydrofuge','Joint époxy résistant à l humidité pour carrelage de salle de bain.','KG',8.90,NULL),
    ('MAT-JOINT-CIMENT','materiau','Joint ciment gris','Joint de carrelage ciment standard gris pour intérieur.','KG',2.10,NULL),
    ('MAT-RAGREAGE','materiau','Ragréage autolissant sol','Enduit de ragréage autolissant pour préparer un sol avant revêtement.','KG',0.78,NULL),
    ('MAT-PEINTURE-BLANCHE','materiau','Peinture acrylique blanche satinée','Peinture intérieure lavable deux couches pour murs et plafonds.','LITRE',9.50,NULL),
    ('MAT-SOUSCOUCHE','materiau','Sous-couche universelle','Primaire d accroche pour murs intérieurs avant peinture.','LITRE',7.20,NULL),
    ('MAT-PLACOPLATRE','materiau','Plaque de plâtre BA13','Plaque de plâtre BA13 pour cloison et doublage intérieur.','M2',5.80,NULL),
    ('MAT-LAINE-VERRE','materiau','Laine de verre 100 mm','Isolant thermique et acoustique en laine de verre 100 mm.','M2',8.40,NULL),
    ('MAT-PER-16','materiau','Tube PER multicouche 16 mm','Tube plomberie multicouche pour alimentation eau chaude et froide.','ML',3.20,NULL),
    ('MAT-PVC-40','materiau','Tube évacuation PVC 40 mm','Tube PVC pour évacuation sanitaire, diamètre 40 mm.','ML',2.40,NULL),
    ('MAT-PORTE-BLOC','materiau','Bloc porte intérieure isoplane','Bloc porte intérieur prépeint avec huisserie standard.','PIECE',115.00,NULL),
    ('MAT-PARQUET','materiau','Parquet stratifié chêne','Revêtement de sol stratifié finition chêne pour pièce sèche.','M2',18.00,NULL),
    ('MO-CAR-SOL','main_oeuvre','Main oeuvre pose carrelage sol','Pose professionnelle de carrelage au sol avec réglage et alignement.','HEURE',34.00,NULL),
    ('MO-CAR-MUR','main_oeuvre','Main oeuvre pose faïence murale','Pose de faïence murale et découpes techniques.','HEURE',36.00,NULL),
    ('MO-PEINTURE','main_oeuvre','Main oeuvre peinture intérieure','Préparation des supports et application de peinture intérieure.','HEURE',30.00,NULL),
    ('MO-PLACO','main_oeuvre','Main oeuvre plaquiste','Montage de cloison placo et traitement des joints.','HEURE',32.00,NULL),
    ('MO-PLOMBERIE','main_oeuvre','Main oeuvre plomberie sanitaire','Pose et raccordement de réseaux sanitaires.','HEURE',42.00,NULL),
    ('MO-MENUISERIE','main_oeuvre','Main oeuvre menuiserie intérieure','Pose et réglage de portes intérieures.','HEURE',35.00,NULL),
    ('MO-SOL','main_oeuvre','Main oeuvre pose parquet','Pose flottante de parquet stratifié et finitions.','HEURE',31.00,NULL),
    ('PREP-RAGREAGE','prestation','Préparation sol et ragréage','Préparation d un support de sol irrégulier avec ragréage autolissant.','M2',13.32,24.00),
    ('PREST-CAR-SOL','prestation','Pose carrelage sol intérieur','Fourniture et pose de carrelage grès cérame au sol, colle et joints compris.','M2',63.20,82.00),
    ('PREST-CAR-MUR','prestation','Pose faïence murale salle de bain','Fourniture et pose de faïence murale blanche en pièce humide.','M2',60.60,89.50),
    ('PREST-CAR-ANTISLIP','prestation','Pose carrelage antidérapant salle de bain','Fourniture et pose de carrelage antidérapant pour sol de salle d eau.','M2',72.10,95.00),
    ('PREST-PEINTURE','prestation','Peinture murs intérieurs deux couches','Préparation légère, sous-couche et deux couches de peinture acrylique.','M2',17.30,31.00),
    ('PREST-CLOISON','prestation','Montage cloison placo isolée','Création de cloison en plaques de plâtre BA13 avec isolation laine de verre.','M2',39.80,60.00),
    ('PREST-PLOMBERIE','prestation','Création alimentation eau PER','Fourniture et pose d alimentation eau chaude et froide en PER multicouche.','ML',20.64,42.00),
    ('PREST-EVACUATION','prestation','Raccordement évacuation sanitaire en PVC','Raccordement évacuation sanitaire en PVC diamètre 40 mm.','ML',15.48,33.50),
    ('PREST-PORTE','prestation','Pose porte intérieure','Fourniture et pose d un bloc porte intérieur avec réglage.','PIECE',185.00,315.00),
    ('PREST-PARQUET','prestation','Pose parquet stratifié','Fourniture et pose flottante de parquet stratifié avec sous couche.','M2',36.60,57.00),
    ('PREST-RENOV-SDB','prestation','Rénovation salle de bain carrelage','Ensemble indicatif comprenant préparation sol, carrelage sol et faïence murale.','FORFAIT',2500.00,3000.00)
)
INSERT INTO catalogue_items (company_id,sku_catalogue,item_type,label,description,unite,unit_cost,unit_sale_price,source_hash,source_metadata)
SELECT :'company_id',sku_catalogue,item_type,label,description,unite,unit_cost,unit_sale_price,'demo-btp-v4',jsonb_build_object('origin','synthetic_demo','price_notice','illustrative only')
FROM seed
ON CONFLICT (company_id,sku_catalogue) DO UPDATE SET
  item_type=EXCLUDED.item_type,label=EXCLUDED.label,description=EXCLUDED.description,unite=EXCLUDED.unite,
  unit_cost=EXCLUDED.unit_cost,unit_sale_price=EXCLUDED.unit_sale_price,
  source_metadata=EXCLUDED.source_metadata,
  embedding=CASE WHEN catalogue_items.source_hash IS DISTINCT FROM EXCLUDED.source_hash THEN NULL ELSE catalogue_items.embedding END,
  embedding_model=CASE WHEN catalogue_items.source_hash IS DISTINCT FROM EXCLUDED.source_hash THEN NULL ELSE catalogue_items.embedding_model END,
  embedding_updated_at=CASE WHEN catalogue_items.source_hash IS DISTINCT FROM EXCLUDED.source_hash THEN NULL ELSE catalogue_items.embedding_updated_at END,
  source_hash=EXCLUDED.source_hash,updated_at=now();

WITH composition(prestation_sku,component_sku,quantity_per_unit) AS (
 VALUES
  ('PREP-RAGREAGE','MAT-RAGREAGE',4),('PREP-RAGREAGE','MO-CAR-SOL',0.3),
  ('PREST-CAR-SOL','MAT-CAR-6060-GREY',1.05),('PREST-CAR-SOL','MAT-COLLE-C2',4),('PREST-CAR-SOL','MAT-JOINT-CIMENT',0.3),('PREST-CAR-SOL','MO-CAR-SOL',0.8),
  ('PREST-CAR-MUR','MAT-CAR-MUR-WHITE',1.08),('PREST-CAR-MUR','MAT-COLLE-C2',3.5),('PREST-CAR-MUR','MAT-JOINT-EPOXY',0.3),('PREST-CAR-MUR','MO-CAR-MUR',0.9),
  ('PREST-CAR-ANTISLIP','MAT-CAR-ANTISLIP',1.05),('PREST-CAR-ANTISLIP','MAT-COLLE-C2',4),('PREST-CAR-ANTISLIP','MAT-JOINT-EPOXY',0.35),('PREST-CAR-ANTISLIP','MO-CAR-SOL',0.9),
  ('PREST-PEINTURE','MAT-SOUSCOUCHE',0.1),('PREST-PEINTURE','MAT-PEINTURE-BLANCHE',0.25),('PREST-PEINTURE','MO-PEINTURE',0.4),
  ('PREST-CLOISON','MAT-PLACOPLATRE',1),('PREST-CLOISON','MAT-LAINE-VERRE',1),('PREST-CLOISON','MO-PLACO',0.8),
  ('PREST-PLOMBERIE','MAT-PER-16',1.2),('PREST-PLOMBERIE','MO-PLOMBERIE',0.4),
  ('PREST-EVACUATION','MAT-PVC-40',1.2),('PREST-EVACUATION','MO-PLOMBERIE',0.3),
  ('PREST-PORTE','MAT-PORTE-BLOC',1),('PREST-PORTE','MO-MENUISERIE',2),
  ('PREST-PARQUET','MAT-PARQUET',1.05),('PREST-PARQUET','MO-SOL',0.6)
)
INSERT INTO catalogue_item_components(prestation_id,component_id,quantity_per_unit)
SELECT prestation.id,component.id,composition.quantity_per_unit
FROM composition
JOIN catalogue_items prestation ON prestation.company_id=:'company_id' AND prestation.sku_catalogue=composition.prestation_sku
JOIN catalogue_items component ON component.company_id=:'company_id' AND component.sku_catalogue=composition.component_sku
ON CONFLICT(prestation_id,component_id) DO UPDATE SET quantity_per_unit=EXCLUDED.quantity_per_unit;

WITH benchmark_seed(sku_catalogue,label,unite,unit_cost,unit_sale_price) AS (
 VALUES
 ('PREST-DEPOSE-CAR','Dépose revêtement carrelage','FORFAIT',180,300),
 ('PREST-PLINTHE-BOIS','Pose plinthes bois massif','ML',12,22),
 ('PREST-PONCAGE-MUR','Ponçage et rebouchage murs','M2',4,8),
 ('PREST-REMPL-SANITAIRE','Remplacement équipement sanitaire','PIECE',220,380),
 ('PREST-DOUCHE','Fourniture et pose douche','PIECE',700,1200),
 ('PREST-WC','Fourniture et pose WC','PIECE',250,450),
 ('PREST-LAVABO','Fourniture et pose lavabo','PIECE',180,340),
 ('PREST-CAR-SOL-3030','Pose carrelage sol petit format','M2',50,78),
 ('PREST-ISOL-COMBLES-SOUFFLE','Isolation combles perdus par soufflage','M2',16,29),
 ('PREST-ISOL-RAMPANTS','Isolation combles rampants avec placo','M2',37,68),
 ('PREST-PARE-VAPEUR','Pose membrane pare-vapeur','M2',2,5),
 ('PREST-BAIE-VITREE','Fourniture et pose baie vitrée coulissante','PIECE',1100,1900),
 ('PREST-OUVERTURE-PORTEUSE','Ouverture mur porteur avec IPN','FORFAIT',1600,2800),
 ('PREST-SOUTENEMENT','Étaiement et protection chantier','FORFAIT',300,550),
 ('PREST-RADIATEUR-FONTE','Fourniture et pose radiateur fonte','PIECE',150,250),
 ('PREST-RACC-CHAUFFAGE','Raccordement hydraulique chauffage','FORFAIT',120,220),
 ('PREST-MISE-SERVICE','Mise en service et réglage','FORFAIT',90,160),
 ('PREST-CAR-ESCALIER','Pose carrelage escalier antidérapant','MARCHE',45,85),
 ('PREST-ISOL-MUR-PLACO','Isolation mur intérieur avec placo','M2',35,62),
 ('PREST-FAUX-PLAFOND-PLACO','Faux plafond placo sur ossature','M2',32,58),
 ('PREST-FAUX-PLAFOND-DALLES','Faux plafond dalles acoustiques','M2',28,52),
 ('PREST-EXTRACTION-AIR','Pose extracteur d’air salle de bain','PIECE',110,210),
 ('PREST-TRAIT-HUMIDITE','Traitement anti-humidité murs','FORFAIT',190,340),
 ('PREST-PRISE','Pose prise électrique','PIECE',12,22),
 ('PREST-INTERRUPTEUR','Pose interrupteur électrique','PIECE',10,19),
 ('PREST-CABLAGE-SURFACE','Câblage électrique apparent','ML',5,10),
 ('PREST-CHAUFFE-EAU-150L','Remplacement chauffe-eau électrique 150 L','PIECE',560,980),
 ('PREST-MITIGEUR-THERMO','Pose mitigeur thermostatique','PIECE',95,180),
 ('PREST-CAR-EXTERIEUR','Pose carrelage extérieur antigel','M2',55,92),
 ('PREST-TOITURE-TUILES','Réfection toiture tuiles','M2',72,125),
 ('PREST-ECRAN-SOUS-TOIT','Pose écran de sous-toiture','M2',9,18),
 ('PREST-FAITAGE-RIVE','Faîtage, rives et finitions toiture','ML',20,39),
 ('PREST-SOLIN-CHEMINEE','Réparation solin de cheminée','FORFAIT',180,350),
 ('PREST-ISOL-EXTERIEURE','Isolation thermique extérieure EPS','M2',75,135),
 ('PREST-ECHAFAUDAGE','Installation échafaudage','M2',8,16),
 ('PREST-PAC-8KW','Fourniture et pose pompe à chaleur 8 kW','PIECE',6200,9900),
 ('PREST-PAC-12KW','Fourniture et pose pompe à chaleur 12 kW','PIECE',7600,11800),
 ('PREST-DEPOSE-CHAUFFAGE','Dépose ancien système de chauffage','FORFAIT',280,520),
 ('PREST-PV-PANNEAU','Fourniture et pose panneau photovoltaïque 460 W','PIECE',190,340),
 ('PREST-PV-ONDULEUR','Installation onduleur photovoltaïque hybride','PIECE',900,1550),
 ('PREST-PV-BATTERIE','Installation batterie lithium photovoltaïque','KWH',500,850),
 ('PREST-PV-RACCORDEMENT','Raccordement et protection photovoltaïque','FORFAIT',500,950),
 ('PREST-FENETRE-PVC','Fourniture et pose fenêtre PVC','PIECE',320,590),
 ('PREST-BRIQUE-PAREMENT','Pose briques de parement façade','M2',55,105),
 ('PREST-NETTOYAGE-TOIT','Nettoyage et démoussage toiture','M2',10,22),
 ('PREST-NETTOYAGE-FACADE','Nettoyage façade et évacuation déchets','M2',8,18),
 ('PREST-FUMISTERIE','Réparation conduit et fumisterie cheminée','FORFAIT',250,480),
 ('PREST-CORNICHE','Réparation corniche et gouttière','ML',35,70)
)
INSERT INTO catalogue_items (company_id,sku_catalogue,item_type,label,description,unite,unit_cost,unit_sale_price,source_hash,source_metadata)
SELECT :'company_id', sku_catalogue, 'prestation', label, label, unite, unit_cost, unit_sale_price, 'benchmark-demo-v2', jsonb_build_object('origin','benchmark-demo')
FROM benchmark_seed
ON CONFLICT (company_id,sku_catalogue) DO UPDATE SET
 label=EXCLUDED.label, description=EXCLUDED.description, unite=EXCLUDED.unite,
 unit_cost=EXCLUDED.unit_cost, unit_sale_price=EXCLUDED.unit_sale_price,
 source_hash=EXCLUDED.source_hash, source_metadata=EXCLUDED.source_metadata,
 actif=true, updated_at=now();

WITH benchmark_materials(sku_catalogue,label,unite,unit_cost) AS (
 VALUES
 ('MAT-PLINTHE-BOIS','Plinthe bois massif','ML',6),('MAT-DOUCHE','Receveur et colonne de douche','PIECE',430),
 ('MAT-WC','WC complet','PIECE',150),('MAT-LAVABO','Lavabo et meuble simple','PIECE',95),
 ('MAT-LAINE-300','Laine de verre 300 mm','M2',9),('MAT-PARE-VAPEUR','Membrane pare-vapeur','M2',1.2),
 ('MAT-IPN','Poutre IPN acier','ML',180),('MAT-RADIATEUR','Radiateur fonte','PIECE',95),
 ('MAT-PRISE','Prise électrique blanche','PIECE',4),('MAT-INTER','Interrupteur blanc','PIECE',3),
 ('MAT-CABLE','Câble électrique gaine','ML',1.5),('MAT-CHAUFFE-EAU','Chauffe-eau électrique 150 L','PIECE',390),
 ('MAT-MITIGEUR','Mitigeur thermostatique','PIECE',60),('MAT-TUILE','Tuile terre cuite','M2',34),
 ('MAT-ECRAN-TOIT','Écran sous-toiture','M2',4),('MAT-EPS-120','Panneau EPS 120 mm','M2',25),
 ('MAT-PAC-8','Pompe à chaleur air-eau 8 kW','PIECE',4900),('MAT-PAC-12','Pompe à chaleur air-eau 12 kW','PIECE',6100),
 ('MAT-PV-460','Panneau photovoltaïque 460 W','PIECE',120),('MAT-ONDULEUR','Onduleur hybride 5 kW','PIECE',650),
 ('MAT-BATTERIE','Batterie lithium photovoltaïque','KWH',350),('MAT-FENETRE-PVC','Fenêtre PVC blanche','PIECE',220),
 ('MAT-BRIQUE-PAREMENT','Brique de parement rouge','M2',30),('MAT-GOUTTIERE','Gouttière et corniche','ML',18)
 ,('MAT-EXTRACTEUR','Extracteur d’air','PIECE',55),('MAT-FAUX-PLAFOND','Dalle acoustique plafond','M2',15),('MAT-SOLIN','Solin et bande d’étanchéité','ML',8),('MAT-PRODUIT-NETTOYAGE','Produit traitement toiture/façade','M2',3),('MO-ELECTRICITE','Main oeuvre électricien','HEURE',46)
)
INSERT INTO catalogue_items (company_id,sku_catalogue,item_type,label,description,unite,unit_cost,unit_sale_price,source_hash,source_metadata)
SELECT :'company_id',sku_catalogue,'materiau',label,label,unite,unit_cost,NULL,'benchmark-materials-v2',jsonb_build_object('origin','benchmark-demo') FROM benchmark_materials
ON CONFLICT (company_id,sku_catalogue) DO UPDATE SET label=EXCLUDED.label,description=EXCLUDED.description,unite=EXCLUDED.unite,unit_cost=EXCLUDED.unit_cost,source_hash=EXCLUDED.source_hash,actif=true,updated_at=now();

WITH benchmark_compositions(prestation_sku,component_sku,quantity_per_unit) AS (
 VALUES
 ('PREST-PLINTHE-BOIS','MAT-PLINTHE-BOIS',1),('PREST-PLINTHE-BOIS','MO-MENUISERIE',0.15),
 ('PREST-DEPOSE-CAR','MO-CAR-SOL',1.8),('PREST-PONCAGE-MUR','MO-PEINTURE',0.12),
 ('PREST-DOUCHE','MAT-DOUCHE',1),('PREST-DOUCHE','MO-PLOMBERIE',3),('PREST-WC','MAT-WC',1),('PREST-WC','MO-PLOMBERIE',1.5),('PREST-LAVABO','MAT-LAVABO',1),('PREST-LAVABO','MO-PLOMBERIE',1.2),
 ('PREST-ISOL-COMBLES-SOUFFLE','MAT-LAINE-300',1),('PREST-ISOL-COMBLES-SOUFFLE','MO-PLACO',0.18),('PREST-PARE-VAPEUR','MAT-PARE-VAPEUR',1.05),('PREST-PARE-VAPEUR','MO-PLACO',0.08),('PREST-ISOL-RAMPANTS','MAT-LAINE-VERRE',1),('PREST-ISOL-RAMPANTS','MAT-PLACOPLATRE',1),('PREST-ISOL-RAMPANTS','MO-PLACO',0.8),
 ('PREST-OUVERTURE-PORTEUSE','MAT-IPN',1.5),('PREST-OUVERTURE-PORTEUSE','MO-MENUISERIE',12),('PREST-RADIATEUR-FONTE','MAT-RADIATEUR',1),('PREST-RADIATEUR-FONTE','MO-PLOMBERIE',1),('PREST-RACC-CHAUFFAGE','MO-PLOMBERIE',2),('PREST-MISE-SERVICE','MO-PLOMBERIE',1.5),
 ('PREST-PRISE','MAT-PRISE',1),('PREST-PRISE','MO-ELECTRICITE',0.15),('PREST-INTERRUPTEUR','MAT-INTER',1),('PREST-INTERRUPTEUR','MO-ELECTRICITE',0.12),('PREST-CABLAGE-SURFACE','MAT-CABLE',1.1),('PREST-CABLAGE-SURFACE','MO-ELECTRICITE',0.1),
 ('PREST-REMPL-SANITAIRE','MO-PLOMBERIE',2),('PREST-CAR-SOL-3030','MAT-CAR-6060-GREY',1.05),('PREST-CAR-SOL-3030','MO-CAR-SOL',0.8),('PREST-BAIE-VITREE','MAT-FENETRE-PVC',1),('PREST-BAIE-VITREE','MO-MENUISERIE',3),('PREST-SOUTENEMENT','MO-MENUISERIE',5),('PREST-CAR-ESCALIER','MAT-CAR-ANTISLIP',0.35),('PREST-CAR-ESCALIER','MO-CAR-SOL',0.7),
 ('PREST-FAUX-PLAFOND-PLACO','MAT-PLACOPLATRE',1),('PREST-FAUX-PLAFOND-PLACO','MO-PLACO',0.7),('PREST-FAUX-PLAFOND-DALLES','MAT-FAUX-PLAFOND',1),('PREST-FAUX-PLAFOND-DALLES','MO-PLACO',0.4),('PREST-EXTRACTION-AIR','MAT-EXTRACTEUR',1),('PREST-EXTRACTION-AIR','MO-ELECTRICITE',1),('PREST-TRAIT-HUMIDITE','MAT-PRODUIT-NETTOYAGE',10),('PREST-TRAIT-HUMIDITE','MO-PLACO',2),
 ('PREST-CHAUFFE-EAU-150L','MAT-CHAUFFE-EAU',1),('PREST-CHAUFFE-EAU-150L','MO-PLOMBERIE',2.5),('PREST-MITIGEUR-THERMO','MAT-MITIGEUR',1),('PREST-MITIGEUR-THERMO','MO-PLOMBERIE',0.8),
 ('PREST-CAR-EXTERIEUR','MAT-CAR-ANTISLIP',1.05),('PREST-CAR-EXTERIEUR','MO-CAR-SOL',0.9),('PREST-FAITAGE-RIVE','MAT-SOLIN',1),('PREST-FAITAGE-RIVE','MO-CAR-SOL',0.35),('PREST-SOLIN-CHEMINEE','MAT-SOLIN',3),('PREST-SOLIN-CHEMINEE','MO-CAR-SOL',2),('PREST-ECHAFAUDAGE','MO-MENUISERIE',0.2),
 ('PREST-TOITURE-TUILES','MAT-TUILE',1.1),('PREST-TOITURE-TUILES','MO-CAR-SOL',1),('PREST-ECRAN-SOUS-TOIT','MAT-ECRAN-TOIT',1.05),('PREST-ECRAN-SOUS-TOIT','MO-CAR-SOL',0.25),
 ('PREST-ISOL-EXTERIEURE','MAT-EPS-120',1),('PREST-ISOL-EXTERIEURE','MO-PLACO',0.9),('PREST-PAC-8KW','MAT-PAC-8',1),('PREST-PAC-8KW','MO-PLOMBERIE',12),('PREST-PAC-12KW','MAT-PAC-12',1),('PREST-PAC-12KW','MO-PLOMBERIE',15),
 ('PREST-PV-PANNEAU','MAT-PV-460',1),('PREST-PV-PANNEAU','MO-MENUISERIE',0.4),('PREST-PV-ONDULEUR','MAT-ONDULEUR',1),('PREST-PV-ONDULEUR','MO-PLOMBERIE',2),('PREST-PV-BATTERIE','MAT-BATTERIE',1),('PREST-PV-BATTERIE','MO-PLOMBERIE',1),
 ('PREST-DEPOSE-CHAUFFAGE','MO-PLOMBERIE',4),('PREST-PV-RACCORDEMENT','MO-ELECTRICITE',4),('PREST-NETTOYAGE-TOIT','MAT-PRODUIT-NETTOYAGE',1),('PREST-NETTOYAGE-TOIT','MO-CAR-SOL',0.25),('PREST-NETTOYAGE-FACADE','MAT-PRODUIT-NETTOYAGE',1),('PREST-NETTOYAGE-FACADE','MO-PLACO',0.2),('PREST-FUMISTERIE','MAT-SOLIN',2),('PREST-FUMISTERIE','MO-MENUISERIE',3),
 ('PREST-FENETRE-PVC','MAT-FENETRE-PVC',1),('PREST-FENETRE-PVC','MO-MENUISERIE',2),('PREST-BRIQUE-PAREMENT','MAT-BRIQUE-PAREMENT',1),('PREST-BRIQUE-PAREMENT','MO-CAR-MUR',0.6),('PREST-CORNICHE','MAT-GOUTTIERE',1),('PREST-CORNICHE','MO-MENUISERIE',0.5)
)
INSERT INTO catalogue_item_components(prestation_id,component_id,quantity_per_unit)
SELECT prestation.id,component.id,benchmark_compositions.quantity_per_unit FROM benchmark_compositions
JOIN catalogue_items prestation ON prestation.company_id=:'company_id' AND prestation.sku_catalogue=benchmark_compositions.prestation_sku
JOIN catalogue_items component ON component.company_id=:'company_id' AND component.sku_catalogue=benchmark_compositions.component_sku
ON CONFLICT(prestation_id,component_id) DO UPDATE SET quantity_per_unit=EXCLUDED.quantity_per_unit;
