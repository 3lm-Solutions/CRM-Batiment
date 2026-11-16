# 📚 BACKEND BIEN ORGANISÉ - Structure Modulaire

## 🎯 Principes d'Organisation

### Modularité
Chaque domaine métier a son propre module avec:
- Services (logique métier)
- Controllers (API REST)
- DTOs (validation des données)
- Entités (Prisma models)

### Séparation des Responsabilités
```
┌─────────────────────────────────────┐
│         HTTP REQUESTS               │
└────────────┬────────────────────────┘
             │
        ┌────▼───────┐
        │ Controllers │  (Routing + Validation)
        └────┬───────┘
             │
        ┌────▼──────┐
        │ Services   │  (Logique métier)
        └────┬──────┘
             │
        ┌────▼─────┐
        │ Prisma    │  (Accès DB)
        └───────────┘
```

## 📁 Structure des Dossiers

```
src/
├── modules/
│   ├── catalogue/
│   │   ├── catalogue.module.ts          # Imports & exports
│   │   ├── controllers/
│   │   │   ├── catalogue.controller.ts  # Catégories
│   │   │   ├── material.controller.ts   # Matériaux
│   │   │   ├── service-mo.controller.ts # Services MO
│   │   │   └── prestation.controller.ts # Prestations
│   │   ├── services/
│   │   │   ├── catalogue.service.ts     # Orchestre catégories
│   │   │   ├── material.service.ts      # Logique matériaux
│   │   │   ├── service-mo.service.ts    # Logique services MO
│   │   │   └── prestation.service.ts    # Logique prestations
│   │   └── dto/
│   │       ├── catalogue.dto.ts
│   │       ├── materiau.dto.ts
│   │       ├── service-mo.dto.ts
│   │       └── prestation.dto.ts
│   │
│   ├── pricing/                         # À venir
│   │   ├── pricing.module.ts
│   │   ├── services/
│   │   │   └── price-calculator.service.ts
│   │   └── dto/
│   │
│   ├── diagnostic/                      # À venir
│   │   ├── diagnostic.module.ts
│   │   ├── services/
│   │   │   └── diagnostic-session.service.ts
│   │   └── dto/
│   │
│   ├── devis/                           # À venir
│   │   ├── devis.module.ts
│   │   ├── services/
│   │   │   └── devis.service.ts
│   │   └── dto/
│   │
│   └── shared/
│       ├── prisma/
│       │   ├── prisma.module.ts
│       │   └── prisma.service.ts
│       ├── decorators/
│       ├── guards/
│       └── interfaces/
│
├── app.module.ts                        # Import tous les modules
└── main.ts
```

## 🔌 CATALOGUE MODULE - Introduction

### Qu'est-ce que c'est?

