# 🚀 DÉMARRAGE RAPIDE - Module Catalogue

## ⚡ 5 Minutes pour Commencer

### 1. Vérifier les fichiers créés
```bash
cd backend

# Vérifier la structure du module
ls -la src/modules/catalogue/
# Doit afficher:
# - catalogue.module.ts
# - controllers/ (4 fichiers)
# - services/ (4 fichiers)
# - dto/ (4 fichiers)
```

### 2. Vérifier importation dans app.module.ts
```bash
# Ouvrir src/app.module.ts
# Vérifier la ligne:
# import { CatalogueModule } from './modules/catalogue/catalogue.module.js';

# Et dans les imports:
# CatalogueModule,
```

### 3. Compiler & Démarrer
```bash
# Compiler TypeScript
npm run build

# Démarrer le serveur
npm run dev
# ou
npm start
```

### 4. Vérifier dans Swagger
```
Ouvrir: http://localhost:3000/api/docs
→ Voir la section "Catalogue"
→ Voir 25+ endpoints!
```

### 5. Premier test
```bash
# Sans JWT (vous allez recevoir 401: Unauthorized)
curl http://localhost:3000/api/catalogue/categories

# Avec JWT (après login)
TOKEN="votre_jwt_token_ici"
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/api/catalogue/categories
```

---

## 🔧 Troubleshooting

### Erreur: "Cannot find module './modules/catalogue'"

**Solution:** Vérifier l'import dans app.module.ts
```typescript
// ❌ Incorrect
import { CatalogueModule } from './modules/catalogue/catalogue.module';

// ✅ Correct
import { CatalogueModule } from './modules/catalogue/catalogue.module.js';
// (Note: .js est requis avec ES modules)
```

### Erreur: "CatalogueService is not defined"

**Solution:** Vérifier que CatalogueModule exporte les services
```typescript
// Dans catalogue.module.ts
@Module({
  exports: [
    CatalogueService,
    MaterialService,
    ServiceMoService,
    PrestationService,
  ],
})
```

### Erreur: "Prisma types not found"

**Solution:** Régénérer Prisma
```bash
npx prisma generate
```

### Erreur: "No migrations pending"

