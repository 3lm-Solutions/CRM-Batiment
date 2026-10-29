# Prix de marché (29/10)

Fourchette habituelle des prix **de l'entreprise elle-même**, sans IA ni prix inventé.

| Quoi | Source | Prix |
|---|---|---|
| Prestation | lignes des devis **signés / acceptés** | vente HT, par unité |
| Matériau — vente | lignes matériau des devis signés / acceptés | vente HT |
| Matériau — achat | lignes des **commandes fournisseur** envoyées (ni brouillon CREEE, ni ANNULEE) | achat HT |
| Secours | **barème importé** (CSV, Admin) | prix min – max |

- Période : `Company.prixMarcheMois` (6, 12 ou 24 mois — Paramètres → Prix de marché).
- Date d'un devis : signature client, sinon signature conseiller, sinon validation, sinon mise à jour.
- **3 prix minimum** sur la période ; en dessous, le barème importé prend le relais (s'il existe).
- Fourchette : 25 % – 75 % des prix dès 5 prix, min – max entre 3 et 4 ; médiane affichée.
- **Tendance** (« prédictif ») : régression linéaire prix / temps, dès 4 prix étalés sur 60 jours ;
  donne le %/an, le prix estimé aujourd'hui et dans 6 mois. Ignorée au-delà de ±50 %/an (bruit).
- Une prestation avec options est comparée toutes options confondues (le prix de la ligne).

## Écrans
- Page **Prix de marché** (Admin, Technico, Assistante) : onglets Prestations / Matériaux.
- **Éditeur de devis** : sous chaque prix, « Marché : 33,50 € – 39,00 € · 14 devis » ; orange si le
  prix est en dehors (alerte seulement, l'envoi reste possible). Jamais imprimé.
- **Proposition IA** : même information à côté du prix catalogue proposé.
- Le chef de chantier ne voit aucun de ces prix (403 sur l'API).

## Barème CSV (Admin)
```
type;nom;unite;prix_min;prix_max;achat_vente;source
PRESTATION;Pose carrelage sol;m2;45;65,50;VENTE;FFB 2026
MATERIAU;Colle carrelage C2 25 kg;piece;12;18;ACHAT;Fournisseur X
```
- « ; », « , » ou tabulation ; virgule décimale ; UTF-8 ou Windows-1252 (CSV d'Excel en français).
- `nom` = nom du catalogue (majuscules et accents ignorés). Unités : m2, ml, m3, piece, jour, heure,
  litre, kg, forfait. Une prestation n'a qu'un prix de VENTE.
- **Chaque import remplace tout le barème.** Lignes fausses : listées avec leur numéro, non importées.
  Aucune ligne valide : le barème actuel est gardé.
- Le **modèle** téléchargeable contient tout le catalogue actif (et les prix déjà importés).

## API
```
GET    /prix-marche?type=PRESTATION|MATERIAU&search=&page=   liste + fourchettes
GET    /prix-marche/devis/:devisId                           une entrée par ligne catalogue + position BAS/DANS/HAUT
GET    /prix-marche/bareme                    (ADMIN)        nombre, date du dernier import
GET    /prix-marche/bareme/modele             (ADMIN)        modèle CSV
POST   /prix-marche/bareme/import             (ADMIN)        multipart « fichier »
DELETE /prix-marche/bareme                    (ADMIN)
```
Base : table `prix_references` et colonne `companies.prixMarcheMois`, dans la migration unique `0_init`.
