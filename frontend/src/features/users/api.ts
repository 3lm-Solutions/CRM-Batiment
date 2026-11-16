import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { PaginatedResponse, Role } from '@/shared';
import { api } from '@/lib/api';

export interface User {
  id: number;
  email: string;
  nom: string;
  prenom: string;
  role: Role;
  telephone: string | null;
  actif: boolean;
  mustChangePassword: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

export interface UsersQuery {
  page: number;
  search?: string;
  role?: Role | '';
  actif?: '' | 'true' | 'false';
  limit?: number;
}

export const useUsers = (q: UsersQuery) =>
  useQuery({
    queryKey: ['users', q],
    placeholderData: keepPreviousData,
    queryFn: async () =>
      (await api.get<PaginatedResponse<User>>('/users', { params: { ...q, role: q.role || undefined, actif: q.actif || undefined } })).data,
  });

type UserInput = Pick<User, 'nom' | 'prenom' | 'role'> & { email?: string; telephone?: string | null };
export interface ActionResult {
  emailSent?: boolean;
  temporaryPassword?: string;
}

export function useCreateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: UserInput) => (await api.post<{ user: User } & ActionResult>('/users', body)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  });
}

export function useUpdateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...body }: Partial<UserInput> & { id: number }) => (await api.patch<User>(`/users/${id}`, body)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  });
}

export function useUserAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, action }: { id: number; action: 'deactivate' | 'activate' | 'reset-password' | 'delete' }): Promise<ActionResult> =>
      action === 'delete' ? ((await api.delete(`/users/${id}`)), {}) : (await api.post<ActionResult>(`/users/${id}/${action}`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  });
}

export interface UserOption {
  id: number;
  nom: string;
  prenom: string;
  role: Role;
}

/**
 * Portal accounts (role SOUS_TRAITANT or FOURNISSEUR) with their email and phone, to create or
 * link a sous-traitant / supplier record from an existing account (admin only, decision F1 of 20/10).
 */
export const usePortalAccounts = (role: 'SOUS_TRAITANT' | 'FOURNISSEUR', enabled = true) =>
  useQuery({
    queryKey: ['users', 'portal-accounts', role],
    enabled,
    queryFn: async () => (await api.get<PaginatedResponse<User>>('/users', { params: { role, actif: true, limit: 100 } })).data.data,
  });

/** Light list of active users for pickers (chef de chantier, assignee…). */
export const useUserOptions = (roles?: Role[], enabled = true) =>
  useQuery({
    queryKey: ['users', 'options', roles ?? 'all'],
    enabled,
    staleTime: 5 * 60_000,
    queryFn: async () => (await api.get<UserOption[]>('/users/options', { params: { roles: roles?.join(',') } })).data,
  });
