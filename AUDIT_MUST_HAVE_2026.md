# Audit MUST-HAVE CRM/ERP Batiment 2026

Source: document "Fonctionnalites MUST-HAVE d'un CRM / ERP batiment intelligent en 2026".

Contexte codebase observe:
- Frontend: React + Vite + TypeScript.
- Backend: NestJS + Prisma + PostgreSQL.
- Modules deja visibles: clients, demandes de devis, devis, signature, factures, chantiers, taches, equipes, fournisseurs, commandes fournisseur, assistant IA/RAG.

## Comment noter chaque fonctionnalite

Pour chaque ligne, remplir:
- FAIT: modele de donnees + API + UI + permissions + workflow metier + tests existent et sont utilisables.
- PARTIEL: un ou plusieurs morceaux existent, mais le parcours complet est incomplet.
- ABSENT: pas de modele, pas d'API, pas d'ecran, ou seulement du texte/maquette.

Profondeur conseillee:
- 0: absent.
- 1: donnees statiques ou maquette.
- 2: CRUD basique.
- 3: workflow metier utilisable.
- 4: workflow robuste avec roles, audit, erreurs, tests.
- 5: workflow automatise, mesure, mobile/offline ou IA selon le cas.

## Partie 1 - Questions de diagnostic technique

| # | Fonctionnalite MUST-HAVE | Question de diagnostic precise a poser dans le code |
|---|---|---|
| 1 | CRM Commercial Intelligent | En partant d'un `Client` ou d'une `DemandeDevis`, puis-je retracer tout le cycle prospect -> qualification -> pipeline -> relances -> devis multiples -> signature -> portail client, avec interactions appels/emails/WhatsApp, historique complet, scoring lead et prevision de signature ? Chercher les modeles `Interaction`, `Reminder`, `PipelineStage`, `LeadScore`, `Forecast`, les endpoints, les ecrans et les tests. |
| 2 | Generation IA de devis | Existe-t-il un flux complet entree libre/photo/video/PDF/WhatsApp -> extraction du besoin -> proposition de prestations/materiaux -> calcul cout/marge/prix -> creation d'un devis versionne et validable par un humain ? Verifier si le code actif fait plus qu'un assistant texte ou un chiffrage catalogue. |
| 3 | Gestion Chantier Temps Reel | Un chef de chantier peut-il gerer planning equipes, taches, avancement, pointage, photos, checklists, incidents, geolocalisation, materiel et journal chantier automatique depuis des APIs et ecrans reels ? Verifier aussi si les mises a jour sont temps reel ou seulement CRUD. |
| 4 | Application Mobile Terrain | Existe-t-il une application mobile native ou PWA terrain avec auth, taches, pointage, photos, PV/signature, scan documents, notes vocales, plans et mode hors ligne intelligent ? Si tout est web desktop, noter ABSENT meme si les APIs existent. |
| 5 | Assistant IA integre | L'assistant peut-il executer des actions metier securisees sur les donnees de l'entreprise: resumer chantier, lister retards de paiement, preparer devis, detecter risques, generer compte rendu, comprendre documents/photos/voix/historique ? Verifier outils IA, RAG, permissions, logs et garde-fous. |
| 6 | Comptabilite & Finance connectees | La plateforme couvre-t-elle factures, acomptes, situations travaux, TVA, rentabilite chantier, tresorerie, prevision cashflow, rapprochement bancaire et relances automatiques ? Distinguer facturation simple et finance connectee. |
| 7 | Dashboard Dirigeant Temps Reel | Existe-t-il des KPIs fiables et agreges: marge par chantier, rentabilite equipes, retards, tresorerie, devis signes, conversion, SAV ouverts, risques, alertes IA, previsions et comparaisons historiques ? Verifier endpoints d'agregation, filtres temporels et donnees source. |
| 8 | Gestion SAV & Maintenance | Y a-t-il des tickets SAV, garanties, interventions, maintenance preventive, historique equipements et rappels automatiques ? Verifier modeles `Ticket`, `Intervention`, `Garantie`, `Equipement`, workflow et ecrans. |
| 9 | WhatsApp Business integre | Existe-t-il une integration WhatsApp Business reelle: webhook entrant, conversations centralisees, templates, envoi devis, rappels, photos chantier, chatbot IA et notifications equipes ? Distinguer un champ telephone ou SMS d'une vraie messagerie integree. |
| 10 | OCR + Analyse Documents | Y a-t-il un pipeline upload document -> OCR -> classification -> extraction -> validation humaine -> liaison a facture/plan/fournisseur/chantier/devis ? Verifier factures, plans, metres, fournisseurs et classement automatique. |
| 11 | Gestion Sous-traitants | Au-dela du role `SOUS_TRAITANT`, peut-on gerer contrats, documents legaux, assurances, paiements, disponibilites, affectations, qualite et notation ? Verifier portail, droits d'acces et donnees de conformite. |
| 12 | Gestion Stock & Materiel | Existe-t-il un inventaire outils/materiaux avec QR codes, mouvements, pertes, consommation chantier, seuils, commandes automatiques et historique ? Distinguer catalogue prix/materiaux et stock reel. |
| 13 | BIM / Plans Intelligents | La plateforme gere-t-elle plans 2D/3D, versions, annotations, collaboration, lien tache <-> plan, et detection de conflits ou integration Revit/IFC ? Verifier viewer, stockage fichiers, annotations et modele `Plan`. |
| 14 | Automatisation Workflow | Y a-t-il un moteur d'evenements ou de regles idempotent: devis signe -> chantier, retard paiement -> relance, photo probleme -> ticket SAV, fin chantier -> facture ? Verifier jobs, outbox, logs, retry et configuration. |
| 15 | IA Predictive | La plateforme collecte-t-elle assez d'evenements historiques pour predire retard chantier, depassement budget, client a risque, panne materiel, manque stock et marge finale ? Verifier features, scores, seuils, feedback utilisateur et evaluation. |

