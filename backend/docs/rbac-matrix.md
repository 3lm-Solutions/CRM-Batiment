# Matrice RBAC (P0.7)

**Principe :** toute route est protégée par défaut (`JwtAuthGuard` + `RolesGuard` globaux).
Une route sans `@Roles(...)` ni `@Public()` est refusée (403), même pour l'ADMIN.
Le test `test/rbac-coverage.e2e-spec.ts` échoue si une route oublie l'un des deux.

Le rôle et l'entreprise sont relus **en base** à chaque requête : un changement de rôle ou une
désactivation prend effet immédiatement.

## Rôles

| Rôle | Périmètre |
|---|---|
| `ADMIN` | Administration complète de l'entreprise |
| `TECHNICO` | Commercial : clients, demandes, devis, signatures, factures, catalogue (lecture), commandes |
| `ASSISTANTE` | Administratif : clients, demandes, suivi des devis, factures, chantiers, documents |
| `CHEF_CHANTIER` | Opérationnel : **ses** chantiers, tâches, réceptions de matériaux, documents |
| `SOUS_TRAITANT` | Portail : **ses** chantiers et tâches, rapports et photos — jamais de prix ni de marges |
| `FOURNISSEUR` | Portail : **ses** commandes fournisseur — *nouveau en v2* (avant : compte SOUS_TRAITANT retrouvé par email) |

## Matrice par domaine

Légende : **C** créer · **L** lire · **M** modifier · **S** supprimer · **A** actions métier (envoyer, signer…) · — aucun accès

| Domaine | ADMIN | TECHNICO | ASSISTANTE | CHEF_CHANTIER | SOUS_TRAITANT | FOURNISSEUR | Étape |
|---|---|---|---|---|---|---|---|
| Mon profil, mot de passe | LM | LM | LM | LM | LM | LM | 4 ✅ |
| Ma signature (conseiller) | LMS | LMS | LMS | LMS | — | — | 4 ✅ |
| Utilisateurs | CLMS | — | — | — | — | — | 4 ✅ |
| Liste des utilisateurs (sélecteurs) | L | L | L | L | — | — | 4 ✅ |
| Clients (S = archiver ; suppression définitive : ADMIN, sans historique) | CLMS | CLM + archiver | CLM + archiver | L | — | — | 5 ✅ |
| Types de projet | CLMS | L | L | L | — | — | 5 ✅ |
| Catalogue (prestations, matériaux, MO, options) | CLMS | L | L | L | — | — | 5 ✅ |
| Chiffrage d'une prestation (coûts, marges) | A | A | A | — | — | — | 5 ✅ |
| Coordonnées et réglages de l'entreprise | LM | L | L | L | — | — | 5 ✅ |
| Fournisseurs | CLMS | L | L | — | — | — | 5 ✅ |
| Demandes de devis (A = prendre en charge, qualifier, perdre ; conversion : ADMIN, TECHNICO) | CLMSA | CLMA | CLMA (sans conversion) | — | — | — | 6 ✅ |
| Devis (A = envoyer, réviser, annuler, demander la signature, signer ; S = brouillon jamais envoyé, ADMIN) | CLMSA | CLMA | CLMA | L ses chantiers, **sans montants** | — | — | 6 ✅ |
| Factures (A = émettre, envoyer, payer, annuler/avoir ; situations, finale) | CLMSA | CLMA | CLMA | L ses chantiers | — | — | 8 ✅ |
| Chantiers (A = démarrer, suspendre, terminer ; clôturer : bureau) | CLMSA | L | CLMA | LMA les siens | L ouverts à son compte | — | 8 ✅ |
| Tâches | CLMS | L | CLMS | CLMS ses chantiers | avancement de SES tâches, chantiers ouverts à son compte | — | 8 ✅ / 11 ✅ |
| Commandes fournisseur (A = envoyer, réceptionner, clôturer, annuler) | CLMSA | CLMA | CLMA | L + réception, ses chantiers | — | L SES commandes envoyées + accuser réception, expédier | 8 ✅ / 11 ✅ |
| Stock (mouvements : entrée, sortie, inventaire) | LA | LA | LA | LA | — | — | 8 ✅ |
| Sous-traitants (fiche, contrats, assurances, paiements, disponibilités) | CLMSA | — | L | L + noter | — | — | 9 ✅ |
| SAV (A = prendre en charge, attente client, résoudre, clôturer, rouvrir ; chef : ses chantiers ou tickets assignés) | CLMA | CLMA | CLMA | CLMA | — | — | 10 ✅ |
| Historique / audit | L | — | — | — | — | — | 10 ✅ |
| Notifications (les siennes uniquement ; temps réel socket.io) | LM | LM | LM | LM | LM | LM | 10 ✅ |
| Tableau de bord | L | — | — | — | — | — | 10 ✅ |
| Demandes de démo | LMA | LMA | — | — | — | — | 10 ✅ |
| Fichiers (dépôt : `POST /fichiers`) | C | C | C | C | via son portail (photos de rapport) | — | 11 ✅ |
| Fichiers (lecture `GET /fichiers/:id/contenu`) | L | L | L | L ses chantiers + non rattachés | L chantiers ouverts à son compte + les siens | L les siens | 11 ✅ |
| Documents de chantier (lien ou fichier déposé) | CLS | L | CLS | CLS ses chantiers | L (portail) | — | 8 ✅ / 11 ✅ |
| Rapports de chantier (texte + photos) | L + valider/renvoyer | L | L + valider/renvoyer | L + valider/renvoyer, ses chantiers | C + L les siens | — | 11 ✅ |
| Portail sous-traitant (`/portail/sous-traitant/*`) | — | — | — | — | LA | — | 11 ✅ |
| Portail fournisseur (`/portail/fournisseur/*`) | — | — | — | — | — | LA | 11 ✅ |
| Espace client : envoyer / désactiver le lien | A | A | A | — | — | — | 11 ✅ |
| Assistant IA — prospects du chatbot (A = qualifier en demande de devis, rejeter, rouvrir) | LMA | LMA | LMA | — | — | — | 14 ✅ |
| Assistant IA — base de connaissances | CLMS | L | L | — | — | — | 14 ✅ |
| Assistant IA — journal des erreurs | L | — | — | — | — | — | 14 ✅ |
| Devis IA — proposer / ajouter des lignes (devis modifiable) | A | A | A | — | — | — | 15 ✅ |

