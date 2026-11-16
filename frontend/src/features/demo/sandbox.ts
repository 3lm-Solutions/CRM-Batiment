import { useMutation, useQuery } from '@tanstack/react-query';
import type { Role, SessionResponse } from '@/shared';
import { api } from '@/lib/api';

/** Step 15 — is this instance the online demo? (separate instance, reset every night) */
export interface DemoInfo {
  actif: boolean;
  reinitialisation: string;
  comptes: { role: Role; nom: string }[];
}

/** Asked once per visit. An API without the endpoint simply means "not the demo". */
export const useDemoInfo = () =>
  useQuery({
    queryKey: ['public', 'demo'],
    staleTime: Infinity,
    retry: false,
    queryFn: async () => (await api.get<DemoInfo>('/public/demo')).data,
  });

/** Demo only: a session for the chosen role, without a password. */
export const useDemoLogin = () =>
  useMutation({
    mutationFn: async (role: Role) => (await api.post<SessionResponse>('/public/demo/connexion', { role })).data,
  });

/** Address of the online demo, shown on the public "Demander une démo" page (empty = hidden). */
export const DEMO_URL = import.meta.env.VITE_DEMO_URL?.trim() || '';

/** "Chaque nuit à 3 h (heure de Paris)" → "chaque nuit à 3 h (heure de Paris)", inside a sentence. */
export const enPhrase = (text: string) => text.charAt(0).toLowerCase() + text.slice(1);
