# RBAC Matrix

All internal API endpoints require `JwtAuthGuard` and `RolesGuard`. Every protected controller or method must declare `@Roles(...)`; the `RolesGuard` denies protected routes with no role metadata.

## Roles

| Role | Access scope |
| --- | --- |
| `ADMIN` | Full company administration and business operations |
| `ASSISTANTE` | Clients, requests, quotes, invoices, chantier operations, suppliers and catalogue reading |
| `TECHNICO` | Clients, requests, quotes, invoices, supplier operations and catalogue |
| `CHEF_CHANTIER` | Assigned chantier operations, tasks, chantier plans and operational read access |
| `SOUS_TRAITANT` | Only the subcontractor portal, assigned/shared chantiers, assigned tasks and supplier portal operations |

## Endpoint Matrix

| Area | ADMIN | ASSISTANTE | TECHNICO | CHEF_CHANTIER | SOUS_TRAITANT |
| --- | --- | --- | --- | --- | --- |
| Users and subcontractor administration | Full | No | No | No | No |
| Clients | CRUD | Create/read/update | Create/read/update | Read | No |
| Demandes de devis | Full | Read/update | Full | No | No |
| Devis | Full | Create/read/update/send | Full status/signature | Read and operational validation | No |
| Factures | Full | Full | Full | Read | No |
| Chantiers | Full | Create/read/update/delete | No | Operational read/update/tasks/plans | Portal access only when assigned/shared |
| Fournisseurs | Full | No | Read | No | No |
| Materiaux and services MO | Full | Read | Read | No | No |
| Prestations catalogue | Full | Read | Read | No | No |
| Commandes fournisseur | Full | Full | Full | Receive/operate | Supplier portal only |
| Notifications | Read | Read | Read | Read | No |
| RAG / IA knowledge base | Full | No | No | No | No |
| Assistant public | Public endpoints only | Public endpoints only | Public endpoints only | Public endpoints only | Public endpoints only |
| Development seed | Full, non-production guard still applies | No | No | No | No |

## Public Exceptions

These routes intentionally do not require JWT because they are used by visitors or clients through signed/tokenized links:

- `/api/assistant/**`
- `/api/devis/public/**`
- `GET /api`

They must validate their session, token, company scope, and expiration inside the service layer.
