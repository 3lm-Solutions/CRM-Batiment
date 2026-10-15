import type { Role } from '@/shared';

/** Role colours (mockup: red admin, blue technico, green assistante, orange chef…). */
export const ROLE_TONES: Record<Role, { avatar: string; badge: string }> = {
  ADMIN: { avatar: 'bg-red-100 text-red-600', badge: 'bg-red-100 text-red-700' },
  TECHNICO: { avatar: 'bg-blue-100 text-blue-600', badge: 'bg-blue-100 text-blue-700' },
  ASSISTANTE: { avatar: 'bg-green-100 text-green-600', badge: 'bg-green-100 text-green-700' },
  CHEF_CHANTIER: { avatar: 'bg-orange-100 text-orange-600', badge: 'bg-orange-100 text-orange-700' },
  SOUS_TRAITANT: { avatar: 'bg-purple-100 text-purple-600', badge: 'bg-purple-100 text-purple-700' },
  FOURNISSEUR: { avatar: 'bg-gray-200 text-gray-700', badge: 'bg-gray-200 text-gray-700' },
};
