# Matrice des Permissions par Rôle (RBAC) - BâtiFlow

Cette matrice documente de façon rigoureuse et exhaustive les droits d'accès fins sur les ressources et les endpoints du backend pour chaque rôle utilisateur au sein de la plateforme.

---

## 📊 1. Matrice Globale des Droits d'Accès

### Légende :
*   `🟢 Accès Total` : Droit complet de création, lecture, modification et suppression (CRUD).
*   `🟡 Accès Restreint` : Lecture seule, ou modification limitée par des règles métiers/d'affectation.
*   `🔴 Aucun Accès` : Ressource ou action totalement inaccessible (Erreur `403 Forbidden` / Visibilité masquée).

| Ressource / Action | ADMIN | TECHNICO *(Commercial)* | ASSISTANTE | CHEF_CHANTIER *(Terrain)* | SOUS_TRAITANT *(Partenaire)* |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **Demandes de Devis** | | | | | |
| - Consulter / Lister | 🟢 | 🟢 | 🟢 | 🔴 | 🔴 |
| - Modifier / Créer | 🟢 | 🟢 | 🟢 | 🔴 | 🔴 |
| - Convertir en Devis (P0.1) | 🟢 | 🟢 | 🔴 | 🔴 | 🔴 |
| **Devis** | | | | | |
| - Consulter / Lister | 🟢 | 🟢 | 🟢 | 🔴 | 🔴 |
| - Créer / Modifier | 🟢 | 🟢 | 🔴 | 🔴 | 🔴 |
| - Signer / Accepter | 🟢 | 🟢 | 🔴 | 🔴 | 🔴 |
| **Chantiers** | | | | | |
| - Consulter tous les chantiers | 🟢 | 🟡 *(Lecture seule)* | 🟢 | 🔴 | 🔴 |
| - Consulter ses chantiers affectés | 🟢 | 🟡 *(Lecture seule)* | 🟢 | 🟡 *(Sans détails financiers)* | 🟡 *(Assignés uniquement)* |
| - Créer / Affecter des chantiers | 🟢 | 🔴 | 🟢 | 🔴 | 🔴 |
| - Mettre à jour le statut/dates/notes | 🟢 | 🔴 | 🟢 | 🟡 *(Chantiers assignés)* | 🔴 |
| **Factures** | | | | | |
| - Consulter / Lister | 🟢 | 🔴 | 🟢 | 🔴 | 🔴 |
| - Créer depuis un Devis | 🟢 | 🔴 | 🔴 | 🔴 | 🔴 |
| - Valider / Envoyer / Marquer payée | 🟢 | 🔴 | 🟢 | 🔴 | 🔴 |
| **Matériaux & Prestations (Catalogue)** | | | | | |
| - Consulter le catalogue | 🟢 | 🟢 | 🟢 | 🟢 | 🔴 |
| - Gérer / Créer / Modifier | 🟢 | 🔴 | 🔴 | 🔴 | 🔴 |
| - Supprimer (si non utilisé) | 🟢 | 🔴 | 🔴 | 🔴 | 🔴 |
| **Paramètres Entreprise / Users** | | | | | |
| - Consulter les configurations | 🟢 | 🔴 | 🔴 | 🔴 | 🔴 |
| - Gérer les rôles et utilisateurs | 🟢 | 🔴 | 🔴 | 🔴 | 🔴 |

---

## 🔒 2. Règles Métier Relatives à la Sécurité & RBAC

### 1. Isolation des Entreprises (Multi-tenant)
Tous les contrôleurs NestJS appliquent un filtre strict sur le `companyId` extrait du JWT payload. Aucune donnée d'une entreprise tierce ne peut être lue, modifiée ou supprimée, garantissant une étanchéité totale des données clients.

### 2. Protection des Données Financières (Chef de Chantier & Sous-Traitant)
Lorsqu'un Chef de Chantier ou un Sous-traitant accède à la fiche détaillée d'un chantier qui lui est affecté, les détails financiers du devis source (total HT, total TTC, prix unitaires) sont automatiquement exclus de la réponse de l'API pour protéger la confidentialité commerciale de l'entreprise.

### 3. Cycle de Vie et Soft Delete des Matériaux
L'Administrateur peut supprimer ou désactiver un matériau du catalogue à condition que celui-ci ne soit lié à aucun devis ayant déjà le statut `SIGNE` ou `ACCEPTE`. Si le matériau est utilisé, l'action est rejetée par une règle de validation métier afin de préserver l'historique de facturation et de chiffrage.

### 4. Droits d'Édition des Chantiers (Assistante vs Chef de Chantier)
*   L'**Assistante** et l'**Admin** peuvent modifier tous les chantiers sans restriction d'affectation pour assurer la souplesse administrative.
*   Le **Chef de Chantier** ne peut éditer (statut, dates, notes) que les chantiers pour lesquels son ID utilisateur est configuré en tant que `chefChantierId`. Toute modification sur un autre chantier renvoie une erreur `403 Forbidden`.
