import { Role } from '../../generated/prisma/client';

/**
 * Reusable role sets for @Roles(...). One place to read "who can do what".
 * The full per-endpoint matrix is built in Step 4 (P0.7).
 */
export const ALL_ROLES: Role[] = Object.values(Role);

/** Internal company staff (everyone except external portal accounts). */
export const STAFF: Role[] = [Role.ADMIN, Role.TECHNICO, Role.ASSISTANTE, Role.CHEF_CHANTIER];

/** Office / commercial side: quotes, clients, invoices. */
export const BUREAU: Role[] = [Role.ADMIN, Role.TECHNICO, Role.ASSISTANTE];

/** External accounts with a restricted portal. */
export const PORTAL: Role[] = [Role.SOUS_TRAITANT, Role.FOURNISSEUR];

/** After-sales team (cahier des charges SAV, chap. 3): SAV tickets, clients, read-only job sites. */
export const SAV_EQUIPE: Role[] = [Role.RESPONSABLE_SAV, Role.AGENT_SAV];

/** Everyone who works SAV tickets. */
export const SAV_ACCES: Role[] = [...STAFF, ...SAV_EQUIPE];

/** May close / reopen a ticket and open one outside the SAV rule: not the AGENT_SAV. */
export const SAV_VALIDATION: Role[] = [Role.ADMIN, Role.RESPONSABLE_SAV];

/** Invoicing (create, edit, issue, send, record a payment, cancel, remind): the TECHNICO only reads (29/10). */
export const FACTURATION: Role[] = [Role.ADMIN, Role.ASSISTANTE];
