# Lot A — écarts de livraison, dépenses, validations, recherche par ville (18/11/2026)

## Pourquoi
Le mobile (parties 2, 3, 4) a des écrans sans route backend : OCR du bon de livraison (écarts),
OCR de la facture fournisseur (dépense en brouillon), onglets « Commandes » et « Factures » des
validations de l'admin, recherche des clients par ville. Le web ne doit pas changer.

## Décisions (validées le 18/11)
- Ordre : lot A d'abord, puis lot B (installateur = sous-traitant existant, installation créée à la signature).
- Onglet « Commandes » des validations = livraisons avec écarts (scan du bon de livraison).
- Chef : il envoie les montants d'une facture fournisseur mais ne les relit jamais.
- Valideurs des livraisons avec écarts et des dépenses : ADMIN et ASSISTANTE.
- Approche retenue : compléter la réception existante (pas de « contrôle » séparé).

## Approches considérées
1. Compléter `Reception` (photo du BL, écarts, statut de contrôle) — retenue : une seule saisie,
   le stock reste juste, le web garde la réception sans écart.
2. Modèle « ControleLivraison » séparé — rejetée : double saisie des quantités, stock non suivi.

## Design
- Réception : `statutControle` SANS_ECART | A_VERIFIER | ACCEPTEE | REFUSEE, motif, contrôleur, date ;
  table `receptions_ecarts` (type MANQUANT | EN_TROP | INCONNU | ABIME, ligne de commande facultative,
  libellé, quantité constatée, commentaire) ; fichiers (bon de livraison, photos) liés à la réception.
  « En trop » et « inconnu » n'entrent pas dans le stock. Une réception peut ne contenir que des écarts.
  Routes : `POST /commandes-fournisseur/:id/receptions` (+ `ecarts[]`), `POST /receptions/:id/fichiers`,
  `GET /receptions?statutControle=`, `GET /receptions/:id`, `POST /receptions/:id/valider`,
  `POST /receptions/:id/refuser { motif }`. Notifications : écarts → ADMIN + ASSISTANTE ; décision → auteur.
- Dépense : référence DEP-AAAA-NNNN, fournisseur (fiche ou nom libre), numéro, date, HT / TVA / TTC,
  chantier et commande facultatifs, champs douteux (liste), photo(s), statut BROUILLON | VALIDEE | REFUSEE.
  Doublon fournisseur + numéro → 409 DEPENSE_EXISTANTE. STAFF crée ; le chef ne voit que les siennes et
  sans montants ; modification / suppression en BROUILLON par l'auteur ou le bureau ;
  valider / refuser (motif) par ADMIN et ASSISTANTE. Notifications comme ci-dessus.
- `GET /validations/compteurs` : signatures papier (ADMIN), livraisons à vérifier, dépenses à valider.
- `GET /clients?search=` cherche aussi dans `adresseClient` et `adresseChantier`.
- Une migration qui n'ajoute que des colonnes / tables ; audit des décisions ; tests e2e ; doc RBAC.

## Laissé au constructeur
Noms exacts des modules, format des réponses (calqué sur l'existant), textes des notifications.
