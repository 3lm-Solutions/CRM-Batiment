# 🔌 API CATALOGUE - Guide d'Utilisation Complet

## Base URL
```
http://localhost:3000/api
```

## Headers Requis
```
Authorization: Bearer {JWT_TOKEN}
Content-Type: application/json
```

---

## 📂 CATÉGORIES DE PRESTATIONS

### 1️⃣ Créer une catégorie
```http
POST /catalogue/categories
Content-Type: application/json

{
  "nom": "Chauffage et Climatisation",
  "description": "Tous les services de chauffage et clim"
}

✓ Response 201:
{
  "id": 1,
  "companyId": 1,
  "nom": "Chauffage et Climatisation",
  "description": "Tous les services de chauffage et clim",
  "actif": true,
  "createdAt": "2026-03-14T10:00:00Z",
  "updatedAt": "2026-03-14T10:00:00Z"
}
```

### 2️⃣ Lister les catégories
```http
GET /catalogue/categories

✓ Response 200:
[
  {
    "id": 1,
    "nom": "Chauffage et Climatisation",
    "prestations": [
      { "id": 1, "nom": "Pose Radiateur" },
      { "id": 2, "nom": "Maintenance Climatiseur" }
    ],
    "sousCategories": [
      { "id": 1, "nom": "Radiateurs" },
      { "id": 2, "nom": "Climatiseurs" }
    ]
  }
]
```

### 3️⃣ Obtenir une catégorie complète
```http
GET /catalogue/categories/1

✓ Response 200:
{
  "id": 1,
  "nom": "Chauffage et Climatisation",
  "prestations": [
    {
      "id": 1,
      "nom": "Pose Radiateur",
      "compositions": [
        {
          "id": 1,
          "materiau": {
            "id": 5,
            "nom": "Radiateur fonte 2000W",
            "couleur": "Blanc",
            "prixAchatFixe": 150
          },
          "quantiteParUnite": 1
        }
      ],
      "options": [
        {
          "id": 1,
          "nom": "Thermostat",
          "choix": [
            {
              "id": 1,
              "nom": "Mécanique",
              "impactPrix": 0
            },
            {
              "id": 2,
              "nom": "Électronique",
              "impactPrix": 80
            }
          ]
        }
      ],
      "infosRequises": [
        {
          "id": 1,
          "nom": "Surface à chauffer",
          "typeInfo": "MESURE",
          "unite": "m²",
          "obligatoire": true
        }
      ]
    }
  ]
}
```

### 4️⃣ Mettre à jour une catégorie
```http
PUT /catalogue/categories/1
Content-Type: application/json

{
  "nom": "Chauffage, Eau Chaude et Climatisation",
  "actif": true
}

✓ Response 200: {catégorie mise à jour}
```

---

## 🧱 MATÉRIAUX

### 1️⃣ Créer un matériau
```http
POST /catalogue/materiaux
Content-Type: application/json

{
  "nom": "Radiateur fonte",
  "couleur": "Blanc",
  "finition": "Brillant",
  "unite": "PIECE",
  "prixAchatFixe": 150,
  "fournisseurId": 3
}

✓ Response 201:
{
  "id": 5,
  "companyId": 1,
  "nom": "Radiateur fonte",
  "couleur": "Blanc",
  "finition": "Brillant",
  "prixAchatFixe": 150,
  "dateMaj": "2026-03-14T10:00:00Z",
  "actif": true
}
```

### 2️⃣ Lister les matériaux avec filtres
```http
GET /catalogue/materiaux?couleur=Blanc&finition=Brillant&limit=50&offset=0

✓ Response 200:
[
  {
    "id": 5,
    "nom": "Radiateur fonte",
    "couleur": "Blanc",
    "finition": "Brillant",
    "prixAchatFixe": 150
  },
  {
    "id": 6,
    "nom": "Radiateur acier",
    "couleur": "Blanc",
    "finition": "Brillant",
    "prixAchatFixe": 120
  }
]
```

