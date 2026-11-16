# Démo en ligne et données d'exemple (étape 15)

## Données d'exemple en développement

```bash
pnpm db:seed          # entreprise, 6 comptes, catalogue, base de connaissances
pnpm demo:exemples    # + 6 clients, demandes, devis, 2 chantiers, acomptes, SAV, prospects du chatbot
```

`demo:exemples` passe par les **vrais services** (devis → envoi → signature → chantier + acompte
+ commandes fournisseur) : la démo montre exactement ce que fait l'application. Il ne fait rien si
les exemples sont déjà présents (client `sophie.martin@example.com`). Refusé en production.

Les emails des exemples vont vers `@example.com` (domaine réservé, aucune boîte réelle).

## Démo publique (bac à sable)

Une **instance séparée** de l'API + du web, avec sa propre base, où n'importe qui essaie le CRM :

| Quoi | Comment |
|---|---|
| Accès | page de connexion : un bouton par rôle, **sans mot de passe** (`POST /public/demo/connexion`) |
| Remise à zéro | chaque nuit à **3 h (heure de Paris)** : toute la base et les fichiers sont effacés puis rechargés |
| Emails | jamais envoyés (affichés dans la console de l'API), même si `MAIL_HOST` est rempli |
| Bandeau | « Démo en ligne — données fictives… » en haut de chaque page |
| Données | partagées entre visiteurs jusqu'à la remise à zéro |

### Mise en place

1. Une base dédiée dont le **nom contient « demo »** :
   ```sql
   CREATE DATABASE crm_batiment_demo OWNER crm;
   ```
2. `.env` de l'instance de démo :
   ```env
   DATABASE_URL=postgresql://crm:crm@localhost:5432/crm_batiment_demo?schema=public
   DEMO_MODE=true
   MAIL_HOST=
   ```
3. `pnpm db:deploy` (migrations), puis `pnpm start:prod` : au premier démarrage sur une base vide,
   la démo se charge toute seule. Pour la recharger à la main : `pnpm demo:reset`.
4. Sur le site principal, `VITE_DEMO_URL=https://demo.mon-crm.fr` (web) affiche
   « Essayez tout de suite la démo en ligne » sur la page `/demo`.

### Sécurité

- `DEMO_MODE=true` sur une base dont le nom ne contient pas « demo » : **l'API refuse de démarrer**
  (protection contre l'effacement d'une vraie base).
- Hors démo, `POST /public/demo/connexion` répond 404.
- Un visiteur peut désactiver ou modifier un compte de démo : la connexion suivante le rétablit.
- Avec `OPENAI_API_KEY`, chatbot et Devis IA consomment votre quota : laissez-la vide sur la démo
  si vous voulez un coût nul (mode guidé).
