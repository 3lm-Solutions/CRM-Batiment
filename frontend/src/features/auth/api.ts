import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PASSWORD_POLICY, type LoginResponse, type SessionResponse } from '@/shared';
import { z } from 'zod';
import { api } from '@/lib/api';

/** Same rule as the API (src/shared). */
export const passwordSchema = z
  .string()
  .min(PASSWORD_POLICY.minLength, PASSWORD_POLICY.description)
  .regex(/[a-z]/, PASSWORD_POLICY.description)
  .regex(/[A-Z]/, PASSWORD_POLICY.description)
  .regex(/\d/, PASSWORD_POLICY.description);

export interface Profile {
  id: number;
  email: string;
  nom: string;
  prenom: string;
  role: string;
  telephone: string | null;
  company: { id: number; nom: string };
  signatureUpdatedAt: string | null;
  lastLoginAt: string | null;
}

/** The restricted first-login token lives in sessionStorage (this tab only), never in the session. */
export const pendingPasswordChange = {
  save: (token: string, email: string) => sessionStorage.setItem('crm.pwdChange', JSON.stringify({ token, email })),
  get: () => JSON.parse(sessionStorage.getItem('crm.pwdChange') ?? 'null') as { token: string; email: string } | null,
  clear: () => sessionStorage.removeItem('crm.pwdChange'),
};

export const useLogin = () =>
  useMutation({
    mutationFn: async (body: { email: string; password: string }) => (await api.post<LoginResponse>('/auth/login', body)).data,
  });

export const useChangePassword = () =>
  useMutation({
    mutationFn: async ({ token, ...body }: { currentPassword: string; newPassword: string; token?: string }) =>
      (
        await api.post<SessionResponse & { message: string }>('/auth/change-password', body, {
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        })
      ).data,
  });

export const useForgotPassword = () =>
  useMutation({ mutationFn: async (email: string) => (await api.post<{ message: string }>('/auth/forgot-password', { email })).data });

export const useResetPassword = () =>
  useMutation({
    mutationFn: async (body: { email: string; code: string; newPassword: string }) =>
      (await api.post<{ message: string }>('/auth/reset-password', body)).data,
  });

export const useProfile = () => useQuery({ queryKey: ['me'], queryFn: async () => (await api.get<Profile>('/auth/me')).data });

export function useUpdateProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: { nom: string; prenom: string; telephone: string | null }) => (await api.patch<Profile>('/auth/me', body)).data,
    onSuccess: (data) => qc.setQueryData(['me'], data),
  });
}

export const useSignature = (enabled: boolean) =>
  useQuery({
    queryKey: ['me', 'signature'],
    enabled,
    queryFn: async () => (await api.get<{ signatureBase64: string | null; signatureUpdatedAt: string | null }>('/auth/me/signature')).data,
  });

export function useSaveSignature() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (signatureBase64: string) => (await api.put('/auth/me/signature', { signatureBase64 })).data as unknown,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['me'] }),
  });
}
