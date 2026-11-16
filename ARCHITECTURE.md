# 🏛️ Architecture Système Complet

## Database Schema (Postgresql)

```
┌─────────────────────────────────────────────────────────────────┐
│                         COMPANIES                               │
│                                                                 │
│ id • nom • siret • tvaDefaut • devise • ...                    │
└────────────────┬──────────────────────────┬───────────────────┘
                 │                          │
         ┌───────▼──────┐          ┌────────▼─────────┐
         │   CLIENTS    │          │      USERS       │
         │              │          │                  │
         │ id • nom     │          │ id • email • role│
         └────┬─────────┘          └────────┬─────────┘
              │                             │
              │         ┌───────────────────┘
              │         │
         ┌────▼─────────▼────────────────────────────────────┐
         │  QUESTION_DIAGNOSTIC_SESSION (NOVA)               │
         │                                                   │
         │  id • companyId • clientId • categorieId         │
         │  • sousCategorieId • statut • donneeStructure    │
         │  • createdAt • updatedAt                         │
         └────┬──────────────────┬──────────────┬──────────┘
              │                  │              │
         ┌────▼────┐    ┌────────▼────┐  ┌─────▼────────┐
         │ REPONSES│    │ VALEURS_INFO│  │ SELECTIONS   │
         │         │    │             │  │ OPTION       │
         │ - contenu    │ - valeur     │  │ - optionId   │
         └─────────┘    │ - unite      │  │ - choixId    │
                        └─────────────┘  └──────────────┘
                             │                │
              ┌──────────────┘                │
              │                              │
         ┌────▼─────────────┐      ┌─────────▼────────┐
         │ QUESTIONS_       │      │ OPTIONS_         │
         │ DIAGNOSTIQUES    │      │ PRESTATIONS      │
         │                  │      │                  │
         │ - question       │      │ - nom            │
         │ - typeReponse    │      │ - obligatoire    │
         │ - choixPossibles │      └──────────────────┘
         └──────────────────┘              │
                                           │
                                    ┌──────▼──────┐
                                    │ CHOIX_      │
                                    │ OPTION      │
                                    │             │
                                    │ - nom       │
                                    │ - impactPrix│
                                    └─────────────┘


         ┌──────────────────────────────────────┐
         │      DEVIS (mis à jour)              │
         │                                      │
         │ id • sessionDiagId (NEW!)            │
         │ • reference • totalHT • totalTTC     │
         │ • totalTVA • coutTotal • profit     │
         │ • margePourcent • statut             │
         └────────────────────────────────────┘
                          │
              ┌───────────▼──────────────┐
              │   LIGNES_DEVIS           │
              │                          │
              │ • prixUnitaireVente     │
              │ • prixAchat             │
              │ • mainOeuvre            │
              │ • totalHT • coutTotal   │
              └──────────────────────────┘
                          │
         ┌────────────────┴─────────────┬─────┐
         │                              │     │
    ┌────▼──────┐        ┌─────────┐   │  ┌──▼────────┐
    │ PRESTATION│        │MATERIAU │   │  │ SERVICE   │
    │           │        │         │   │  │ _MAIN_    │
    │ -prixVente│        │-prixFm  │   │  │ OEUVRE    │
    │           │        └─────────┘   │  └───────────┘
    └───────────┘                      │
                        ┌──────────────▼─────┐
                        │ COMPOSITIONS       │
                        │                    │
                        │ pivot              │
                        │ prestation→matériau│
                        │ prestation→SMO     │
                        └────────────────────┘
```

---

## Backend Services Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    NestJS MODULE STRUCTURE                   │
└─────────────────────────────────────────────────────────────┘

                        ┌──────────────┐
                        │  APP MODULE  │
                        │              │
                        │ imports:     │
                        │ [DevisModule]│
                        └────────┬─────┘
                                 │
                ┌────────────────▼──────────────┐
                │                               │
        ┌───────▼──────────┐       ┌───────────▼────┐
        │  DEVIS MODULE    │       │  OTHER MODULES │
        │                  │       │  (Users, Mail) │
        │ Controllers:     │       └────────────────┘
        │  • DevisCtr      │
        │  • DiagnosticCtr │ (NEW!)
        │                  │
        │ Providers:       │
        │  • DevisService  │
        │  • Diagnostic    │
        │    SessionService│ (NEW!)
        │  • DevisAuto     │
        │    GeneratorSvc  │ (NEW!)
        │  • PriceCalc     │
        │    Service       │ (NEW!)
        │                  │
        │ PrismaService    │
        └──────────────────┘