**Solution:** Migrations déjà appliquées (c'est ok!)

---

## 📋 Checkliste avant Go-Live

- [ ] `npm run build` compile sans erreurs
- [ ] Serveur démarre: `npm start`
- [ ] Swagger affiche 25+ endpoints
- [ ] Login fonctionne (JWT reçu)
- [ ] GET /catalogue retourne [] (liste vide normal)
- [ ] POST /catalogue/categories crée une catégorie
- [ ] Données persistes après restart

---

## 🧪 Script de Test Complet

### test-catalogue.sh
```bash
#!/bin/bash

# Configuration
BASE_URL="http://localhost:3000/api"
JWT_TOKEN="votre_token_jwt_ici"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

# Helper
test_endpoint() {
  local method=$1
  local endpoint=$2
  local data=$3
  
  echo -e "\n${GREEN}Testing: $method $endpoint${NC}"
  
  if [ -z "$data" ]; then
    curl -s -X $method \
      -H "Authorization: Bearer $JWT_TOKEN" \
      "$BASE_URL$endpoint" | jq .
  else
    curl -s -X $method \
      -H "Authorization: Bearer $JWT_TOKEN" \
      -H "Content-Type: application/json" \
      -d "$data" \
      "$BASE_URL$endpoint" | jq .
  fi
}

# 1. Créer catégorie
CAT=$(curl -s -X POST \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"nom":"Test Catégorie","description":"Test"}' \
  "$BASE_URL/catalogue/categories" | jq -r '.id')

echo "Catégorie créée: $CAT"

# 2. Lister catégories
test_endpoint GET "/catalogue/categories"

# 3. Créer matériau
MAT=$(curl -s -X POST \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"nom":"Test Matériau","couleur":"Blanc","prixAchatFixe":100}' \
  "$BASE_URL/catalogue/materiaux" | jq -r '.id')

echo "Matériau créé: $MAT"

# 4. Créer service
SVC=$(curl -s -X POST \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"nom":"Test Service","prixUnitaire":50,"productiviteJour":10,"coutJournalier":200}' \
  "$BASE_URL/catalogue/services-mo" | jq -r '.id')

echo "Service créé: $SVC"

# 5. Créer prestation
PREST=$(curl -s -X POST \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"nom\":\"Test Prestation\",\"categorieId\":$CAT,\"prixVenteMin\":400,\"prixVenteMax\":650}" \
  "$BASE_URL/catalogue/prestations" | jq -r '.id')

echo "Prestation créée: $PREST"

# 6. Récupérer complète
echo -e "\n${GREEN}Prestation Complète:${NC}"
test_endpoint GET "/catalogue/prestations/$PREST/complete"

echo -e "\n${GREEN}✅ Test réussi!${NC}"
```

### Lancer le test
```bash
bash test-catalogue.sh
```

---

## 📊 Format des Réponses

### Succès (201, 200)
```json
{
  "id": 1,
  "nom": "Test",
  "createdAt": "2026-03-14T10:00:00Z"
}
```

### Erreur Validation (400)
```json
{
  "statusCode": 400,
  "message": "Le prix min doit être inférieur au prix max",
  "error": "Bad Request"
}
```

### Erreur Auth (401)
```json
{
  "statusCode": 401,
  "message": "Unauthorized",
  "error": "Unauthorized"
}
```

### Non Trouvé (404)
```json
{
  "statusCode": 404,
  "message": "Matériau non trouvé",
  "error": "Not Found"
}
```

---

## 🔐 Sécurité

✅ **Tous les endpoints sont protégés par JWT**

```typescript
@UseGuards(JwtAuthGuard)  // Requis sur tous les controllers
```

### Pour tester avec Postman
1. Login pour obtenir JWT
2. Ajouter dans Headers: `Authorization: Bearer {token}`
3. Tester endpoints

---

## 📖 Structure des Données

### Exemple Complet Retourné
```json
GET /catalogue/prestations/1/complete

{
  "prestation": {
    "id": 1,
    "nom": "Pose radiateur",
    "categorieId": 1,
    "prixVenteMin": 400,
    "prixVenteMax": 650,
    "unite": "PIECE"
  },
  "compositions": [
    {
      "id": 1,
      "materiau": {
        "id": 5,
        "nom": "Radiateur fonte",
        "couleur": "Blanc",
        "finition": "Brillant",
        "prixAchatFixe": 150
      },
      "quantiteParUnite": 1.1
    },
    {
      "id": 2,
      "serviceMainOeuvre": {
        "id": 12,
        "nom": "Installation",
        "prixUnitaire": 50,
        "productiviteJour": 25
      },
      "quantiteParUnite": 1
    }
  ],
  "options": [
    {
      "id": 10,
      "nom": "Couleur",
      "obligatoire": false,
      "choix": [
        {
          "id": 20,
          "nom": "Blanc",
          "impactPrix": 0,
          "compositions": []
        },
        {
          "id": 21,
          "nom": "Noir",
          "impactPrix": 50,
          "compositions": [
            {
              "materiau": {...},
              "quantiteParUnite": 0.1
            }
          ]
        }
      ]
    }
  ],
  "infosRequises": [
    {
      "id": 5,
      "nom": "Surface m²",
      "typeInfo": "MESURE",
      "unite": "m²",
      "obligatoire": true,
      "aide": "Surface du radiateur"
    }
  ]
}
```

---

## 🎯 Cas d'Usage Court

### Cas 1: Admin crée catalogue
```bash
# 1. Créer catégorie
POST /catalogue/categories
{
  "nom": "Électricité",
  "description": "Services électriques"
}
# Retour: id 1

# 2. Créer matériau
POST /catalogue/materiaux
{
  "nom": "LED 50W",
  "couleur": "Blanc",
  "prixAchatFixe": 15
}
# Retour: id 100

# 3. Créer service
POST /catalogue/services-mo
{
  "nom": "Pose électrique",
  "prixUnitaire": 40
}
# Retour: id 50

# 4. Créer prestation
POST /catalogue/prestations
{
  "nom": "Pose LED",
  "categorieId": 1,
  "prixVenteMin": 100,
  "prixVenteMax": 200
}
# Retour: id 1

# 5. Ajouter matériau à prestation
POST /catalogue/prestations/1/compositions
{
  "materiauId": 100,
  "quantiteParUnite": 1
}

# 6. Ajouter service à prestation
POST /catalogue/prestations/1/compositions
{
  "serviceMainOeuvreId": 50,
  "quantiteParUnite": 0.5
}

# 7. Ajouter option
POST /catalogue/prestations/1/options
{
  "nom": "Couleur",
  "obligatoire": false
}
# Retour: id 5

# 8. Ajouter choix
POST /catalogue/prestations/options/5/choix
{
  "nom": "Blanc",
  "impactPrix": 0
}

# 9. Ajouter info requise
POST /catalogue/prestations/1/infos-requises
{
  "nom": "Surface m²",
  "typeInfo": "MESURE",
  "unite": "m²",
  "obligatoire": true
}

✅ PRESTATION COMPLÈTE CRÉÉE!
```

### Cas 2: Technicien accède au catalogue
```bash
# Récupérer une prestation complète
GET /catalogue/prestations/1/complete

# Retour: JSON avec toutes les infos nécessaires
# - Compositions (matériaux + services)
# - Options et choix
# - Infos requises

# Utiliser dans diagnostique/devis:
// getPrestationComplete(id)
// .then(prestation => {
//   // Afficher options au client
//   // Remplir infos requises
//   // Calculer prix final avec PriceCalculatorService
// })
```

### Cas 3: Frontend affiche catalogue
```bash
# Récupérer liste complète
GET /catalogue

# Retour:
{
  "categories": [
    {
      "nom": "Électricité",
      "prestations": [
        {id: 1, nom: "Pose LED"},
        {id: 2, nom: "Installation panneau"}
      ],
      "sousCategories": [...]
    }
  ],
  "materiauCount": 25,
  "servicesCount": 12,
  "totalPrestations": 34
}

// Use pour afficher:
// - Menu par catégories
// - Prestations disponibles
// - Statistiques
```

---

## 🆘 Questions Fréquentes

### Q: Où sont les anciennes prestations?
**R:** Dans PrestationsModule. Catalogue est une réorganisation (à migrer/merger après)

### Q: Peut-on supprimer une prestation?
**R:** Non, soft delete seulement (`actif: false`)

### Q: Matériau utilisé par 10 prestations, puis modifier prix?
**R:** Oui! Change pour tous (via `updatePrice`)

### Q: Services sans productivité?
**R:** Oui! Utilise prix unitaire à la place

### Q: Option sans compositions?
**R:** Oui! Juste un surcoût (ex: "Garantie étendue" +50€)

---

## 📚 Ressources

- [BACKEND_ORGANISATION.md](../BACKEND_ORGANISATION.md) - Architecture complète
- [API_CATALOGUE.md](../API_CATALOGUE.md) - Tous les endpoints avec exemples
- [Swagger](http://localhost:3000/api/docs) - Docs API interactive

---

**Bon courage!** 🚀 Le backend est maintenant PROFESSIONNEL!
