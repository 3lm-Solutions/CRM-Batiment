-- Synthetic BTP catalogue for local retrieval tests. Prices are illustrative, not market data.
\if :{?company_id}
\else
  \set company_id 1
\endif

WITH seed(sku_catalogue,item_type,label,description,unite,unit_cost) AS (
  VALUES
    ('MAT-CAR-6060-GREY','materiau','Carrelage grès cérame 60x60 gris','Carrelage de sol intérieur, grès cérame rectifié gris, format 60 x 60 cm.','M2',28.50),
    ('MAT-CAR-MUR-WHITE','materiau','Faïence murale blanche 30x60','Faïence blanche brillante pour murs de salle de bain et cuisine.','M2',22.00),
    ('MAT-CAR-ANTISLIP','materiau','Carrelage antidérapant salle d eau','Carrelage de sol antidérapant R10 adapté aux pièces humides.','M2',34.00),
    ('MAT-COLLE-C2','materiau','Colle carrelage C2','Mortier colle flexible C2 pour pose de carrelage mural ou sol.','KG',0.62),
    ('MAT-JOINT-EPOXY','materiau','Joint époxy hydrofuge','Joint époxy résistant à l humidité pour carrelage de salle de bain.','KG',8.90),
    ('MAT-JOINT-CIMENT','materiau','Joint ciment gris','Joint de carrelage ciment standard gris pour intérieur.','KG',2.10),
    ('MAT-RAGREAGE','materiau','Ragréage autolissant sol','Enduit de ragréage autolissant pour préparer un sol avant revêtement.','KG',0.78),
    ('MAT-PEINTURE-BLANCHE','materiau','Peinture acrylique blanche satinée','Peinture intérieure lavable deux couches pour murs et plafonds.','LITRE',9.50),
    ('MAT-SOUSCOUCHE','materiau','Sous-couche universelle','Primaire d accroche pour murs intérieurs avant peinture.','LITRE',7.20),
    ('MAT-PLACOPLATRE','materiau','Plaque de plâtre BA13','Plaque de plâtre BA13 pour cloison et doublage intérieur.','M2',5.80),
    ('MAT-LAINE-VERRE','materiau','Laine de verre 100 mm','Isolant thermique et acoustique en laine de verre 100 mm.','M2',8.40),
    ('MAT-PER-16','materiau','Tube PER multicouche 16 mm','Tube plomberie multicouche pour alimentation eau chaude et froide.','ML',3.20),
    ('MAT-PVC-40','materiau','Tube évacuation PVC 40 mm','Tube PVC pour évacuation sanitaire, diamètre 40 mm.','ML',2.40),
    ('MAT-PORTE-BLOC','materiau','Bloc porte intérieure isoplane','Bloc porte intérieur prépeint avec huisserie standard.','PIECE',115.00),
    ('MAT-PARQUET','materiau','Parquet stratifié chêne','Revêtement de sol stratifié finition chêne pour pièce sèche.','M2',18.00),
    ('MO-CAR-SOL','main_oeuvre','Main oeuvre pose carrelage sol','Pose professionnelle de carrelage au sol avec réglage et alignement.','HEURE',34.00),
    ('MO-CAR-MUR','main_oeuvre','Main oeuvre pose faïence murale','Pose de faïence murale et découpes techniques.','HEURE',36.00),
    ('MO-PEINTURE','main_oeuvre','Main oeuvre peinture intérieure','Préparation des supports et application de peinture intérieure.','HEURE',30.00),
    ('MO-PLACO','main_oeuvre','Main oeuvre plaquiste','Montage de cloison placo et traitement des joints.','HEURE',32.00),
    ('MO-PLOMBERIE','main_oeuvre','Main oeuvre plomberie sanitaire','Pose et raccordement de réseaux sanitaires.','HEURE',42.00),
    ('MO-MENUISERIE','main_oeuvre','Main oeuvre menuiserie intérieure','Pose et réglage de portes intérieures.','HEURE',35.00),
    ('MO-SOL','main_oeuvre','Main oeuvre pose parquet','Pose flottante de parquet stratifié et finitions.','HEURE',31.00),
    ('PREP-RAGREAGE','prestation','Préparation sol et ragréage','Préparation d un support de sol irrégulier avec ragréage autolissant.','M2',13.32),
    ('PREST-CAR-SOL','prestation','Pose carrelage sol intérieur','Fourniture et pose de carrelage grès cérame au sol, colle et joints compris.','M2',63.20),
    ('PREST-CAR-MUR','prestation','Pose faïence murale salle de bain','Fourniture et pose de faïence murale blanche en pièce humide.','M2',60.60),
    ('PREST-CAR-ANTISLIP','prestation','Pose carrelage antidérapant salle de bain','Fourniture et pose de carrelage antidérapant pour sol de salle d eau.','M2',72.10),
    ('PREST-PEINTURE','prestation','Peinture murs intérieurs deux couches','Préparation légère, sous-couche et deux couches de peinture acrylique.','M2',17.30),
    ('PREST-CLOISON','prestation','Montage cloison placo isolée','Création de cloison en plaques de plâtre BA13 avec isolation laine de verre.','M2',39.80),
    ('PREST-PLOMBERIE','prestation','Création alimentation eau PER','Fourniture et pose d alimentation eau chaude et froide en PER multicouche.','ML',20.64),
    ('PREST-EVACUATION','prestation','Raccordement évacuation PVC','Fourniture et pose d évacuation sanitaire en PVC diamètre 40 mm.','ML',15.48),
    ('PREST-PORTE','prestation','Pose porte intérieure','Fourniture et pose d un bloc porte intérieur avec réglage.','PIECE',185.00),
    ('PREST-PARQUET','prestation','Pose parquet stratifié','Fourniture et pose flottante de parquet stratifié avec sous couche.','M2',36.60),
    ('PREST-RENOV-SDB','prestation','Rénovation salle de bain carrelage','Ensemble indicatif comprenant préparation sol, carrelage sol et faïence murale.','FORFAIT',2500.00)
)
INSERT INTO catalogue_items (company_id,sku_catalogue,item_type,label,description,unite,unit_cost,source_hash,source_metadata)
SELECT :'company_id',sku_catalogue,item_type,label,description,unite,unit_cost,'demo-btp-v2',jsonb_build_object('origin','synthetic_demo','price_notice','illustrative only')
FROM seed
ON CONFLICT (company_id,sku_catalogue) DO UPDATE SET
  item_type=EXCLUDED.item_type,label=EXCLUDED.label,description=EXCLUDED.description,unite=EXCLUDED.unite,
  unit_cost=EXCLUDED.unit_cost,
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
