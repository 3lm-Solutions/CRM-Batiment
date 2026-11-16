# 📋 Système Professionnel de Diagnostic & Génération Automatique de Devis

## 🎯 Vue d'Ensemble

Ce système offre un flux **complet et professionnel** pour :
1. **Recueillir des informations** via des questions diagnostiques
2. **Remplir des données** (mesures, photos, observations)
3. **Choisir des options** (finitions, matériaux additionnels)
4. **Générer automatiquement un devis** avec calculs précis

---

## 🏗️ Architecture Globale

```
CLIENT RÉPOND AUX QUESTIONS
        ↓
CLIENT REMPLIT LES INFOS REQUISES
        ↓
CLIENT CHOISIT LES OPTIONS
        ↓
💰 SYSTÈME CALCULE AUTOMATIQUEMENT :
   - Coût matériaux (depuis compositions)
   - Coût main d'œuvre (depuis compositions)
   - Impact options choisies
   - Marge commerciale
   - Tous les totaux (HT, TVA, TTC)
        ↓
✨ DEVIS PRO GÉNÉRÉ EN BROUILLON
```

---

## 🗄️ Modèles de Données

### 1. **QuestionDiagnosticSession** (Session Principal)
Contient tout le contexte d'une visite technique/diagnostic :

```typescript
{
  id: number;
  companyId: number;
  clientId: number;
  categorieId?: number;
  sousCategorieId?: number;
  statut: "EN_COURS" | "COMPLETEE" | "DEVIS_GENERE";
  donneeStructure?: Json;  // Snapshot pour audit
  reponses: ReponseDiagnostic[];
  valeursInfos: ValeurInfoRequise[];
  selectionsOptions: SelectionOptionDevis[];
  devisGenere?: Devis;  // Lien bidirectionnel
}
```

### 2. **ReponseDiagnostic** (Réponses aux Questions)
```typescript
{
  id: number;
  sessionDiagId: number;
  questionId: number;
  contenu: string;  // Réponse du client
}
```

### 3. **ValeurInfoRequise** (Mesures, Photos, Observations)
```typescript
{
  id: number;
  sessionDiagId: number;
  infoRequiseId: number;
  valeur: string;        // "25" pour une surface
  unite?: string;        // "m²"
}
```

### 4. **SelectionOptionDevis** (Options Choisies)
```typescript
{
  id: number;
  sessionDiagId: number;
  optionPrestationId: number;
  choixOptionId: number;  // Le choix spécifique
}
```

### 5. **Devis** (Mis à jour pour lier session)
```typescript
{
  sessionDiagId?: number;  // ✨ NOUVEAU : Lien à la session
  // ... autres champs existants
}
```

---

## 💰 Calcul des Prix (Automatique)

### **Formule Complète :**

```
1. COÛT D'ACHAT (COGS)
   = (Σ matériaux de compositions × quantité)
   + (Σ services MO de compositions × quantité)
   + (Σ coûts options choisies)

2. PRIX DE VENTE
   = MAX(prixVenteMin, MIN(prixVenteMax, coutAchat × 1.35))
   // 1.35 = marge de 35%

3. PROFIT
   = prixVente - coutAchat

4. MARGE %
   = (profit / prixVente) × 100

5. TOTAUX
   HT = somme(lignes prixVente)
   TVA = HT × 20%
   TTC = HT + TVA
```

### **Exemple Concret :**

**Prestation:** Pose luminaire (1 PIECE)

```
Compositions :
  - Luminaire: 40€
  - Installation MO: 45€
  Total composition: 85€

Options choisies :
  - Finition "Mat" : +10€

Coût total: 85 + 10 = 95€
Prix de vente: 95 × 1.35 = 128,25€
Encadré entre: 50€ - 120€
Final: 120€ (max encadrement appliqué)

Marge: (120 - 95) / 120 = 20.8%
```

---

## 🔌 API REST Complète

### **Base :** `/diagnostic`

#### **1️⃣ SESSIONS**

```
POST /diagnostic/sessions
{
  "clientId": 5,
  "categorieId": 1,
  "sousCategorieId": 2
}
→ { id: 123, statut: "EN_COURS" }
```

```
GET /diagnostic/sessions/:id
→ Données complètes + réponses + infos + options
```

#### **2️⃣ QUESTIONS**

```
GET /diagnostic/sessions/:id/questions
→ [
    {
      "id": 1,
      "question": "Quel est l'état du sol ?",
      "typeReponse": "CHOIX_UNIQUE",
      "choixPossibles": ["Bon", "Endommagé", "À refaire"],
      "obligatoire": true,
      "aide": "Examiner visuellement..."
    }
  ]
```

```
POST /diagnostic/sessions/:id/reponses
{
  "questionId": 1,
  "contenu": "Endommagé"
}
```

```
POST /diagnostic/sessions/:id/reponses/bulk
{
  "reponses": [
    { "questionId": 1, "contenu": "Endommagé" },
    { "questionId": 2, "contenu": "Forte humidité" }
  ]
}
```

#### **3️⃣ INFOS REQUISES**

```
GET /diagnostic/sessions/:id/infos-requises
→ [
    {
      "id": 1,
      "nom": "Surface",
      "typeInfo": "MESURE",
      "unite": "m²",
      "obligatoire": true,
      "aide": "Mesurer la longueur × largeur"
    }
  ]
```

```
POST /diagnostic/sessions/:id/infos-requises
{
  "infoRequiseId": 1,
  "valeur": "25",
  "unite": "m²"
}
```

#### **4️⃣ OPTIONS**

