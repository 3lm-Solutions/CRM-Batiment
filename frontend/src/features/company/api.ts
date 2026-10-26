import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { CompanySettings } from '@/shared';
import { api } from '@/lib/api';
import type { Company } from '../devis/api';

export { useCompany, useCompanySettings, type Company } from '../devis/api';

/** Coordinates printed on quotes and invoices (ADMIN). */
export function useUpdateCompany() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: Partial<Company>) => (await api.patch<Company>('/company', body)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['company'] }),
  });
}

/** Pricing settings: VAT, deposit %, target margin, alert threshold, rounding (ADMIN). */
export function useUpdateCompanySettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: Partial<CompanySettings>) => (await api.patch<CompanySettings>('/company/settings', body)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['company'] }),
  });
}