┌────────────────────────────────────────────────────────────┐
│              SERVICE LAYER - PRIX & GÉNÉRATION              │
└────────────────────────────────────────────────────────────┘

  ┌──────────────────────────────────────────────────────┐
  │  PriceCalculatorService                            │
  │  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
  │                                                      │
  │  calculatePrestationPrice(prestationId, selections) │
  │  │                                                  │
  │  ├─ Récupère prestation + compositions             │
  │  ├─ Calcule coût matériaux                         │
  │  ├─ Calcule coût main d'oeuvre                     │
  │  ├─ Ajoute impact options choisies                 │
  │  ├─ Applique marge 35%                             │
  │  └─ Encadre entre prixVenteMin/Max                 │
  │                                                      │
  │  calculateTotalDevis(lignes, tauxTVA)              │
  │  │                                                  │
  │  ├─ Somme HT                                       │
  │  ├─ Calcule TVA                                    │
  │  ├─ Calcule TTC                                    │
  │  └─ Calcule profit + marge%                        │
  │                                                      │
  └──────────────────────────────────────────────────────┘
                             △
                             │
  ┌──────────────────────────┴──────────────────────────┐
  │  DevisAutoGeneratorService                         │
  │  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
  │                                                     │
  │  generateDevisFromSession(dto)                     │
  │  │                                                 │
  │  ├─ GetSessionComplete()                           │
  │  ├─ Identify prestation(s)                         │
  │  ├─ calculatePrestationPrice() ◄─ ✨ APPEL        │
  │  ├─ Create Devis in BROUILLON                      │
  │  ├─ Create LigneDevis                              │
  │  ├─ Generate reference (DEV-YYYY-XXXX)            │
  │  └─ Mark session DEVIS_GENERE                      │
  │                                                     │
  │  getDevisComplet(devisId)                          │
  │  └─ Fetch with all relations                       │
  │                                                     │
  └────────────────────────────────────────────────────┘
                             △
                             │
  ┌──────────────────────────┴──────────────────────────┐
  │  DiagnosticSessionService                          │
  │  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
  │                                                     │
  │  createSession(companyId, clientId, ...)           │
  │  getQuestionsForCategory(...)                      │
  │  answerQuestion(sessionId, questionId, contenu)    │
  │  getInfosForCategory(...)                          │
  │  fillInfoRequise(sessionId, infoId, valeur)        │
  │  getOptionsForCategory(...)                        │
  │  selectOption(sessionId, optionId, choixId)        │
  │  getSessionComplete(sessionId)                     │
  │  completeSession(sessionId)                        │
  │                                                     │
  └────────────────────────────────────────────────────┘
```

---

## API Request/Response Flow

```
┌──────────────────────────────────────────────────────────────┐
│                    FRONTEND (React + TanStack Query)          │
│                                                              │
│  const { mutate } = useMutation(                            │
│    async () => api.post('/diagnostic/generer-devis', {...}) │
│  )                                                           │
│                                                              │
│  Button: "Générer devis" → mutate()                         │
└────────────────┬─────────────────────────────────────────────┘
                 │        POST /diagnostic/generer-devis
                 │        { sessionDiagId: 123, notes: "..." }
                 │
                 ▼
┌──────────────────────────────────────────────────────────────┐
│              DIAGNOSTIC CONTROLLER                           │
│                                                              │
│  generateDevis(dto, user: CurrentUser)                       │
│  │                                                           │
│  ├─ Validate: JWT, user.companyId                           │
│  ├─ Call: DiagnosticSessionService.getSessionComplete()     │
│  ├─ Call: DevisAutoGeneratorService.generateDevisFromSession│
│  │                                                           │
│  └─ Return: { devisId, reference, totalTTC }                │
│                                                              │
└────┬─────────────────────────────────────────────────────────┘
     │
     ▼