Questions transverses a poser pour chaque item:
- Donnees: le schema Prisma contient-il les entites necessaires ?
- API: existe-t-il des endpoints proteges, documentes et testes ?
- UI: existe-t-il un ecran utilisable par le bon role ?
- Workflow: le parcours complet marche-t-il de bout en bout ?
- Qualite: y a-t-il tests, audit logs, validation DTO, erreurs claires, RBAC et multi-entreprise ?
- Mobile/offline: la fonctionnalite est-elle disponible sur le terrain sans reseau ?
- IA: l'IA est-elle seulement conversationnelle ou connectee a des actions metier ?

## Partie 2 - Organisation ete avec stagiaires

Decision: prendre 3 stagiaires.

Raison: une version mobile complete plus les manques 2026 couvrent backend, mobile, IA, integrations, offline sync et tableaux de bord. Avec 2 stagiaires, il faudrait repousser WhatsApp, OCR, IA predictive et une partie du mode hors ligne.

### Roles recommandes

| Stagiaire | Perimetre principal | Livrables attendus |
|---|---|---|
| A | Backend, API, donnees, workflows | Schema Prisma, endpoints NestJS, RBAC, fichiers, endpoints de sync mobile, jobs automatiques, tests API. |
| B | App mobile terrain | App React Native/Expo, navigation, auth, taches, pointage, photos, signature, scan, plans, offline local. |
| C | IA, integrations, dashboard | Assistant outille, WhatsApp, OCR, KPI dirigeant, alertes, premiers scores predictifs. |

### Decoupage par fonctionnalite a developper si ABSENT ou PARTIEL

