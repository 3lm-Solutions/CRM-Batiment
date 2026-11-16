# CRM Intelligent - Société de Bâtiment

## Description
CRM complet pour société de bâtiment en France. Gestion du cycle : Client → Besoin → Devis → Achats → Chantier → Suivi → Clôture.

## Architecture technique
- **Frontend** : React + Vite + TypeScript + Ant Design
- **Backend** : NestJS + TypeORM + PostgreSQL
- **IA** : Chatbot NLP (API dédiée)
- **BI** : Microsoft Power BI (connexion PostgreSQL)

## Structure du projet
```
crm-batiment/
├── backend/          # API REST NestJS
│   ├── src/
│   │   ├── modules/  # Modules métier
│   │   ├── auth/     # Authentification JWT + RBAC
│   │   ├── common/   # Utilitaires partagés
│   │   └── config/   # Configuration
│   └── ...
├── frontend/         # Application React
│   ├── src/
│   │   ├── pages/    # Pages de l'application
│   │   ├── components/
│   │   ├── services/ # Appels API
│   │   └── ...
│   └── ...
└── README.md
```

## Modules fonctionnels
- **Module A** : Gestion clients / prospects / chantiers
- **Module B** : Qualification du besoin
- **Module C** : Catalogue de prestations
- **Module D** : Bibliothèque de prix & marges
- **Module E** : Gestion des devis (Quote Engine)
- **Module F** : Validation & transformation du devis
- **Module G** : Gestion fournisseurs & commandes
- **Module H** : Gestion du chantier (projets & tâches)
- **Module I** : Suivi d'avancement & tableau de bord
- **Module J** : Export & archivage

## Lancement

### Backend
```bash
cd backend
npm install
npm run start:dev
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

## Prérequis
- Node.js >= 18
- PostgreSQL >= 15
- npm >= 9
=======
# CRM-BTP
