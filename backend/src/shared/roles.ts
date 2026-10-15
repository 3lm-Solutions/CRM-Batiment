/**
 * User roles. Must stay identical to the Prisma `Role` enum (checked by src/prisma/prisma-enums.spec.ts).
 *
 * We use `as const` objects instead of TypeScript `enum`: they work the same way
 * in the CommonJS API and in the Vite (ESM) frontend, with no runtime surprises.
 */
export const Role = {
  ADMIN: 'ADMIN',
  TECHNICO: 'TECHNICO',
  ASSISTANTE: 'ASSISTANTE',
  CHEF_CHANTIER: 'CHEF_CHANTIER',
  SOUS_TRAITANT: 'SOUS_TRAITANT',
  FOURNISSEUR: 'FOURNISSEUR',
} as const;

export type Role = (typeof Role)[keyof typeof Role];

export const ROLE_LABELS: Record<Role, string> = {
  ADMIN: 'Administrateur',
  TECHNICO: 'Technico-commercial',
  ASSISTANTE: 'Assistante administrative',
  CHEF_CHANTIER: 'Chef de chantier',
  SOUS_TRAITANT: 'Sous-traitant',
  FOURNISSEUR: 'Fournisseur',
};