| Fonctionnalite | Stagiaire A - Backend/API | Stagiaire B - Mobile | Stagiaire C - IA/integrations |
|---|---|---|---|
| CRM Commercial Intelligent | Pipeline, interactions, relances, historique, endpoints client/devis. | Consultation mobile prospect/client si utile terrain. | Scoring lead, forecast signature, resume historique. |
| Generation IA de devis | API brouillon devis, versions, validation humaine, stockage pieces jointes. | Capture photo/video/audio et formulaire terrain. | Extraction IA, matching catalogue, prix/marges suggeres, WhatsApp -> devis. |
| Gestion Chantier Temps Reel | Checklists, incidents, pointage, journal chantier, geoloc, photos. | Ecrans taches, pointage, photo, checklist, incident. | Alertes anomalies, resume chantier, risque retard. |
| App Mobile Terrain | Endpoints mobile, sync tokens, delta sync, upload fichiers. | Lead complet: app, offline, camera, signature, scan, plans. | Voix -> texte, aide IA terrain, OCR scan. |
| Assistant IA integre | Tools backend securises, journal des actions IA. | Interface mobile assistant terrain simple. | RAG, prompts, outils metier, resume, compte rendu, actions. |
| Comptabilite & Finance | Situations travaux, echeances, relances, cashflow, export. | Consultation factures/solde client si necessaire. | Detection retards, relances auto, prevision cashflow. |
| Dashboard Dirigeant | Endpoints agreges KPI, caches, filtres. | Vue mobile dirigeant minimale. | Alertes IA, comparaison historique, narratif KPI. |
| SAV & Maintenance | Tickets, garanties, interventions, equipements, rappels. | Creation ticket depuis photo terrain, suivi intervention. | Photo probleme -> ticket, priorisation IA. |
| WhatsApp Business | Webhooks, stockage conversations, envoi templates, statut messages. | Notifications terrain si retenu. | Chatbot IA, qualification prospect, devis/rappels WhatsApp. |
| OCR + Documents | Upload, stockage, metadonnees, file processing, validation. | Scan document mobile et queue offline upload. | OCR, classification, extraction facture/plan/metre. |
| Sous-traitants | Contrats, assurances, disponibilite, notation, paiements. | Portail mobile sous-traitant: taches, photos, avancement. | Scoring qualite, alertes documents expires. |
| Stock & Materiel | Inventaire, mouvements, QR, seuils, commandes auto. | Scan QR, sortie/retour materiel, consommation chantier. | Prediction manque stock, recommandations commande. |
| BIM / Plans | Stockage plans, versions, annotations, lien taches. | Viewer plans offline, annotations simples. | Analyse plan/OCR, detection basique incoherences. |
| Workflow Automation | Event log, jobs, outbox, regles configurees. | Affichage et resolution des actions terrain. | Autopilot administratif, generation messages/documents. |
| IA Predictive | Dataset evenements, snapshots, endpoints risk scores. | Remontee donnees terrain fiables. | Modeles/heuristiques retard, budget, client, marge. |

### Calendrier 8 semaines

| Periode | Objectif | A Backend/API | B Mobile | C IA/integrations |
|---|---|---|---|---|
| Semaine 1-2 | Setup, audit, contrats API | Cartographier schemas, definir OpenAPI mobile, RBAC, conventions tests. | Initialiser app, auth, navigation, design system, stockage local. | Cartographier assistant, RAG, OCR/WhatsApp, definir prompts/outils. |
| Semaine 3-4 | Premier livrable vertical | APIs taches/checklists/photos/incidents + sync read. | Mobile login, liste chantiers/taches, detail tache, cache offline lecture. | KPI dashboard v1 + assistant chantier resume + OCR ou WhatsApp skeleton. |
| Semaine 5-6 | Deuxieme livrable metier | Pointage, geoloc, journal chantier, SAV v1, workflows devis signe -> chantier. | Pointage, photo offline, signature PV, scan document, queue upload. | Devis IA v1 depuis photo/texte, alertes risques v1, relances auto v1. |
| Semaine 7-8 | Integration et tests | Tests e2e, hardening sync, logs, performances, seed demo. | Tests terrain Android/iOS, resolution conflits, UX offline, packaging. | Tests IA, garde-fous, monitoring couts/erreurs, demo dirigeant. |

### Prerequis techniques

Stagiaire A:
- TypeScript avance, NestJS, Prisma, PostgreSQL.
- REST, DTO validation, JWT/RBAC, tests Jest/Supertest.
- Upload fichiers, transactions, migrations, jobs/queues.

Stagiaire B:
- React Native/Expo, React/TypeScript, React Query.
- Navigation mobile, formulaires, camera, fichiers, geoloc, signature.
- SQLite local, gestion offline, synchronisation, UX mobile terrain.