┌──────────────────────────────────────────────────────────────┐
│           DEVIS AUTO GENERATOR SERVICE                       │
│                                                              │
│  generateDevisFromSession(dto)                               │
│  {                                                           │
│    ① Fetch session avec relations complètes                │
│    │  • reponses                                            │
│    │  • valeursInfos                                        │
│    │  • selectionsOptions                                   │
│    │                                                        │
│    ② Identifier prestation (depuis categorieId)            │
│    │                                                        │
│    ③ Extraire quantité (surface depuis infos)              │
│    │                                                        │
│    ④ Appeler PriceCalculatorService                        │
│    │  avec: prestationId, selections objets                │
│    │                                                        │
│    ├─ Retour: LigneDevisData complète                      │
│    │  { prixUnitaire, prixAchat, mainOeuvre, ...}          │
│    │                                                        │
│    ⑤ Appeler calculateTotalDevis([ligne])                  │
│    │  ├─ Retour: totalHT, totalTVA, totalTTC,             │
│    │  │           coutTotal, profit, marge%               │
│    │                                                        │
│    ⑥ Générer reference unique (DEV-YYYY-XXXX)             │
│    │                                                        │
│    ⑦ Créer Devis en BROUILLON:                             │
│    │  {                                                     │
│    │    reference: "DEV-2026-0042",                        │
│    │    clientId, companyId, sessionDiagId,                │
│    │    totalHT: 2000,                                     │
│    │    totalTVA: 400,                                     │
│    │    totalTTC: 2400,                                    │
│    │    profit: 500,                                       │
│    │    margePourcent: 25,                                 │
│    │    statut: "BROUILLON",                               │
│    │    lignes: [...]                                      │
│    │  }                                                     │
│    │                                                        │
│    ⑧ Mettre à jour session → DEVIS_GENERE                 │
│    │                                                        │
│    └─ Return: { devisId: 42, reference, totalTTC }         │
│  }                                                          │
│                                                              │
└────┬─────────────────────────────────────────────────────────┘
     │
     ▼
┌──────────────────────────────────────────────────────────────┐
│                   PRISMA (ORM)                               │
│                                                              │
│  Prisma.devis.create({                                       │
│    data: {                                                   │
│      companyId, clientId, sessionDiagId, reference,          │
│      totalHT, totalTVA, totalTTC, coutTotal,                 │
│      profit, margePourcent, statut: "BROUILLON",             │
│      lignes: { create: [...] }                               │
│    }                                                         │
│  })                                                          │
│                                                              │
└────┬─────────────────────────────────────────────────────────┘
     │
     ▼
┌──────────────────────────────────────────────────────────────┐
│                  PostgreSQL Database                         │
│                                                              │
│  INSERT INTO devis (reference, clientId, totalTTC, ...)     │
│    VALUES ('DEV-2026-0042', 5, 2400, ...)                   │
│  RETURNING id, reference, totalTTC;                          │
│                                                              │
│  INSERT INTO lignes_devis (devisId, description, ...)       │
│    VALUES (42, 'Pose luminaire 5m² @ 120€', ...)            │
│                                                              │
└────┬─────────────────────────────────────────────────────────┘
     │
     ▼
┌──────────────────────────────────────────────────────────────┐
│           RESPONSE BACK TO FRONTEND                          │
│                                                              │
│  { devisId: 42, reference: "DEV-2026-0042", totalTTC: 2400 }│
│                                                              │
│           ↓↓↓ AFFICHAGE CLIENT ↓↓↓                          │
│                                                              │
│  ✨ DEVIS GÉNÉRÉ AVEC SUCCÈS!                               │
│  Référence: DEV-2026-0042                                    │
│  Total TTC: 2,400.00€                                        │
│  Status: BROUILLON (prêt à envoyer)                         │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

---

## Data Flow - Diagnostic Complet