```
GET /diagnostic/sessions/:id/options
→ [
    {
      "prestationId": 1,
      "prestationNom": "Peinture mur",
      "options": [
        {
          "id": 5,
          "nom": "Finition",
          "obligatoire": false,
          "choix": [
            { "id": 10, "nom": "Brillante", "impactPrix": 0 },
            { "id": 11, "nom": "Mate", "impactPrix": 10 },
            { "id": 12, "nom": "Satinée", "impactPrix": 15 }
          ]
        }
      ]
    }
  ]
```

```
POST /diagnostic/sessions/:id/options
{
  "optionPrestationId": 5,
  "choixOptionId": 11
}
```

#### **5️⃣ GÉNÉRATION AUTOMATIQUE 🎁**

```
POST /diagnostic/generer-devis
{
  "sessionDiagId": 123,
  "notes": "Approche recommandée par technicien"
}
→ {
    "devisId": 42,
    "reference": "DEV-2026-0042",
    "totalTTC": 2850.50,
    "status": "BROUILLON"
  }
```

```
GET /diagnostic/devis/:devisId
→ Devis complet avec :
   - Client
   - Lignes calculées
   - Options choisies
   - Tous les totaux
```

---

## 🎨 Utilisation Frontend

### **Flux Recommandé :**

```typescript
// 1. Créer session
const session = await POST('/diagnostic/sessions', {
  clientId: 5,
  categorieId: 1
});
sessionId = session.id;

// 2. Charger questions
const questions = await GET(`/diagnostic/sessions/${sessionId}/questions`);

// 3. Client répond (une par une ou bulk)
await POST(`/diagnostic/sessions/${sessionId}/reponses`, {
  questionId: 1,
  contenu: "Endommagé"
});

// 4. Charger et remplir infos
const infos = await GET(`/diagnostic/sessions/${sessionId}/infos-requises`);
await POST(`/diagnostic/sessions/${sessionId}/infos-requises`, {
  infoRequiseId: 1,
  valeur: "25",
  unite: "m²"
});

// 5. Charger et choisir options
const options = await GET(`/diagnostic/sessions/${sessionId}/options`);
await POST(`/diagnostic/sessions/${sessionId}/options`, {
  optionPrestationId: 5,
  choixOptionId: 11
});

// 6. GÉNÉRER DEVIS AUTOMATIQUE! ✨
const result = await POST('/diagnostic/generer-devis', {
  sessionDiagId: sessionId,
  notes: "Diagnostic complété"
});

// 7. Afficher résultat
console.log(`Devis ${result.reference} : ${result.totalTTC}€`);
```

---

## 📊 Exemple Complet

### **Scenario :** Rénovation salle de bain 25m²

```
SESSION #123 - Client "DUPONT"
├─ Questions (4/4 répondues)
│  ├─ État salle bain: "Mauvais"
│  ├─ Humidité: "Forte"
│  ├─ Carrelage actuel: "À enlever"
│  └─ Budget approx: "Sans limite"
│
├─ Infos requises (3/3 remplies)
│  ├─ Surface: 25 (m²)
│  ├─ Photos avant: /uploads/photo1.jpg
│  └─ État murs: Dégradés
│
├─ Options choisies (2/2)
│  ├─ Carrelage: "Porcelaine premium" (+200€)
│  └─ Joints: "Époxy" (+150€)
│
└─ RÉSULTAT DEVIS GÉNÉRÉ:
   Référence: DEV-2026-0123
   ├─ HT: 5,240€
   │  └─ Matériaux: 2,800€
   │  └─ Main d'œuvre: 2,440€
   ├─ TVA (20%): 1,048€
   └─ TTC: 6,288€
   
   Marge: 28.4%
   Profit: 1,488€
```

---

## 🔒 Sécurité & Permissions

| Endpoint | Rôles | Description |
|----------|-------|-------------|
| `POST /diagnostic/sessions` | TECHNICO, ASSISTANTE, ADMIN | Créer session |
| `POST sessions/:id/reponses/*` | TECHNICO, ASSISTANTE, ADMIN | Répondre questions |
| `POST sessions/:id/infos-requises/*` | TECHNICO, ASSISTANTE, ADMIN | Remplir infos |
| `POST sessions/:id/options/*` | TECHNICO, ASSISTANTE, ADMIN | Choisir options |
| `POST /diagnostic/generer-devis` | TECHNICO, ASSISTANTE, ADMIN | **Générer devis** |
| `GET /diagnostic/*` | Tous authentifiés | Lire données |

**Validation :** `companyId` doit matcher entre session et utilisateur

---

## ⚙️ Configuration Recommandée

### **Dans Admin Panel :**

```
1. Créer Catégories + Sous-catégories
2. Ajouter Prestations avec :
   - prixVenteMin/Max encadrés
3. Définir Compositions :
   - Matériaux (avec prixAchatFixe)
   - Services MO (avec prixUnitaire)
4. Créer Options :
   - Finition, Matériaux premium, etc.
   - Avec impactPrix correct
5. Créer Questions Diagnostiques :
   - Obligatoires pour chaque catégorie
   - Avec choixPossibles variés
6. Créer Infos Requises :
   - Surface, Photos, Observations
   - Liées aux prestations
```

---

## 🚀 Prochaines Étapes

- [ ] Ajouter validation des infos obligatoires avant devis
- [ ] Créer PDF automatique du devis
- [ ] Ajouter signature électronique
- [ ] Historiq ue des modifications de devis
- [ ] Export Excel/CSV
- [ ] Intégration signature e-sign

---

## 📞 Support

Pour toute question sur le système, référez-vous à :
- `PriceCalculatorService` : Logique de calcul
- `DevisAutoGeneratorService` : Génération devis
- `DiagnosticSessionService` : Gestion sessions
- API Swagger : `/api/docs`
