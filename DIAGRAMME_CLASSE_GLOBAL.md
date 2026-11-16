# Diagramme De Classe Global

Ce diagramme est basé sur les entités du schéma Prisma et sur les opérations métier exposées par les services NestJS.

Sources principales :
- `backend/prisma/schema.prisma`
- `backend/src/auth/auth.service.ts`
- `backend/src/clients/clients.service.ts`
- `backend/src/demandes-devis/demandes-devis.service.ts`
- `backend/src/prestations/prestations.service.ts`
- `backend/src/devis/devis.service.ts`
- `backend/src/factures/factures.service.ts`
- `backend/src/chantiers/chantiers.service.ts`
- `backend/src/fournisseurs/fournisseurs.service.ts`
- `backend/src/commandes-fournisseur/commandes-fournisseur.service.ts`
- `backend/src/types-projet/types-projet.service.ts`

```mermaid
classDiagram
direction LR

namespace "CRM & Referentiel" {
  class Company {
    +id: Int
    +nom: String
    +siret: String
    +tvaDefaut: Float
    +devise: String
    +configurerTVA()
    +configurerDevise()
  }

  class User {
    +id: Int
    +companyId: Int
    +nom: String
    +prenom: String
    +email: String
    +role: Role
    +actif: Boolean
    +createUser()
    +login()
    +changePassword()
    +saveSignature()
  }

  class TypeProjet {
    +id: Int
    +companyId: Int
    +nom: String
    +description: String
    +actif: Boolean
    +create()
    +findAll()
    +update()
    +remove()
  }

  class Client {
    +id: Int
    +companyId: Int
    +nom: String
    +prenom: String
    +telephone: String
    +email: String
    +adresseClient: String
    +adresseChantier: String
    +source: LeadSource
    +create()
    +findAll()
    +findOne()
    +update()
    +remove()
  }

  class ClientTypeProjet {
    +clientId: Int
    +typeProjetId: Int
    +createdAt: DateTime
  }

  class DemandeDevis {
    +id: Int
    +companyId: Int
    +clientId: Int
    +createurId: Int
    +date: DateTime
    +description: String
    +statut: DemandeStatut
    +create()
    +findAll()
    +findOne()
    +update()
    +updateStatut()
    +remove()
  }
}

namespace "Catalogue & Chiffrage" {
  class CategoriePrestation {
    +id: Int
    +companyId: Int
    +nom: String
    +description: String
    +actif: Boolean
    +createCategorie()
    +findAllCategories()
    +updateCategorie()
    +deleteCategorie()
  }

  class SousCategorie {
    +id: Int
    +categorieId: Int
    +nom: String
    +description: String
    +actif: Boolean
    +createSousCategorie()
    +findAllSousCategories()
    +updateSousCategorie()
    +deleteSousCategorie()
  }

  class TypeProjetCategorie {
    +typeProjetId: Int
    +categorieId: Int
    +ordre: Int
    +createdAt: DateTime
  }

  class Prestation {
    +id: Int
    +companyId: Int
    +categorieId: Int
    +sousCategorieId: Int
    +nom: String
    +unite: Unite
    +prixVenteMin: Float
    +prixVenteMax: Float
    +actif: Boolean
    +createPrestation()
    +findAllPrestations()
    +findOnePrestation()
    +updatePrestation()
    +deletePrestation()
    +chiffrage()
  }

  class OptionPrestation {
    +id: Int
    +prestationId: Int
    +nom: String
    +obligatoire: Boolean
    +ordre: Int
    +createOptionPrestation()
    +findOptionsByPrestation()
    +updateOptionPrestation()
    +deleteOptionPrestation()
  }

  class ChoixOption {
    +id: Int
    +optionId: Int
    +nom: String
    +impactPrix: Float
    +actif: Boolean
    +ordre: Int
    +addChoixToOption()
    +updateChoixOption()
    +deleteChoixOption()
  }

  class PrestationComposition {
    +id: Int
    +prestationId: Int
    +materiauId: Int
    +serviceMainOeuvreId: Int
    +quantiteParUnite: Float
    +createPrestationComposition()
    +updatePrestationComposition()
    +deletePrestationComposition()
  }

  class ChoixOptionComposition {
    +id: Int
    +choixOptionId: Int
    +materiauId: Int
    +serviceMainOeuvreId: Int
    +quantiteParUnite: Float
  }

  class Materiau {
    +id: Int
    +companyId: Int
    +nom: String
    +unite: Unite
    +prixAchatFixe: Float
    +fournisseurId: Int
    +actif: Boolean
    +create()
    +findAll()
    +findOne()
    +update()
    +delete()
  }

  class ServiceMainOeuvre {
    +id: Int
    +companyId: Int
    +nom: String
    +unite: Unite
    +prixUnitaire: Float
    +productiviteJour: Float
    +actif: Boolean
    +create()
    +findAll()
    +findOne()
    +update()
    +delete()
  }
}

namespace "Vente & Facturation" {
  class Devis {
    +id: Int
    +companyId: Int
    +clientId: Int
    +chantierId: Int
    +demandeDevisId: Int
    +reference: String
    +statut: DevisStatut
    +versionCourante: Int
    +totalHT: Float
    +totalTTC: Float
    +tauxTVA: Float
    +create()
    +findAll()
    +findOne()
    +update()
    +updateStatut()
    +sendToClient()
    +addLigne()
    +updateLigne()
    +removeLigne()
  }

  class LigneDevis {
    +id: Int
    +devisId: Int
    +prestationId: Int
    +materiauId: Int
    +serviceMainOeuvreId: Int
    +quantite: Float
    +unite: Unite
    +prixUnitaireVente: Float
    +prixAchat: Float
    +mainOeuvre: Float
    +totalHT: Float
  }

  class DevisClientSignatureRequest {
    +id: Int
    +devisId: Int
    +token: String
    +telephoneClient: String
    +statut: DevisClientSignatureStatut
    +expiresAt: DateTime
    +sendClientSignatureRequest()
    +sendPublicSignatureOtp()
    +verifyPublicSignatureOtp()
    +submitPublicClientSignature()
  }

  class VersionDevis {
    +id: Int
    +devisId: Int
    +auteurId: Int
    +numeroVersion: Int
    +snapshotLignes: Json
    +totalHT: Float
    +totalTTC: Float
  }

  class Facture {
    +id: Int
    +devisId: Int
    +reference: String
    +date: DateTime
    +montantHT: Float
    +montantTTC: Float
    +statut: FactureStatut
    +typeFacture: FactureType
    +createFromDevis()
    +findAll()
    +findOne()
    +update()
    +addLigne()
    +updateLigne()
    +removeLigne()
    +updateStatut()
    +sendToClient()
  }

  class FactureLigne {
    +id: Int
    +factureId: Int
    +description: String
    +quantite: Float
    +prixUnitaireHT: Float
    +montantHT: Float
    +montantTVA: Float
    +montantTTC: Float
  }

  class BonCommande {
    +id: Int
    +devisId: Int
    +reference: String
    +date: DateTime
    +statut: BonCommandeStatut
    +validateBonCommandeAndSend()
  }
}

namespace "Execution & Approvisionnement" {
  class Fournisseur {
    +id: Int
    +companyId: Int
    +nom: String
    +contact: String
    +email: String
    +telephone: String
    +delaiLivraison: Int
    +actif: Boolean
    +create()
    +findAll()
    +findOne()
    +update()
    +delete()
  }

  class CommandeFournisseur {
    +id: Int
    +devisId: Int
    +fournisseurId: Int
    +reference: String
    +date: DateTime
    +statutLivraison: CommandeFournisseurStatut
    +dateLivraisonPrevue: DateTime
    +findAll()
    +findOne()
    +update()
    +send()
    +createReception()
  }

  class LigneCommandeFournisseur {
    +id: Int
    +commandeFournisseurId: Int
    +materiauNom: String
    +quantite: Float
    +prixUnitaire: Float
    +totalHT: Float
  }

  class Reception {
    +id: Int
    +commandeFournisseurId: Int
    +dateReception: DateTime
    +quantiteRecue: Float
    +quantiteAttendue: Float
    +partielle: Boolean
  }

  class Chantier {
    +id: Int
    +companyId: Int
    +clientId: Int
    +chefChantierId: Int
    +reference: String
    +adresse: String
    +statut: ChantierStatut
    +dateDebut: DateTime
    +dateFin: DateTime
    +syncFromAcceptedDevis()
    +findAll()
    +findOne()
    +create()
    +update()
    +listTasks()
  }

  class Tache {
    +id: Int
    +chantierId: Int
    +libelle: String
    +statut: TacheStatut
    +dateDebut: DateTime
    +dateFin: DateTime
    +avancement: Float
    +ordre: Int
    +createTask()
    +updateTask()
    +removeTask()
  }

  class AffectationTache {
    +id: Int
    +tacheId: Int
    +userId: Int
    +equipeId: Int
    +createdAt: DateTime
    +affecterSousTraitant()
    +affecterEquipe()
  }

  class Equipe {
    +id: Int
    +companyId: Int
    +nom: String
    +type: EquipeType
    +actif: Boolean
  }

  class DocumentChantier {
    +id: Int
    +chantierId: Int
    +nom: String
    +type: String
    +url: String
  }
}

Company "1" --> "0..*" User : possede
Company "1" --> "0..*" Client : gere
Company "1" --> "0..*" TypeProjet : definit
Company "1" --> "0..*" CategoriePrestation : catalogue
Company "1" --> "0..*" Materiau : stocke
Company "1" --> "0..*" ServiceMainOeuvre : tarifie
Company "1" --> "0..*" Fournisseur : reference
Company "1" --> "0..*" Devis : produit
Company "1" --> "0..*" Chantier : pilote

Client "1" --> "0..*" DemandeDevis : formule
User "0..1" --> "0..*" DemandeDevis : cree
Client "1" --> "0..*" Devis : recoit
DemandeDevis "1" --> "0..*" Devis : convertit en
Client "1" --> "0..*" Chantier : commande
User "0..1" --> "0..*" Chantier : chef de chantier

Client "1" --> "0..*" ClientTypeProjet
TypeProjet "1" --> "0..*" ClientTypeProjet
TypeProjet "1" --> "0..*" TypeProjetCategorie
CategoriePrestation "1" --> "0..*" TypeProjetCategorie

CategoriePrestation "1" --> "0..*" SousCategorie
CategoriePrestation "1" --> "0..*" Prestation
SousCategorie "0..1" --> "0..*" Prestation
Prestation "1" --> "0..*" OptionPrestation
OptionPrestation "1" --> "1..*" ChoixOption
Prestation "1" --> "0..*" PrestationComposition
ChoixOption "1" --> "0..*" ChoixOptionComposition
Materiau "1" --> "0..*" PrestationComposition
ServiceMainOeuvre "1" --> "0..*" PrestationComposition
Materiau "1" --> "0..*" ChoixOptionComposition
ServiceMainOeuvre "1" --> "0..*" ChoixOptionComposition

Devis "1" *-- "1..*" LigneDevis
LigneDevis "0..1" --> "1" Prestation
LigneDevis "0..1" --> "1" Materiau
LigneDevis "0..1" --> "1" ServiceMainOeuvre
Devis "1" --> "0..*" DevisClientSignatureRequest
Devis "1" --> "0..*" VersionDevis
User "0..1" --> "0..*" VersionDevis : auteur
Devis "1" --> "0..*" Facture
Facture "1" *-- "1..*" FactureLigne
Devis "1" --> "0..1" BonCommande

Fournisseur "1" --> "0..*" Materiau
Devis "1" --> "0..*" CommandeFournisseur
Fournisseur "1" --> "0..*" CommandeFournisseur
CommandeFournisseur "1" *-- "1..*" LigneCommandeFournisseur
CommandeFournisseur "1" --> "0..*" Reception

Chantier "1" --> "0..*" Devis
Chantier "1" --> "0..*" Tache
Tache "1" --> "0..*" AffectationTache
AffectationTache "0..1" --> "1" User : sous-traitant
AffectationTache "0..1" --> "1" Equipe : equipe interne
Chantier "1" --> "0..*" DocumentChantier
```

## Lecture rapide

- Le noyau CRM est : `Company`, `User`, `Client`, `TypeProjet`, `DemandeDevis`.
- Le noyau de chiffrage est : `CategoriePrestation`, `SousCategorie`, `Prestation`, `OptionPrestation`, `ChoixOption`, `Materiau`, `ServiceMainOeuvre`.
- Le noyau commercial est : `Devis`, `LigneDevis`, `DevisClientSignatureRequest`, `VersionDevis`, `Facture`.
- Le noyau execution est : `Chantier`, `Tache`, `AffectationTache`, `CommandeFournisseur`, `Reception`.

## Remarque

Les classes `ChatSession`, `MessageChat` et `AuditLog` existent bien dans le schéma, mais elles ont été laissées hors de ce diagramme global pour garder une vue claire du flux métier principal.
