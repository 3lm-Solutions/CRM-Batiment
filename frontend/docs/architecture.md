# Architecture — crm-batiment-web

Application React 19 + Vite 7 + Tailwind 4 + TanStack Query. Elle appelle l'API du dépôt
**crm-batiment-api** (`/api/v1`) ; le contrat commun est dans `src/shared/` (voir `contract.md`).

## Code (`src`)

```
main.tsx                     Providers (TanStack Query, routeur, toasts)
app/                         router.tsx (toutes les routes), navigation.ts (menu par rôle), guards
layouts/                     AppLayout (barre latérale + en-tête), AuthLayout (connexion)
lib/                         api.ts (SEUL client HTTP), format.ts, query-client.ts, socket.ts
components/ui/               Kit d'interface : Button, Input/Select/Textarea, Card, DataTable,
                             Modal/ConfirmDialog, Badge/StatusBadge, Pagination, Tabs, états
components/signature/        Pavé de signature (profil conseiller + page client)
lib/files.ts                 Dépôt de fichiers + ouverture authentifiée (blob) ; components/files/AuthImage
features/<domaine>/
  api.ts                       hooks TanStack Query — les pages n'appellent jamais axios
  *Page.tsx                    pages ; composants propres au domaine à côté
  domaines : auth, users, clients, catalogue, devis, demandes, public (lien devis),
  chantiers, rapports, factures, commandes, stock, sous-traitants, sav, audit, dashboard,
  demo, portail-st, portail-fournisseur, espace-client, fournisseurs,
  assistant (chatbot public, prospects, base de connaissances),
  devis/DevisIaModal (Devis IA, étape 15), demo/sandbox.ts (démo en ligne, étape 15)
```

Routes : bureau sous `AppLayout` ; comptes extérieurs (sous-traitant, fournisseur) sous
`/portail/*` dans le même `AppLayout` (menu « Mon espace ») ; pages publiques hors layout :
`/login`, `/demo`, `/chat`, `/devis/lien/:token`, `/espace-client/:token`.

Règles : une page = un fichier ; toute requête passe par `features/*/api.ts` ;
toute liste utilise `DataTable` + `Pagination` + `SearchInput` ; les statuts s'affichent
avec `StatusBadge` (libellés et couleurs à un seul endroit) ; les erreurs API sont lues
avec `errorMessage()` (format d'erreur standard du backend).


## Design (repris de l'ancien frontend BÂTIFLOW)

| Élément | Règle |
|---|---|
| Nom | `src/lib/brand.ts` (BÂTIFLOW) — le seul endroit à changer pour renommer le produit. |
| Couleurs | `brand-700` = bleu primaire (#185FA5), `brand-900` = #143B68, `brand-500` = #2380B8, `brand-100` = fonds doux. Fond de page bleu très clair en dégradé. Tout est dans `src/index.css`. |
| Barre latérale | `.sidebar-gradient` (bleu #143B68 → #185FA5 → #2380B8), 292 px ; groupes Pilotage / Commercial / Référentiel / Administration / Compte ; chaque lien : carré d'icône, libellé + description, chevron sur l'actif ; carte profil + déconnexion en bas. |
| En-tête | Blanc translucide : petite étiquette de l'espace (« Administration »…) + titre de la route, boutons lune et cloche arrondis, menu du compte (profil, déconnexion). |
| Titre de page | `PageHeader` dans la page : grand titre, sous-titre, actions à droite, filtres (`toolbar`) en dessous. |
| Tableau de bord | `WelcomeBanner` : « Bonjour, prénom 👋 » sur dégradé violet clair → bleu clair (`.batiflow-gradient`). |
| Cartes | `Card` : blanc, `rounded-2xl` ; `CardHeader` sur bande gris clair. |
| Boutons | `rounded-xl`, primaire en dégradé bleu (`.brand-gradient`). Onglets en pastilles. |
| Tableaux | `DataTable` : en-tête 11 px gras en capitales, survol bleuté. |
| Connexion | Carte en deux parties : marque sur dégradé bleu à gauche, formulaire à droite (champs bleu clair). |
| Accueil public `/` | `features/public/LandingPage.tsx` : barre flottante, grand titre en dégradé, aperçu du tableau de bord, fonctionnalités, appel à la démo, bulle du chatbot. |

Le mode sombre reste disponible (bouton lune dans l'en-tête).
