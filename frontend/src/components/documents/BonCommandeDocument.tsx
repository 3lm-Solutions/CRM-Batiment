import { formatCurrency, formatDate } from '@/lib/utils';
import type { BonCommande, Devis, LigneDevis } from '@/types';
import { getChantierAddress, getClientDisplayName } from '@/lib/documentBuilders';
import { PrintDocumentModal } from './PrintDocumentModal';

interface BonCommandeDocumentProps {
  devis: Devis;
  bonCommande: BonCommande;
  onClose: () => void;
  onPrint: () => void;
}

function getLineLabel(ligne: LigneDevis) {
  return ligne.description?.trim() || ligne.prestation?.nom || 'Ligne chantier';
}

function getExecutionDetails(ligne: LigneDevis) {
  return [
    ligne.dimension ? `Dimensions: ${ligne.dimension}` : null,
    ligne.couleur ? `Couleur: ${ligne.couleur}` : null,
    ligne.finition ? `Finition: ${ligne.finition}` : null,
    ligne.serviceMainOeuvre?.nom ? `Main d'oeuvre: ${ligne.serviceMainOeuvre.nom}` : null,
  ]
    .filter(Boolean)
    .join(' / ');
}

export function BonCommandeDocument({
  devis,
  bonCommande,
  onClose,
  onPrint,
}: BonCommandeDocumentProps) {
  const lignes = [...(devis.lignes ?? [])].sort((a, b) => a.ordre - b.ordre);

  return (
    <PrintDocumentModal
      title="Bon de commande"
      subtitle="Document interne d'execution et de preparation chantier"
      onClose={onClose}
      onPrint={onPrint}
    >
      <article className="mx-auto w-full max-w-[920px] rounded-[30px] bg-white p-6 text-slate-800 shadow-[0_30px_80px_rgba(15,23,42,0.08)] md:p-10">
        <div className="flex flex-col gap-8 border-b border-slate-200 pb-8 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-3xl font-bold tracking-tight text-slate-900">BATIFLOW</p>
            <p className="text-sm text-slate-500">Bon de commande interne chantier</p>
          </div>

          <div className="grid gap-3 rounded-3xl bg-slate-50 p-5 md:min-w-[290px]">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-500">Reference</span>
              <span className="font-semibold text-slate-900">{bonCommande.reference}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-500">Date</span>
              <span className="font-medium text-slate-900">{formatDate(bonCommande.date)}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-500">Devis</span>
              <span className="font-medium text-slate-900">{devis.reference}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-500">Statut</span>
              <span className="font-medium text-slate-900">{bonCommande.statut}</span>
            </div>
          </div>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-2">
          <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Client</p>
            <p className="mt-2 text-lg font-semibold text-slate-900">{getClientDisplayName(devis)}</p>
            <div className="mt-2 space-y-1 text-sm text-slate-500">
              <p>{getChantierAddress(devis)}</p>
              {devis.client?.telephone ? <p>{devis.client.telephone}</p> : null}
            </div>
          </div>
          <div className="rounded-3xl border border-slate-200 bg-slate-900 p-5 text-white">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Synthese</p>
            <div className="mt-4 space-y-2 text-sm text-slate-300">
              <p>{lignes.length} ligne(s) a preparer</p>
              <p>Total client HT: {formatCurrency(devis.totalHT ?? 0)}</p>
              <p>Total client TTC: {formatCurrency(devis.totalTTC ?? 0)}</p>
            </div>
          </div>
        </div>

        <div className="mt-8 overflow-hidden rounded-3xl border border-slate-200">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-slate-900 text-left text-sm text-white">
                <th className="px-4 py-3 font-semibold md:px-5">N°</th>
                <th className="px-4 py-3 font-semibold md:px-5">Prestation / lot</th>
                <th className="px-4 py-3 font-semibold md:px-5">Details</th>
                <th className="px-4 py-3 text-right font-semibold md:px-5">Quantite</th>
                <th className="px-4 py-3 text-right font-semibold md:px-5">Montant</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {lignes.map((ligne, index) => (
                <tr key={ligne.id || index}>
                  <td className="px-4 py-4 text-sm font-semibold text-slate-500 md:px-5">{index + 1}</td>
                  <td className="px-4 py-4 md:px-5">
                    <p className="text-sm font-semibold text-slate-900">{getLineLabel(ligne)}</p>
                  </td>
                  <td className="px-4 py-4 text-sm text-slate-500 md:px-5">
                    {getExecutionDetails(ligne) || 'Sans detail complementaire'}
                  </td>
                  <td className="px-4 py-4 text-right text-sm text-slate-700 md:px-5">
                    {ligne.quantite} {ligne.unite}
                  </td>
                  <td className="px-4 py-4 text-right text-sm font-semibold text-slate-900 md:px-5">
                    {formatCurrency(ligne.totalHT ?? 0)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-8 rounded-3xl border border-slate-200 bg-slate-50 p-5 text-sm leading-6 text-slate-600">
          <p>Document destine a la preparation interne, au suivi chantier et a la coordination des approvisionnements.</p>
          {devis.notes ? <p className="mt-3 rounded-2xl bg-white px-4 py-3 text-slate-700">Note: {devis.notes}</p> : null}
        </div>
      </article>
    </PrintDocumentModal>
  );
}
