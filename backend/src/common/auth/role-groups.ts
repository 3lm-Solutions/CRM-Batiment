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