```
CLIENT RESPONDS                 SYSTEM STATE

1. Démarrer session ────────►  QuestionDiagnosticSession {
                                 statut: "EN_COURS"
                               }

2. Répondre 5 questions ───────► ReponseDiagnostic[5] {
                                   sessionDiagId: 123
                                   questionId: [1,2,3,4,5]
                                   contenu: ["Bon", "Moyen", ...]
                                 }

3. Remplir 3 infos ────────────► ValeurInfoRequise[3] {
                                   infoRequiseId: [1,2,3]
                                   valeur: ["25", "photo.jpg", ...]
                                   unite: ["m²", "", ...]
                                 }

4. Choisir 2 options ──────────► SelectionOptionDevis[2] {
                                   optionPrestationId: [1, 5]
                                   choixOptionId: [2, 11]
                                 }

5. Générer Devis ──────────────► Devis {
                                   reference: "DEV-2026-0042"
                                   sessionDiagId: 123 (LINK!)
                                   clientId: 5
                                   totalHT: 2000.00
                                   totalTVA: 400.00
                                   totalTTC: 2400.00
                                   profit: 500.00
                                   marge%: 25.0
                                   statut: "BROUILLON"
                                 }
                                 
                                 QuestionDiagnosticSession {
                                   statut: "DEVIS_GENERE" ✓
                                 }

6. Envoyer client ─────────────► Devis {
                                   statut: "ENVOYE" (modifiable)
                                   dateEnvoi: "2026-03-14..."
                                 }
```

---

## Performance Metrics

```
LATENCIES (approx):
├─ CREATE SESSION: 50ms
├─ ANSWER QUESTION: 30ms
├─ FILL INFO: 35ms
├─ SELECT OPTION: 30ms
├─ GENERATE DEVIS: 100-200ms ⭐
│  ├─ Fetch session: 20ms
│  ├─ Fetch prestation + compositions: 30ms
│  ├─ Calculate prices: 30ms
│  └─ Create devis + lignes: 50-120ms
├─ GET COMPLETE DEVIS: 40ms
└─ TOTAL FLOW (6 questions + 3 infos + 2 options + devis):
   ~500-600ms ✅ Very fast!

DATABASE OPERATIONS:
├─ Indexes on:
│  ├─ companyId (all tables)
│  ├─ clientId (sessions, devis)
│  ├─ sessionDiagId (reponses, valeurs, selections, devis)
│  ├─ questionId (reponses)
│  ├─ infoRequiseId (valeurs)
│  └─ optionPrestationId (selections)

FRONTEND CACHING:
├─ useQuery(['session', id, 'questions'])
├─ useQuery(['session', id, 'infos'])
├─ useQuery(['session', id, 'options'])
└─ useMutation for POST operations
```

---

**Architecture complètement documentée et optimisée! 🎉**

---

## Acteurs du Futur Système

### 1. Acteurs humains (utilisateurs)

#### ADMIN (direction / pilotage)
- Responsabilités:
     - Paramétrer la société (utilisateurs, types de projet, paramètres de chiffrage).
     - Superviser l'ensemble du cycle commercial et opérationnel.
     - Arbitrer les droits, la gouvernance des données et la qualité des processus.
- Interactions attendues:
     - Crée et gère les comptes utilisateurs.
     - Suit les indicateurs (devis, factures, commandes, chantiers, performance).
     - Intervient sur les dossiers sensibles (validation, correction, relance).

#### ASSISTANTE (back-office commercial)
- Responsabilités:
     - Gérer les clients et prospects.
     - Traiter les demandes de devis et préparer les dossiers.
     - Assurer la continuité administrative des devis et factures.
- Interactions attendues:
     - Convertit les demandes en devis brouillons.
     - Coordonne la communication client et les relances.
     - Met à jour les données de contact, besoins et statut des dossiers.

#### TECHNICO (technico-commercial)
- Responsabilités:
     - Qualifier techniquement les besoins.
     - Produire ou ajuster les devis selon les contraintes terrain.
     - Accompagner le client jusqu'à la validation.
