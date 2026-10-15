# Schéma v2 — changements par rapport à l'ancien projet

| # | Changement | Pourquoi |
|---|---|---|
| 1 | Montants `Float` → `Decimal(12,2)`, quantités `Decimal(12,3)`, taux `Decimal(5,2)` | Plus d'erreurs d'arrondi au centime (acompte, TVA, totaux) |
| 2 | `DemandeDevis.reference` : suppression de `@default("")` | `""` + `@unique` faisait échouer la 2e demande créée sans référence |
| 3 | `LigneDevis` → prestation / matériau / service MO : `onDelete: Restrict` | L'ancien défaut (`SetNull`) effaçait silencieusement les références des devis signés (P0.6) |
| 4 | `CommandeFournisseur` : `@@unique([devisId, fournisseurId])` | P0.4 : un double clic ne peut plus créer deux commandes |
| 5 | Nouveau rôle `FOURNISSEUR` + `Fournisseur.userId` | L'ancien portail fournisseur utilisait un compte `SOUS_TRAITANT` retrouvé par email (faille : un sous-traitant voyait les commandes d'un fournisseur ayant le même email) |
| 6 | `ChantierSousTraitant.sousTraitantId` → `userId` | Le champ pointait vers `User`, pas vers `SousTraitant` : nom trompeur |
| 7 | Statuts texte → enums (`SousTraitantStatut`, `ContratSousTraitantStatut`, `AssuranceStatut`, `PaiementStatut`, `TypeAssurance`, `ModePaiement`) | L'ancien DTO contrat mettait `ACTIF` par défaut, le schéma `BROUILLON` : incohérence invisible |
| 8 | `SousTraitant.actif` supprimé (remplacé par `statut`) | Deux champs pour la même info = désynchronisation |
| 9 | `ChantierStatut.ANNULE` ajouté | L'ancien `common/workflow-state.service.ts` l'utilisait alors qu'il n'existait pas |
| 10 | `companyId` ajouté sur `Facture` et `CommandeFournisseur` | Filtrage multi-entreprise direct, sans jointure via le devis |
| 11 | Relations `company` ajoutées sur `SousCategorie` et `AssistantFeedback` | `companyId` existait sans clé étrangère |
| 12 | `Tache.avancement` : `Float` → `Int` (0–100) | C'est un pourcentage |
| 13 | `Unite.M3`, `LeadSource.WHATSAPP` ajoutés | Béton/terrassement ; leads WhatsApp (module WhatsApp) |
| 14 | `VersionDevis` : `@@unique([devisId, numeroVersion])` | Deux versions ne peuvent plus avoir le même numéro |
| 15 | `NotationSousTraitant` : `@@unique([sousTraitantId, chantierId])` | Une seule note par sous-traitant et par chantier |
| 16 | Index redondants supprimés, index composés `(companyId, statut)` ajoutés | Les listes filtrées par entreprise + statut sont les requêtes les plus fréquentes |
| 17 | `onDelete` explicite sur toutes les relations optionnelles | Comportement de suppression voulu, pas subi |

## Ce qui n'est PAS dans le schéma (volontairement)

- **Anti-doublon chantier / facture d'acompte à la signature** : garanti à l'étape 7 par une
  *transition conditionnelle* (`UPDATE devis SET statut = 'SIGNE' WHERE id = ? AND statut = 'ACCEPTE'`)
  dans la même transaction. Un 2e clic trouve le devis déjà `SIGNE` et n'exécute rien.
  L'ancien index SQL partiel n'est pas représentable dans `schema.prisma`, et Prisma risquerait
  de le supprimer lors d'une future migration.
- **Transitions de statut** : contrôlées par `WorkflowStateService` (étape 7), pas par la base.
- `MessageChat.role`, `AssistantFeedback.rating`, `DemoRequest.source` restent en texte
  jusqu'à la revue du module IA (étape 14).

## Ajouts de l'étape 4

| Champ | Rôle |
|---|---|
| `Company.acomptePercentDefault` (défaut 35) | Taux d'acompte appliqué à la signature (P0.3), modifiable par entreprise |
| `User.tokenVersion` | Inclus dans chaque JWT ; incrémenté au changement / à la réinitialisation du mot de passe → toutes les anciennes sessions deviennent invalides |
| `User.resetCodeAttempts` | Le code de réinitialisation est détruit après 5 essais erronés |
| `User.lastLoginAt` | Date de dernière connexion (liste des utilisateurs) |

## Ajouts de l'étape 5

| Changement | Pourquoi |
|---|---|
| `Company.margeCiblePourcent`, `seuilAlerteMargePourcent`, `fraisFixeDeplacement`, `pasArrondiPrix` | L'ancien code stockait ces réglages comme des lignes d'`AuditLog` et relisait « la dernière ». Ce sont maintenant de vraies colonnes. |
| `Client.archivedAt` | L'ancienne suppression d'un client effaçait en cascade ses devis, **factures (même payées)**, commandes et chantiers. On archive désormais ; la suppression définitive n'est possible que pour un client sans historique. |
| `Client.typeProjetId` supprimé | Doublon de la table de liaison `ClientTypeProjet` (deux sources de vérité, fusionnées à chaque lecture). |

