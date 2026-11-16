# Catalogue de démonstration — origine et corrections

Les données (`src/database/seed/data/*.json`) ont été **extraites automatiquement** de
l'ancien `prisma/seed.ts` (3 701 lignes) en l'exécutant contre une base en mémoire, puis
corrigées. Le nouveau seed (`src/database/seed/catalogue.ts`) les valide avec zod et **s'arrête**
si un nom référencé n'existe pas — l'ancien seed ignorait silencieusement ces erreurs.

| Contenu | Nombre |
|---|---|
| Catégories / sous-catégories | 22 / 85 |
| Prestations / options / choix | 97 / 141 / 584 |
| Matériaux / services de main d'œuvre / fournisseurs | 57 / 24 / 8 |
| Compositions (prestations / choix) | 81 / 125 |

## Erreurs de l'ancien seed, corrigées

**Noms qui ne correspondaient à rien** (l'ancien seed sautait la ligne sans prévenir) :

| Nom utilisé | Nom réel du matériau / de la prestation |
|---|---|
| Peinture acrylique blanche 10L | Peinture acrylique mat 10L |
| Peinture acrylique couleur 2.5L | Peinture acrylique satin 10L |
| Enduit de lissage 15kg | Enduit de lissage (25kg) |
| Tube PER Ø16 (couronne 25m) | Tube PER 16mm (couronne 100m) |
| Receveur douche 80x80 | Receveur douche 80x120 |
| Robinet mitigeur lavabo | Mitigeur douche thermostatique |
| Câble R2V 3G2.5 (couronne 100m) | Câble R2V 3G2.5 (100m) |
| Prise électrique 2P+T | Prise électrique encastrée |
| Plaque plâtre BA13 (2.5m x 1.2m) | Plaque de plâtre BA13 (2.5x1.2m) |
| Rail R48 (3m) | Rail métallique R48 (3m) |
| Pose spot encastré *(prestation)* | Pose luminaire |
| Pose fenêtre PVC *(prestation)* | Pose fenêtre |
| Isolation combles *(prestation)* | Isolation combles soufflage |

Conséquences dans l'ancienne base : ces matériaux n'avaient **aucun fournisseur** (les
commandes fournisseur automatiques — P0.4 — les auraient ignorés) et 7 compositions
n'existaient pas (coût = 0, marge fausse).

**Supprimés** (référencés mais inexistants dans la liste des matériaux) : Tube cuivre Ø14,
Câble R2V 3G1.5, Enduit de rebouchage 5kg, Siphon PVC 40mm.

**Fournisseurs ajoutés** aux 7 matériaux qui n'en avaient pas : Lavabo vasque 60cm et
Chauffe-eau 200L → Cedeo ; Spot LED encastré 7W → Rexel ; Sable fin, Polystyrène expansé,
Fibres de polypropylène, Anhydrite → BigMat.

## À compléter

65 prestations sur 97 n'ont pas de composition (déjà le cas avant). Le contrôle
`GET /catalogue/validation` les liste en avertissement : leur coût et leur marge sont inconnus.
