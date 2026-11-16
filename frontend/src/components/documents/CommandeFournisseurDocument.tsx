import { formatCurrency, formatDate } from '@/lib/utils';
import type { SupplierPurchaseDocumentData } from '@/lib/documentBuilders';
import { PrintDocumentModal } from './PrintDocumentModal';

interface CommandeFournisseurDocumentProps {
  document: SupplierPurchaseDocumentData;
  onClose: () => void;
  onPrint: () => void;
}

export function CommandeFournisseurDocument({
  document,
  onClose,
  onPrint,
}: CommandeFournisseurDocumentProps) {
  return (
    <PrintDocumentModal
      title="Bon d'achat fournisseur"
      subtitle="Document fournisseur pret a l'impression"
      onClose={onClose}
      onPrint={onPrint}
    >
      <article className="mx-auto w-full max-w-[920px] rounded-[30px] bg-white p-6 text-slate-800 shadow-[0_30px_80px_rgba(15,23,42,0.08)] md:p-10">
        <div className="flex flex-col gap-8 border-b border-slate-200 pb-8 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-3xl font-bold tracking-tight text-slate-900">BATIFLOW</p>
            <p className="text-sm text-slate-500">Bon d'achat fournisseur</p>
            <div className="mt-4 space-y-1 text-sm text-slate-500">
              <p>contact@crm-batiment.fr</p>
              <p>+33 1 23 45 67 89</p>
            </div>
          </div>

          <div className="grid gap-3 rounded-3xl bg-slate-50 p-5 md:min-w-[290px]">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-500">Reference</span>
              <span className="font-semibold text-slate-900">{document.reference}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-500">Date</span>
              <span className="font-medium text-slate-900">{formatDate(document.date)}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-500">Devis source</span>
              <span className="font-medium text-slate-900">{document.devisReference}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-500">Statut</span>
              <span className="font-medium text-slate-900">{document.statutLivraison}</span>
            </div>
          </div>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-2">
          <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Fournisseur</p>
            <p className="mt-2 text-lg font-semibold text-slate-900">{document.fournisseur?.nom ?? 'Fournisseur non renseigne'}</p>
            <div className="mt-2 space-y-1 text-sm text-slate-500">
              {document.fournisseur?.contact ? <p>{document.fournisseur.contact}</p> : null}
              {document.fournisseur?.email ? <p>{document.fournisseur.email}</p> : null}
              {document.fournisseur?.telephone ? <p>{document.fournisseur.telephone}</p> : null}
              {document.fournisseur?.adresse ? <p>{document.fournisseur.adresse}</p> : null}
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-slate-900 p-5 text-white">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Livrer sur chantier</p>
            <p className="mt-2 text-lg font-semibold text-white">{document.chantierReference ?? 'Chantier client'}</p>
            <div className="mt-2 space-y-1 text-sm text-slate-300">
              <p>{document.clientName}</p>
              <p>{document.chantierAddress}</p>
              {document.dateLivraisonPrevue ? <p>Prevision: {formatDate(document.dateLivraisonPrevue)}</p> : null}
            </div>
          </div>
        </div>

        <div className="mt-8 overflow-hidden rounded-3xl border border-slate-200">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-slate-900 text-left text-sm text-white">
                <th className="px-4 py-3 font-semibold md:px-5">N°</th>
                <th className="px-4 py-3 font-semibold md:px-5">Materiau</th>
                <th className="px-4 py-3 text-right font-semibold md:px-5">Quantite</th>
                <th className="px-4 py-3 text-right font-semibold md:px-5">Prix U.</th>
                <th className="px-4 py-3 text-right font-semibold md:px-5">Total HT</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {(document.lignes ?? []).map((line, index) => (
                <tr key={line.id || index}>
                  <td className="px-4 py-4 text-sm font-semibold text-slate-500 md:px-5">{index + 1}</td>
                  <td className="px-4 py-4 text-sm font-semibold text-slate-900 md:px-5">{line.materiauNom}</td>
                  <td className="px-4 py-4 text-right text-sm text-slate-700 md:px-5">
                    {line.quantite} {line.unite}
                  </td>
                  <td className="px-4 py-4 text-right text-sm text-slate-700 md:px-5">{formatCurrency(line.prixUnitaire)}</td>
                  <td className="px-4 py-4 text-right text-sm font-semibold text-slate-900 md:px-5">{formatCurrency(line.totalHT)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-[1fr_0.7fr]">
          <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5 text-sm leading-6 text-slate-600">
            <p>Merci de confirmer la disponibilite et la date de livraison prevue.</p>
            {document.notes ? <p className="mt-3 rounded-2xl bg-white px-4 py-3 text-slate-700">Note: {document.notes}</p> : null}
          </div>
          <div className="rounded-3xl border border-slate-300 bg-amber-50 p-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Total commande</p>
            <p className="mt-3 text-3xl font-bold text-slate-900">{formatCurrency(document.totalHT)}</p>
          </div>
        </div>
      </article>
    </PrintDocumentModal>
  );
}