Stagiaire C:
- TypeScript backend, SQL de base, APIs externes/webhooks.
- LLM/RAG, OCR, prompt/tool design, evaluation IA.
- Dashboard/KPI, securite donnees, logs et couts d'inference.

## Partie 3 - Feuille de route priorisee apres vos reponses

Regle de priorisation:
- P0: bloque l'usage terrain ou la collecte de donnees.
- P1: impact business direct TOP 1 a TOP 5.
- P2: rend le produit complet ou monnayable.
- P3: innovation lourde, a faire quand les donnees et workflows sont stables.

Priorisation provisoire avant vos reponses d'audit:

| Priorite | Chantier | Impact | Complexite | Dependances | A confier a |
|---|---|---:|---:|---|---|
| P0 | App mobile terrain offline | 5 | 4 | APIs mobile, auth, sync, fichiers | Stagiaire B + A, supervision vous/Codex |
| P0 | Gestion chantier temps reel terrain | 5 | 4 | taches, pointage, photos, checklists | Stagiaires A+B |
| P1 | TOP 1 - Devis IA depuis photo/video | 5 | 5 | catalogue fiable, upload, OCR/vision, validation devis | Vous/Codex + C, A en support |
| P1 | TOP 5 - Autopilot administratif | 5 | 3 | event log, jobs, templates mail/WhatsApp | A+C, supervision vous/Codex |
| P1 | Dashboard dirigeant + alertes | 5 | 3 | donnees propres factures/devis/chantiers | C+A |
| P1 | TOP 2 - Chef de chantier IA autonome | 5 | 5 | mobile terrain, journal chantier, assistant outille | Vous/Codex + C |
| P2 | WhatsApp Business integre | 4 | 4 | opt-in, webhooks, templates, conversations | C+A |
| P2 | OCR + analyse documents | 4 | 4 | upload, stockage, validation humaine | C+A+B pour scan |
| P2 | Comptabilite & finance connectees | 4 | 4 | factures propres, echeances, paiements | A, puis C pour previsions |
| P2 | SAV & maintenance | 3 | 3 | incidents/photos/clients/equipements | A+B, C pour photo -> ticket |
| P2 | Stock & materiel | 3 | 3 | materiaux, commandes, QR mobile | A+B |
| P2 | Sous-traitants avances | 3 | 2 | users/roles/equipes deja presents | A+B |
| P3 | TOP 3 - Planning IA automatique | 5 | 5 | pointage historique, durees reelles, disponibilites | Vous/Codex + C apres ete |
| P3 | TOP 4 - Vision IA chantier | 5 | 5 | photos chantier standardisees, etiquetage, mobile | Vous/Codex + C apres collecte |
| P3 | IA predictive globale | 4 | 5 | historique fiable et volumineux | Vous/Codex |
| P3 | BIM / plans intelligents | 3 | 5 | viewer plans, stockage versions, annotations | Apres stabilisation terrain |

Ce que les stagiaires doivent faire:
- CRUD metier bien delimite.
- Ecrans mobile terrain.
- Endpoints et tests sur parcours simples.
- POC IA/OCR sous garde-fous.

Ce que vous/Codex devez garder:
- Architecture sync offline et contrats API.
- Securite/RBAC/multi-tenant et donnees sensibles.
- Workflows automatiques critiques.
- Decisions IA: prompts, outils, evaluation, couts, erreurs.
- Revue code et integration finale.

## Partie 4 - Version mobile

### Stack recommandee

Choix: React Native avec Expo, TypeScript.

Pourquoi:
- Votre web est deja React + TypeScript, donc l'equipe reutilise les memes concepts.
- Possibilite de partager types, schemas de validation, clients API et logique metier pure.
- Expo accelere camera, fichiers, geoloc, build et tests sur appareils.
- React Query peut garder une coherence mentale entre web et mobile.

Flutter serait defensible si votre equipe avait deja une forte competence Dart/Flutter ou si vous vouliez une UI mobile totalement separee. Dans votre contexte, React Native reduit le cout de formation et le risque d'integration.

