# Contrat API ↔ web (`src/shared/`)

Les deux dépôts ont le même dossier `src/shared/` :

| Fichier | Contenu |
|---|---|
| `roles.ts` | `Role`, `ROLE_LABELS` — identiques à l'enum Prisma `Role` (test `src/prisma/prisma-enums.spec.ts` côté API) |
| `api.ts` | `PaginatedResponse`, `PaginationMeta`, `ApiErrorResponse`, `HealthResponse` |
| `auth.ts` | `SessionUser`, `LoginResponse`, `PASSWORD_POLICY`, `isPasswordChangeRequired` |
| `company.ts` | `CompanySettings` |

Règle : **on modifie d'abord l'API, puis on copie le fichier dans le web** (même contenu).
Ces fichiers ne contiennent que des types et des constantes, sans dépendance.

```bash
# depuis le dossier qui contient les deux dépôts
cp crm-batiment-api/src/shared/*.ts crm-batiment-web/src/shared/
```

Les types propres à une page (réponses de `/devis`, `/chantiers`…) restent dans
`features/<domaine>/api.ts` du web : ils décrivent ce que le front lit, pas le contrat global.