### 3️⃣ Obtenir un matériau
```http
GET /catalogue/materiaux/5

✓ Response 200:
{
  "id": 5,
  "nom": "Radiateur fonte",
  "couleur": "Blanc",
  "prixAchatFixe": 150,
  "fournisseur": { "id": 3, "nom": "Radiateurs plus" }
}
```

### 4️⃣ Mettre à jour le prix d'achat
```http
PUT /catalogue/materiaux/5/prix
Content-Type: application/json

{
  "prix": 145
}

✓ Response 200:
{
  "id": 5,
  "prixAchatFixe": 145,
  "dateMaj": "2026-03-14T11:00:00Z"
}
```

### 5️⃣ Calculer prix estimé
```http
GET /catalogue/materiaux/5/prix-estime?quantite=10

✓ Response 200:
{
  "prixUnitaire": 145,
  "total": 1450  // 145 × 10
}
```

### 6️⃣ Désactiver un matériau
```http
DELETE /catalogue/materiaux/5

✓ Response 200:
{
  "id": 5,
  "actif": false,
  "updatedAt": "2026-03-14T11:30:00Z"
}
```

---

## 🛠️ SERVICES MAIN D'OEUVRE

### 1️⃣ Créer un service
```http
POST /catalogue/services-mo
Content-Type: application/json

{
  "nom": "Pose radiateur - Chauffagiste",
  "unite": "M2",
  "prixUnitaire": 50,
  "productiviteJour": 10,  // 10 m² par jour
  "coutJournalier": 280    // Salaire + charges
}

✓ Response 201:
{
  "id": 12,
  "companyId": 1,
  "nom": "Pose radiateur - Chauffagiste",
  "prixUnitaire": 50,
  "productiviteJour": 10,
  "coutJournalier": 280,
  "actif": true
}
```

### 2️⃣ Lister les services
```http
GET /catalogue/services-mo?actif=true&limit=50

✓ Response 200:
[
  {
    "id": 12,
    "nom": "Pose radiateur - Chauffagiste",
    "prixUnitaire": 50,
    "productiviteJour": 10
  },
  {
    "id": 13,
    "nom": "Tuyauterie - Chauffagiste",
    "prixUnitaire": 40,
    "productiviteJour": 15
  }
]
```

### 3️⃣ Calculer coût main d'oeuvre
```http
GET /catalogue/services-mo/12/prix?quantite=25

✓ Response 200:
{
  "prixUnitaire": 28,  // 280 (coût jour) / 10 (productivité)
  "total": 700,        // 28 × 25 m²
  "methode": "Par productivité"
}

// Alternative sans productivité:
{
  "prixUnitaire": 50,
  "total": 1250,       // 50 × 25
  "methode": "Prix unitaire"
}
```

### 4️⃣ Mettre à jour un service
```http
PUT /catalogue/services-mo/12
Content-Type: application/json

{
  "productiviteJour": 12,
  "coutJournalier": 300
}

✓ Response 200: {service mis à jour}
```

---

## 🎁 PRESTATIONS (Assemblage Complet)

### 1️⃣ Créer une prestation
```http
POST /catalogue/prestations
Content-Type: application/json

{
  "nom": "Pose radiateur fonte 2000W",
  "categorieId": 1,
  "sousCategorieId": 5,
  "unite": "PIECE",
  "prixVenteMin": 400,
  "prixVenteMax": 650,
  "description": "Pose complète avec tuyauterie"
}

✓ Response 201:
{
  "id": 1,
  "nom": "Pose radiateur fonte 2000W",
  "prixVenteMin": 400,
  "prixVenteMax": 650,
  "actif": true
}
```

### 2️⃣ Ajouter composition (Matériau)
```http
POST /catalogue/prestations/1/compositions
Content-Type: application/json

{
  "materiauId": 5,
  "quantiteParUnite": 1.1  // 1 radiateur + 10% perte
}

✓ Response 201:
{
  "id": 1,
  "prestationId": 1,
  "materiau": {
    "id": 5,
    "nom": "Radiateur fonte",
    "couleur": "Blanc",
    "prixAchatFixe": 150
  },
  "quantiteParUnite": 1.1
}
```