Le module Catalogue gère **toute la bibliothèque de prix** de l'entreprise:
- **Matériaux** (couleur, finition, fournisseur, prix d'achat)
- **Services Main d'Oeuvre** (prix unitaire, productivité)
- **Prestations** (assemblage de matériaux + services + options)
- **Options** (finitions, variantes, surcoûts)
- **Infos Requises** (mesures, photos, observations)

### Architecture du Module

```
┌─────────────────────────────────────────────────────────────┐
│                   CATALOGUE MODULE                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  API Endpoints (Controllers)                               │
│  ├─ /catalogue (Catégories)                               │
│  ├─ /catalogue/materiaux (Matériaux)                       │
│  ├─ /catalogue/services-mo (Services)                      │
│  └─ /catalogue/prestations (Prestations)                   │
│                                                             │
│  ⬇️ Routes vers Services                                    │
│                                                             │
│  Services (Logique Métier)                                 │
│  ├─ CatalogueService (Catégories + Vue d'ensemble)        │
│  ├─ MaterialService (CRUD + Filtres + Prix)               │
│  ├─ ServiceMoService (CRUD + Calculs MO)                  │
│  └─ PrestationService (CRUD + Compositions + Options)      │
│                                                             │
│  ⬇️ Prisma ORM                                              │
│                                                             │
│  Database (PostgreSQL)                                     │
│  ├─ materiaux (détails: couleur, finition, fournisseur)   │
│  ├─ services_main_oeuvre (prix, productivité dayum)       │
│  ├─ prestations (prix min/max, unité)                     │
│  ├─ prestations_compositions (pivot table)                │
│  ├─ options_prestations (variantes)                       │
│  ├─ choix_options (choix spécifiques)                     │
│  ├─ choix_options_compositions (détails options)          │
│  ├─ infos_requises (mesures, photos)                      │
│  └─ valeurs_infos_requises (données remplies)             │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## 🎁 Fonctionnalités par Service

### 1. CatalogueService (Orchestration)
```typescriptS
// Catégories
createCategorie(companyId, dto)      // Créer catégorie
findAllCategories(companyId)         // Lister toutes
getCategorieComplete(id, companyId)  // Vue complète

// Sous-catégories
createSousCategorie(companyId, dto)

// Vue d'ensemble
getCatalogueComplet(companyId)       // Vue globale
searchCatalogue(companyId, query)    // Recherche
```

### 2. MaterialService (Matériaux & Détails)
```typescript
// CRUD
create(companyId, dto)               // Créer matériau
findAll(companyId, query)            // Lister avec filtres
findOne(id, companyId)               // Détail unique
update(id, companyId, dto)           // Modifier
deactivate(id, companyId)            // Soft delete

// Prix & Données
updatePrice(id, companyId, newPrice) // Mettre à jour coût
getPrixAchatEstime(id, quantite)     // Estimer coût

// Relations
getMateriauxByPrestation(prestId)    // Matériaux liés à prestation
```

**Détails gérés:** couleur, finition, fournisseur, prix d'achat, date MàJ

### 3. ServiceMoService (Main d'Oeuvre)
```typescript
// CRUD
create(companyId, dto)               // Créer service
findAll(companyId, query)            // Lister
findOne(id, companyId)               // Détail
update(id, companyId, dto)           // Modifier
deactivate(id, companyId)            // Désactiver

// Calculs
calculateMoPrice(serviceId, quantite) // Coût total
// Deux méthodes:
// - Par productivité: (quantite / m² par jour) × coût journalier
// - Par prix unitaire: quantite × prix unitaire

// Relations
getServicesByPrestation(prestId)     // Services liés
```

**Détails gérés:** prix unitaire, productivité (m²/jour), coût journalier

### 4. PrestationService (Assemblage Complet)
```typescript
// CRUD
create(companyId, dto)               // Créer prestation
findAll(companyId, query)            // Lister
findOneComplete(id, companyId)       // Vue COMPLÈTE (voir ci-dessous)
update(id, companyId, dto)           // Modifier
deactivate(id, companyId)            // Soft delete

// COMPOSITIONS (Matériaux + Services)
addComposition(prestId, companyId, dto)
// Relie un matériau OU service à la prestation avec quantité

// OPTIONS (Finitions, Variantes)
addOption(prestId, companyId, dto)
// Crée une option (ex: "Finition")
// Puis ajouter des choix

// CHOIX D'OPTIONS
addChoixOption(optionId, companyId, dto)
// Crée un choix (ex: "Finition brillante" +50€)
// Avec son propre impact prix ET compositions

// INFOS REQUISES (Mesures, Photos)
addInfoRequise(prestId, companyId, dto)
// Ex: "Surface" (MESURE, m²)
// Ex: "Photo état actuel" (PHOTO)
// Ex: "Observations technicien" (OBSERVATION)
```

**Détails gérés:** Prix min/max, compositions détaillées, options multiples, infos requises

## 📊 Exemple Complet : "Pose Luminaire"

### Prestation créée:
```json
{
  "id": 1,
  "nom": "Pose Luminaire",
  "categorieId": 2,
  "sousCategorieId": 5,
  "unite": "M2",
  "prixVenteMin": 80,
  "prixVenteMax": 150
}
```

### Compositions (Base):
```
Composition 1: Luminaire LED 50W
  - Material ID: 45 (LED 50W)
  - Quantité par m²: 0.5 (1 luminaire pour 2m²)
  - Prix achat: 15€ × 0.5 = 7.5€/m²

Composition 2: Câblage électrique
  - Material ID: 67 (Câble 2.5mm)
  - Quantité par m²: 1.2 (surcoût 20%)
  - Prix achat: 2€ × 1.2 = 2.4€/m²

Composition 3: Main d'oeuvre
  - Service ID: 12 (Électricien)
  - Productivité: 25 m²/jour
  - Coût journalier: 200€
  - Coût par m²: 200 ÷ 25 = 8€/m²
```

### Options:
```
Option 1: Finition du luminaire
  ├─ Choix 1: Standard (0€ surcoût)
  │   └─ Pas de matériau/service supplémentaire
  │
  └─ Choix 2: Finition chromée (+30€)
      └─ Compositions:
         - Traitement chrome: 10€ prix achat
         - MO finition: 5€ (service 20 minutes)

Option 2: Installation garantie
  ├─ Choix 1: Non (+0€)
  └─ Choix 2: Oui, 2 ans (+50€)
      └─ Composition:
         - Service garantie: 50€ forfait
```

### Infos Requises:
```
Info 1: Surface (MESURE, m²)
  - Obligatoire: oui
  - Aide: "Mesurer la surface totale à illuminer"

Info 2: Hauteur sous plafond (MESURE, m)
  - Obligatoire: oui
  - Aide: "Pour calculer câblage nécessaire"

Info 3: Photo état actuel (PHOTO)
  - Obligatoire: non
  - Aide: "Upload une photo de l'installation existante"

Info 4: Observations (OBSERVATION)
  - Obligatoire: non
  - Aide: "Notes supplémentaires du technicien"
```

### Vue Complète via API:
```
GET /catalogue/prestations/1/complete

Retourne:
{
  "prestation": { ... },
  "compositions": [
    {
      "materiau": { id: 45, nom: "LED 50W", couleur: "Blanc", ... },
      "quantiteParUnite": 0.5
    },
    ...
  ],
  "options": [
    {
      "nom": "Finition du luminaire",
      "obligatoire": false,
      "choix": [
        {
          "nom": "Standard",
          "impactPrix": 0,
          "compositions": []  // Aucune
        },
        {
          "nom": "Finition chromée",
          "impactPrix": 30,
          "compositions": [
            { "materiau": {...}, "quantite": ... },
            { "serviceMainOeuvre": {...}, ... }
          ]
        }
      ]
    },
    ...
  ],
  "infosRequises": [
    {
      "nom": "Surface",
      "typeInfo": "MESURE",
      "unite": "m²",
      "obligatoire": true
    },
    ...
  ]
}
```

## 🔄 Flux de Données Typique

```
1. ADMIN crée le catalogue
   POST /catalogue/categories
   → CategoriePrestation créée

2. ADMIN ajoute une under-catégorie
   POST /catalogue/sous-categories
   → SousCategorie créée

3. ADMIN crée une prestation
   POST /catalogue/prestations
   → Prestation créée

4. ADMIN ajoute compositions
   POST /catalogue/prestations/1/compositions
   → PrestationComposition créée
   (lie matériau + service à prestation)

5. ADMIN crée une option
   POST /catalogue/prestations/1/options
   → OptionPrestation créée

6. ADMIN ajoute des choix
   POST /catalogue/prestations/options/1/choix
   → ChoixOption créée

7. ADMIN ajoute infos requises
   POST /catalogue/prestations/1/infos-requises
   → InfoRequise créée

8. TECHNICIEN charge la prestation complète
   GET /catalogue/prestations/1/complete
   → Retour COMPLET avec tous les détails

9. SYSTÈME utilise pour devis auto
   PriceCalculatorService.calculatePrice(1, selections)
   → Calcule le prix final basé sur:
      - Compositions de base
      - Options choisies (leurs compositions)
      - Quantités
      - Marges appliquées
```

## ✅ Points Clés

✅ **Matériaux** = gestion complète des coûts d'achat
✅ **Services** = calcul smart de MO (productivité ou prix fixe)
✅ **Prestations** = assemblage logique de matériaux + services
✅ **Options** = variantes avec surcoûts et compositions propres
✅ **Infos** = données requises pour budgéter correctement
✅ **Vue Complète** = une seule requête pour tous les détails

## 🚀 Prochains Modules

- **PRICING** - PriceCalculatorService
- **DIAGNOSTIC** - Sessions + Questions + Réponses
- **DEVIS** - Génération auto + Versioning