## Routes publiques (`@Public()`)

Elles valident elles-mêmes un jeton, une expiration ou un périmètre dans le service.

| Route | Protection |
|---|---|
| `GET /health` | aucune donnée sensible |
| `POST /auth/login`, `/forgot-password`, `/verify-reset-code`, `/reset-password` | limite 3–5 requêtes / minute / IP |
| Lien client d'un devis `/public/devis/:token` | jeton de 256 bits (haché en base) + version du devis + expiration ; signature protégée par un code à usage unique envoyé par email (5 essais) ; aucun coût ni marge dans la réponse |
| `POST /public/demo-requests` | 3 requêtes / minute / IP + champ piège anti-robot |
| Espace client `/public/espace-client/:token` (lecture, `devis/:id`, `factures/:id`, `POST sav`, `POST sav/:id/messages`) | jeton de 256 bits (haché en base), 90 jours, révocable, un nouveau lien désactive les précédents ; même réponse 410 pour un lien inconnu, expiré ou révoqué ; uniquement les devis envoyés et les factures émises du client ; jamais de coûts, marges ni notes internes ; 60 lectures et 5 écritures / minute / IP |
| Démo en ligne `/public/demo` (étape 15) | `GET` : indique si l'instance est la démo ; `POST connexion` : session sans mot de passe **uniquement si `DEMO_MODE=true`** (sinon 404), 10 / minute / IP ; `DEMO_MODE` est refusé au démarrage si le nom de la base ne contient pas « demo » |
| Chatbot `/public/assistant/sessions…` (étape 14) | jeton de conversation de 256 bits (haché), en-tête `X-Chat-Token`, même 404 pour un id inconnu ou un mauvais jeton, conversation de 7 jours max, 40 messages ; 10 conversations, 15 messages, 5 formulaires / minute / IP ; réponses filtrées (jamais de prix ni de donnée interne) |
| Webhook WhatsApp (étape 15) | signature Meta (`rawBody`) |

## Temps réel

`socket.io`, espace `/notifications`, jeton dans `auth.token` à la connexion. Mêmes contrôles que
l'API HTTP (`SessionValidator`) : un compte désactivé ou un jeton révoqué est déconnecté.

## Groupes de rôles (code)

`src/common/auth/role-groups.ts` : `ALL_ROLES`, `STAFF` (interne), `BUREAU` (ADMIN, TECHNICO, ASSISTANTE), `PORTAL` (SOUS_TRAITANT, FOURNISSEUR).

## Portails (étape 11) — règle unique par type de compte

| Compte | Ce qu'il voit | Comment c'est garanti |
|---|---|---|
| SOUS_TRAITANT | les chantiers **ouverts à son compte** (`ChantierSousTraitant`, ajouté automatiquement quand on lui affecte une tâche), leurs tâches et documents ; ses rapports ; son dossier (assurances, SES contrats) | toutes les requêtes du portail filtrent `sousTraitantsVisibles: { some: { userId } }` ; aucun prix, devis, facture, téléphone client ni note interne n'est sélectionné |
| FOURNISSEUR | **ses** commandes (hors brouillons), ses prix, l'adresse de livraison | compte lié par `Fournisseur.userId` (l'ancien portail associait par email : un compte avec le même email voyait les commandes) |
| Client (sans compte) | ses devis envoyés, ses factures émises, l'avancement de ses chantiers, ses tickets SAV (seulement ses propres messages) | lien `ClientEspaceLien` envoyé par le bureau |