### 3️⃣ Ajouter composition (Service)
```http
POST /catalogue/prestations/1/compositions
Content-Type: application/json

{
  "serviceMainOeuvreId": 12,
  "quantiteParUnite": 1  // 1 m² de pose
}

✓ Response 201:
{
  "id": 2,
  "prestationId": 1,
  "serviceMainOeuvre": {
    "id": 12,
    "nom": "Pose radiateur - Chauffagiste",
    "prixUnitaire": 50
  },
  "quantiteParUnite": 1
}
```

### 4️⃣ Ajouter une option
```http
POST /catalogue/prestations/1/options
Content-Type: application/json

{
  "nom": "Type Thermostat",
  "description": "Choix du type de thermostat",
  "obligatoire": false,
  "ordre": 1
}

✓ Response 201:
{
  "id": 10,
  "prestationId": 1,
  "nom": "Type Thermostat",
  "obligatoire": false,
  "ordre": 1
}
```

### 5️⃣ Ajouter choix à option
```http
POST /catalogue/prestations/options/10/choix
Content-Type: application/json

{
  "nom": "Thermostat électronique programmable",
  "impactPrix": 80,
  "ordre": 1
}

✓ Response 201:
{
  "id": 20,
  "optionId": 10,
  "nom": "Thermostat électronique programmable",
  "impactPrix": 80,
  "actif": true
}
```

### 6️⃣ Ajouter info requise
```http
POST /catalogue/prestations/1/infos-requises
Content-Type: application/json

{
  "nom": "Surface à chauffer",
  "typeInfo": "MESURE",
  "unite": "m²",
  "obligatoire": true,
  "aide": "Mesurer la surface totale du radiateur ou zone"
}

✓ Response 201:
{
  "id": 5,
  "prestationId": 1,
  "nom": "Surface à chauffer",
  "typeInfo": "MESURE",
  "unite": "m²",
  "obligatoire": true
}
```

### 7️⃣ Obtenir prestation complète ⭐
```http
GET /catalogue/prestations/1/complete

✓ Response 200:
{
  "prestation": {
    "id": 1,
    "nom": "Pose radiateur fonte 2000W",
    "prixVenteMin": 400,
    "prixVenteMax": 650
  },
  "compositions": [
    {
      "materiau": { id: 5, nom: "Radiateur fonte", prixAchatFixe: 150 },
      "quantiteParUnite": 1.1
    },
    {
      "serviceMainOeuvre": { id: 12, nom: "Pose radiateur", prixUnitaire: 50 },
      "quantiteParUnite": 1
    }
  ],
  "options": [
    {
      "id": 10,
      "nom": "Type Thermostat",
      "choix": [
        {
          "id": 20,
          "nom": "Thermostat standard",
          "impactPrix": 0,
          "compositions": []
        },
        {
          "id": 21,
          "nom": "Thermostat électronique programmable",
          "impactPrix": 80,
          "compositions": [...]
        }
      ]
    }
  ],
  "infosRequises": [
    {
      "id": 5,
      "nom": "Surface à chauffer",
      "typeInfo": "MESURE",
      "unite": "m²",
      "obligatoire": true
    }
  ]
}
```

---

## 🔍 RECHERCHE & VUES COMPLÈTES

### 1️⃣ Catalogue complet
```http
GET /catalogue

✓ Response 200:
{
  "categories": [
    {
      "id": 1,
      "nom": "Chauffage et Climatisation",
      "prestations": [
        { "id": 1, "nom": "Pose radiateur" },
        { "id": 2, "nom": "Maintenance climatiseur" }
      ],
      "sousCategories": [...]
    }
  ],
  "materiauCount": 25,
  "servicesCount": 12,
  "totalPrestations": 34
}
```

