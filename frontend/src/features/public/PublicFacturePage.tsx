import { useQuery } from '@tanstack/react-query';
import { Printer } from 'lucide-react';
import { useParams } from 'react-router-dom';
import { Button, Loading } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import type { EspaceFacture } from '../espace-client/api';
import { FactureClientDocument } from '../espace-client/EspaceClientPage';

type PublicFacture = EspaceFacture & { logo: string | null };

/** Opened from the QR code printed on an invoice (21/10): the invoice, read only, no account. */
export function PublicFacturePage() {
  const token = useParams().token ?? '';
  const q = useQuery({
    queryKey: ['public', 'facture', token],
    retry: false,
    queryFn: async () => (await api.get<PublicFacture>(`/public/factures/${encodeURIComponent(token)}`)).data,
  });

  return (
    <div className="min-h-dvh bg-slate-50 px-4 py-8 dark:bg-slate-950">
      <div className="mx-auto max-w-3xl space-y-4">
        {q.isPending && <Loading />}
        {q.isError && (
          <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            {errorMessage(q.error)} — vérifiez le lien ou contactez l’entreprise qui vous a envoyé la facture.
          </p>
        )}
        {q.data && (
          <>
            <div className="flex items-center justify-between gap-3 print:hidden">
              <div className="flex items-center gap-3">
                {q.data.logo && <img src={q.data.logo} alt="" className="h-10 max-w-32 object-contain" />}
                <span className="font-semibold">{q.data.companyNom}</span>
              </div>
              <Button variant="outline" icon={<Printer className="size-4" />} onClick={() => window.print()}>Imprimer / PDF</Button>
            </div>
            {/* No « view online » QR code here: the reader is already online */}
            <FactureClientDocument f={q.data} showLien={false} />
          </>
        )}
      </div>
    </div>
  );
}
