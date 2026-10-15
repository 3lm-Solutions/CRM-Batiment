import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type { PaginatedResponse } from '@/shared';
import { api } from '@/lib/api';

export interface AuditRow {
  id: number;
  action: string;
  entite: string;
  entiteId: number;
  ancienneValeur: Record<string, unknown> | null;
  nouvelleValeur: Record<string, unknown> | null;
  createdAt: string;
  user: { id: number; nom: string; prenom: string | null } | null;
}

export interface AuditQuery {
  page: number;
  entite: string;
  action: string;
  du: string;
  au: string;
}

/** Audit trail (ADMIN). Dates are whole days in local time. */
export const useAudit = (query: AuditQuery) =>
  useQuery({
    queryKey: ['audit', query],
    placeholderData: keepPreviousData,
    queryFn: async () =>
      (
        await api.get<PaginatedResponse<AuditRow>>('/audit', {
          params: {
            page: query.page,
            entite: query.entite || undefined,
            action: query.action || undefined,
            du: query.du ? new Date(`${query.du}T00:00:00`).toISOString() : undefined,
            au: query.au ? new Date(`${query.au}T23:59:59`).toISOString() : undefined,
          },
        })
      ).data,
  });