### 2️⃣ Recherche
```http
GET /catalogue/search?q=radiateur

✓ Response 200:
{
  "prestations": [
    { "id": 1, "nom": "Pose radiateur fonte" },
    { "id": 3, "nom": "Remplacement radiateur acier" }
  ],
  "materiaux": [
    { "id": 5, "nom": "Radiateur fonte" },
    { "id": 6, "nom": "Radiateur acier" }
  ],
  "services": []
}
```

---

## 📋 Codes d'Erreur

| Code | Signification | Exemple |
|------|---------------|---------|
| 201 | Créé avec succès | Matériau créé |
| 200 | Succès | Liste récupérée |
| 400 | Validation échouée | Prix min > prix max |
| 401 | Non authentifié | JWT invalide/expiré |
| 403 | Non autorisé | Accès autre compagnie |
| 404 | Non trouvé | Prestation inexistante |
| 409 | Conflit | Matériau existant |
| 500 | Erreur serveur | DB down |

---

## 💡 Exemples Complets

### Créer "Pose Luminaire" COMPLET (10 appels)

**Step 1: Créer catégorie**
```bash
curl -X POST http://localhost:3000/api/catalogue/categories \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "nom": "Électricité",
    "description": "Travaux électriques"
  }'
# Response: id: 3
```

**Step 2: Créer matériaux (2x)**
```bash
# Matériau 1: LED 50W - 15€
POST /catalogue/materiaux
{
  "nom": "LED 50W",
  "couleur": "Blanc",
  "finition": "Mat",
  "prixAchatFixe": 15
}
# Response: id: 100

# Matériau 2: Câble 2.5mm - 2€
POST /catalogue/materiaux
{
  "nom": "Câble 2.5mm",
  "unite": "ML",
  "prixAchatFixe": 2
}
# Response: id: 101
```

**Step 3: Créer service main d'oeuvre**
```bash
POST /catalogue/services-mo
{
  "nom": "Installation lumière",
  "prixUnitaire": 40,
  "productiviteJour": 20,
  "coutJournalier": 200
}
# Response: id: 50
```

**Step 4: Créer prestation**
```bash
POST /catalogue/prestations
{
  "nom": "Pose luminaire LED",
  "categorieId": 3,
  "unite": "PIECE",
  "prixVenteMin": 100,
  "prixVenteMax": 200
}
# Response: id: 15
```

**Step 5-7: Ajouter compositions**
```bash
POST /catalogue/prestations/15/compositions
{ "materiauId": 100, "quantiteParUnite": 1 }

POST /catalogue/prestations/15/compositions
{ "materiauId": 101, "quantiteParUnite": 3 }

POST /catalogue/prestations/15/compositions
{ "serviceMainOeuvreId": 50, "quantiteParUnite": 0.5 }
```

**Step 8: Ajouter option**
```bash
POST /catalogue/prestations/15/options
{
  "nom": "Couleur du luminaire",
  "obligatoire": false
}
# Response: id: 25
```

**Step 9: Ajouter choix**
```bash
POST /catalogue/prestations/options/25/choix
{
  "nom": "Blanc",
  "impactPrix": 0
}

POST /catalogue/prestations/options/25/choix
{
  "nom": "Chromé",
  "impactPrix": 30
}
```

**Step 10: Ajouter infos requises**
```bash
POST /catalogue/prestations/15/infos-requises
{
  "nom": "Surface à éclairer",
  "typeInfo": "MESURE",
  "unite": "m²",
  "obligatoire": true
}
```

✅ **Prestation complète créée!**

---

## 🎯 Points à Retenir

✅ Tous les endpoints requièrent JWT valide
✅ Matériaux = coûts d'achat fixes
✅ Services = productivité OU prix unitaire
✅ Prestations = assemblage logique
✅ Options = variantes avec surcoûts
✅ Infos = données essentielles
✅ Vue complète en UNE requête (`/complete`)

Lisez [BACKEND_ORGANISATION.md](BACKEND_ORGANISATION.md) pour la doc complète!