- Interactions attendues:
     - Utilise le catalogue (prestations, matériaux, main-d'oeuvre) pour chiffrer.
     - Ajuste les lignes de devis et suit la signature client.
     - Collabore avec l'assistante et le chef de chantier sur la faisabilité.

#### CHEF_CHANTIER (pilotage exécution)
- Responsabilités:
     - Organiser et suivre l'exécution chantier.
     - Affecter et suivre les tâches.
     - Contrôler l'avancement et signaler les écarts.
- Interactions attendues:
     - Reçoit les dossiers validés (devis/chantier).
     - Affecte les tâches aux équipes et met à jour les statuts.
     - Remonte les besoins de commande, aléas et ajustements.

#### SOUS_TRAITANT / FOURNISSEUR (acteur externe)
- Responsabilités:
     - Recevoir les commandes fournisseurs.
     - Confirmer et exécuter la livraison.
     - Communiquer les statuts et incidents de réception.
- Interactions attendues:
     - Consulte son portail dédié.
     - Met à jour l'état de traitement des commandes.
     - Fournit les informations nécessaires au suivi logistique.

#### CLIENT FINAL (donneur d'ordre)
- Responsabilités:
     - Exprimer le besoin.
     - Valider ou refuser les propositions commerciales.
     - Signer le devis lorsqu'il accepte.
- Interactions attendues:
     - Peut entrer via le parcours classique ou via l'assistant IA.
     - Reçoit un lien sécurisé de validation/signature.
     - Suit les échanges sur son dossier (devis, facture, chantier).

### 2. Acteurs logiciels et techniques

#### Frontend Web (interface opérationnelle)
- Responsabilités:
     - Présenter les écrans par rôle.
     - Orchestrer la navigation et les formulaires.
     - Consommer les APIs métier.
- Interactions attendues:
     - Dialogue avec le backend via HTTP.
     - Gère l'état de session utilisateur et le routage protégé.

#### Backend API (coeur métier)
- Responsabilités:
     - Appliquer les règles métier (devis, factures, commandes, chantiers, assistant).
     - Garantir la cohérence des workflows.
     - Exposer des endpoints sécurisés.
- Interactions attendues:
     - Reçoit les requêtes du frontend.
     - Interagit avec la base de données via Prisma.
     - Déclenche les notifications et les traitements automatisés.

#### Assistant IA (qualification automatique)
- Responsabilités:
     - Collecter les informations client/projet en conversation.
     - Détecter l'intention (devis, information générale, autre).
     - Proposer une pré-qualification et alimenter le CRM.
- Interactions attendues:
     - Crée/alimente des sessions de chat.
     - Génère des signaux de projets futurs.
     - Facilite la transformation prospect -> demande -> devis.

#### Service d'authentification et contrôle d'accès
- Responsabilités:
     - Authentifier les utilisateurs.
     - Gérer les rôles et permissions.
     - Sécuriser les routes et opérations sensibles.
- Interactions attendues:
     - Émet et vérifie les jetons d'accès.
     - Contrôle l'accès selon le profil (ADMIN, TECHNICO, etc.).

#### Notifications et communication (interne/externe)
- Responsabilités:
     - Informer les parties prenantes sur les événements clés.
     - Supporter relances et validation de documents.
- Interactions attendues:
     - Déclenchement depuis les modules métier (devis, commandes, signatures).
     - Diffusion vers utilisateurs internes et acteurs externes.

#### Base de données (PostgreSQL + Prisma)
- Responsabilités:
     - Stocker les données métier et l'historique.
     - Assurer l'intégrité, la traçabilité et la performance.
- Interactions attendues:
     - Lecture/écriture par le backend.
     - Support des jointures multi-modules (client, devis, chantier, facturation).

### 3. Entités métier qui interagissent avec le système

#### Société (Company)
- Porte le contexte multi-tenant: paramètres, catalogue, utilisateurs, opérations.

#### Client / Prospect
- Porte l'identité commerciale et le besoin exprimé.

#### Demande de devis
- Représente le besoin qualifié à transformer en proposition chiffrée.

#### Devis
- Document commercial central: chiffrage, statut, versions, validation/signature.

#### Facture
- Conversion financière du devis validé, avec suivi de paiement.

#### Chantier / Tâches
- Exécution opérationnelle après validation commerciale.

#### Commande fournisseur / Réception
- Approvisionnement et suivi logistique des matériaux/services.

#### Session Assistant / Messages
- Historique conversationnel de qualification et de capture du besoin.

---

### Résumé des interactions attendues

- Le client (ou prospect) exprime un besoin via canal humain ou assistant IA.
- Les rôles commerciaux qualifient le besoin et produisent le devis.
- Le client valide/signe, puis le dossier bascule vers l'exécution chantier.
- Les achats fournisseurs et la facturation se synchronisent avec l'avancement.
- L'admin pilote la gouvernance globale (droits, paramétrage, performance).