## Ajouts de l'étape 6

| Changement | Pourquoi |
|---|---|
| `DevisLienClient` remplace `DevisClientSignatureRequest` | Un seul mécanisme pour les liens envoyés au client (validation ET signature). Le lien de validation était un JWT de 30 jours **non révocable** : après une révision, l'ancien lien permettait d'accepter un devis que le client n'avait pas vu. Le lien est maintenant lié à une version et annulé à la révision. Seul le hash du jeton est stocké. |
| `LigneDevis.optionsChoisies` (JSON) | Les choix d'options étaient écrits dans la description (« (Type de chape: Chape fibrée) ») puis relus par découpage de texte pour générer les commandes fournisseur. |
| `Devis.motifRefus` | Motif saisi par le client lorsqu'il refuse. |

## Ajouts des étapes 7 à 9

| Changement | Pourquoi |
|---|---|
| `Facture.reference` attribuée à l'**émission** (nullable en brouillon) | Les brouillons consommaient des numéros : la numérotation des factures émises n'était pas continue. |
| `FactureType.SITUATION` + `numeroSituation`, `avancementCumule` | Situations de travaux (liste MUST). |
| `FactureType.AVOIR` + `factureOrigineId` | Une facture émise ne se supprime ni ne se modifie : on l'annule par un avoir. |
| `LigneCommandeFournisseur.materiauId`, `quantiteRecue` | Les lignes ne contenaient que le **nom** du matériau : une réception ne pouvait pas mettre le stock à jour. |
| `Reception` + `ReceptionLigne` | Réception ligne par ligne (livraisons partielles), chacune met le stock à jour. |
| `MouvementStock.chantierId` | Consommation de matériaux par chantier. |
| `ChantierStatut` : PLANIFIE, EN_COURS, SUSPENDU, TERMINE, CLOTURE, ANNULE | L'ancien mélangeait les phases commerciales (devis) et d'approvisionnement (commandes) avec l'exécution. |
| `CommandeFournisseurStatut.ANNULEE` | Une commande pouvait être créée mais jamais annulée. |

## Ajouts de l'étape 10

| Changement | Pourquoi |
|---|---|
| Modèle `Notification` (une ligne par destinataire, `lueAt`) | Les notifications étaient des lignes d'`AuditLog` : pas d'état « lu » par utilisateur, et l'historique d'audit était pollué. `AuditLog` ne sert plus qu'à l'audit. |

## Ajouts de l'étape 11 (portails)

| Changement | Pourquoi |
|---|---|
| Modèle `Fichier` (clé de stockage, nom, type, taille ; rattaché à un chantier ou à un rapport) | L'ancien projet écrivait les fichiers dans le dépôt / en base64. Les octets sont dans `STORAGE_DIR`, la base ne garde que les métadonnées, et chaque lecture est contrôlée. |
| `DocumentChantier.url` facultatif + `fichierId` | Un document est soit un lien externe, soit un fichier déposé. |
| `AssuranceSousTraitant.fichierId` | L'attestation peut être déposée (PDF / photo). |
| Modèle `RapportChantier` + enum `RapportStatut` (SOUMIS, VALIDE, REJETE) | Rapports du sous-traitant (texte + photos) ; l'avancement déclaré n'est appliqué à la tâche qu'à la validation. |
| Modèle `ClientEspaceLien` (hash du jeton, expiration, révocation, dernière visite) | Espace client par lien, comme les liens de devis de l'ancien projet (pas de compte client). |
| `SavTicket.createurId` facultatif + `origine` (INTERNE, ESPACE_CLIENT) ; `SavTicketNote.userId` facultatif | Un client peut ouvrir un ticket et écrire depuis son espace sans compte utilisateur. |
| `CommandeFournisseur.dateAccuseReception`, `commentaireFournisseur` | Le fournisseur confirme la commande et annonce sa date depuis son portail. |

Migration : `pnpm db:migrate --name step11-portails`.

## Ajouts de l'étape 14 (assistant IA)

| Changement | Pourquoi |
|---|---|
| `ChatSession` : `tokenHash`, `statut` (enum `ProspectStatut`), coordonnées et besoin en colonnes, `clientId`, `doublonDeId`, `demandeDevisId`, traitement (`traiteParId`, `traiteLe`, `motifRejet`, `notesInternes`) | Une conversation = un prospect qualifiable. L'ancien chatbot acceptait un `companyId` et un `sessionId` venant du navigateur : n'importe qui pouvait lire ou poursuivre la conversation d'un autre. |
| `AssistantErreur` | Journal des erreurs IA et des réponses bloquées (spec P4). |
| `AssistantFeedback.commentaire` | Retour libre du visiteur. |
| `DemandeDevis.chatSession` (relation inverse) | Retrouver la conversation d'origine d'une demande. |

Migration : `pnpm db:migrate --name step14-assistant`. Si la table `chat_sessions` contient déjà des
lignes (ancien chatbot de test), videz-la avant : `tokenHash` est obligatoire.

