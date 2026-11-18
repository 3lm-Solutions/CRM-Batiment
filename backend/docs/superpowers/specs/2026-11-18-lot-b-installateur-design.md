# Lot B — installateur délégué (18/11/2026)

## Pourquoi
Partie 4 du mobile : suivi des installations déléguées (Aya), espace missions, planification /
livraison, avancement et problèmes, PV de fin de travaux (Hayat). Aucune route n'existe.
Le web ne change pas.

## Décisions (validées le 18/11)
- L'installateur est un **sous-traitant existant** (compte SOUS_TRAITANT) marqué « installateur ».
- L'installation est créée **toute seule à la signature** quand le chantier est en mode **Régie** ;
  en mode **Les deux**, l'admin la crée à la main (« Déléguer la pose »).
- 8 étapes : DEVIS_SIGNE → INSTALLATEUR_PROPOSE → MISSION_ACCEPTEE → LIVRAISON → POSE →
  FINITIONS → TERMINEE (PV signé) → CLOTUREE. Un refus de mission ramène à DEVIS_SIGNE.
- Dates : l'admin met une date souhaitée ; l'installateur la confirme ou en propose une autre ;
  l'admin accepte la proposition. Tout le monde est prévenu.
- PV : PDF généré avec QR `BATIFLOW:PV:<id>:<code>` ; scan → QR vérifié, preuves gardées,
  TERMINEE, admin prévenu. QR illisible → envoi manuel « à vérifier » par l'admin.
- Problèmes : fiche « signalement » (RESERVE | RETARD | INCIDENT, description, photos) sur
  l'installation, admin prévenu ; l'admin (ou l'assistante) peut la transformer en ticket SAV.
- Livraison : l'installateur réutilise les réceptions du lot A (écarts + photos) sur les commandes
  de SES installations, sans aucun prix.

## Approches considérées
1. Module `installations` à part (modèle Installation + chronologie + signalements), portail
   installateur sous `/installateur/missions` — retenue : ne touche pas au chantier ni au portail
   sous-traitant existants, le web ne change pas.
2. Étendre le chantier et le portail sous-traitant — rejetée : mélange la pose par l'équipe et la
   pose déléguée, et risque de changer le web.

## Design
- Données : `SousTraitant.installateur` ; `Installation` (référence INS-AAAA-NNNN, chantier unique,
  devis, étape, installateur, note d'attribution, dates souhaitée / proposée / confirmée,
  code PV, PV signé le, PV à vérifier, scan du PV, relancée le, clôturée le) ;
  `InstallationEvenement` (chronologie) ; `Signalement` (type, description, statut OUVERT | TRAITE,
  SAV demandé, ticket SAV) ; fichiers liés à une installation (photo d'étape) ou à un signalement.
- Bureau (ADMIN, ASSISTANTE) — `/installations` : liste par étape (retards et alertes livraison mis
  en avant), compteurs, détail + chronologie, création manuelle, installateurs disponibles (note
  moyenne, missions en cours), attribuer (avec note et date souhaitée), relancer, accepter la date
  proposée, valider / rejeter un PV manuel, traiter un signalement, signalement → SAV, clôturer,
  supprimer (avant acceptation), PDF du PV. Menu web : rien (le mobile seulement).
- Installateur — `/installateur/missions` : liste (proposées / en cours / terminées), détail
  (client, adresse, articles sans prix, dates, livraisons sans prix, chronologie), accepter,
  refuser (motif obligatoire, admin prévenu), confirmer la date / proposer une date, photos
  d'étape (LIVRAISON, POSE, FINITIONS), avancer d'étape (au moins une photo de l'étape quittée),
  signaler un problème, PDF du PV, vérifier le QR, envoyer le PV scanné.
- Alertes : `enRetard` (date confirmée passée, pas terminée) ; `alerteLivraison` (une commande du
  chantier pas reçue dont la livraison prévue est absente ou après la date d'installation).
- Notifications (admin + installateur selon l'action) et audit des décisions ; e2e ; doc RBAC.

## Laissé au constructeur
Noms internes, textes des notifications, forme exacte des réponses (calquée sur l'existant).