Architecture proposee:
- `mobile/`: app Expo React Native.
- `packages/shared/` ou `frontend/src/types` extrait proprement: types API, constantes statuts, helpers calculs purs.
- Backend NestJS: namespace `/api/mobile/*` ou endpoints existants durcis pour mobile.
- Auth: JWT access token court + refresh token, stockage securise mobile.
- Fichiers: upload multipart ou signed URLs, compression image cote mobile.
- Sync: endpoints delta par table metier, queue mutations, conflict policy.
- Observabilite: logs sync, erreurs upload, version app, device id.

### Top 8 fonctionnalites mobiles

1. Auth + choix role terrain.
2. Liste chantiers et taches du jour.
3. Detail tache avec statut, commentaire, avancement.
4. Pointage arrivee/depart/pause avec geoloc optionnelle.
5. Photos chantier/incidents avec upload differe.
6. Checklists et incidents.
7. Signature PV ou validation intervention.
8. Plans/documents consultables offline.

Ensuite:
- Scan documents.
- Note vocale -> texte.
- Assistant IA chantier.
- Stock/materiel par QR code.
- SAV depuis photo.

### Mode hors ligne

MVP recommande pour l'ete:
- Expo SQLite local.
- Tables locales: `chantiers`, `taches`, `checklists`, `incidents`, `photos_pending`, `pointages`, `documents`, `sync_queue`.
- React Query pour cache serveur, mais SQLite comme source offline durable.
- Queue de mutations: chaque action offline cree un evenement local avec `clientMutationId`.
- Sync pull: recuperer les deltas depuis `lastSyncedAt` par entreprise/utilisateur.
- Sync push: envoyer la queue dans l'ordre, avec idempotence cote serveur.
- Conflits: last-write-wins seulement pour champs non critiques; resolution explicite pour statut tache, pointage, signature et suppression.
- Upload fichiers: envoyer metadonnees d'abord, puis fichier; reprendre si echec.

Evolution apres MVP:
- WatermelonDB si volumes importants, listes reactives complexes et milliers de lignes.
- Sync engine dedie si plusieurs utilisateurs modifient les memes objets hors ligne avec conflits frequents.

### Partage de code estime

| Element | Reutilisation estimee |
|---|---:|
| Types TypeScript, enums, statuts | 70-90% |
| Client API, DTO, helpers format/calcul | 40-70% |
| Logique metier pure | 30-60% |
| Composants UI web | 0-15% |
| Pages/ecrans | 0-10% |
| Auth concepts et permissions | 50-70% |

Estimation globale realiste: 25-40% de reutilisation utile, surtout types, API et logique. Ne pas viser un partage massif des composants UI web.

### Repartition mobile par stagiaire

| Domaine mobile | Stagiaire A | Stagiaire B | Stagiaire C |
|---|---|---|---|
| Auth mobile | Endpoints, refresh, RBAC | Ecrans login/session | Controle securite prompts si assistant mobile |
| Chantiers/taches | APIs, filtres, delta sync | Ecrans liste/detail/action | Resume chantier IA |
| Offline sync | Endpoints delta, idempotence, conflits | SQLite, queue, retry, UX offline | Logs et analyse erreurs sync |
| Photos/documents | API upload, stockage, metadonnees | Camera, galerie, compression, upload differe | OCR/classification |
| Pointage/geoloc | Modeles, validation, audit | UI pointage, permission geoloc | Detection anomalies |
| Signature PV | API stockage signature/document | Canvas signature, PDF/preview | Resume PV automatique |
| Plans offline | API documents et droits | Download/cache/viewer | Analyse plan plus tard |
| Assistant terrain | Tools backend autorises | UI assistant mobile | Prompts, RAG, actions IA |

## Format de reponse attendu apres votre audit

Pour chaque fonctionnalite, repondre sous ce format:

```text
1. CRM Commercial Intelligent
Statut: FAIT / PARTIEL / ABSENT
Profondeur: 0-5
Preuves code: fichiers, endpoints, tables, ecrans
Limites: ...
Priorite perso: haute / moyenne / basse
```

Avec ces reponses, la roadmap peut etre transformee en backlog sprint par sprint, avec tickets backend/mobile/IA et criteres d'acceptation.
