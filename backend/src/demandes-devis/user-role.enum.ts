// Aligner sur l'enum du schema.prisma pour éviter les erreurs de RolesGuard
export enum UserRole {
  ADMIN = 'ADMIN',
  TECHNICO = 'TECHNICO',
  ASSISTANTE = 'ASSISTANTE',
  CHEF_DE_CHANTIER = 'CHEF_DE_CHANTIER',
  SOUS_TRAITANT = 'SOUS_TRAITANT',
}