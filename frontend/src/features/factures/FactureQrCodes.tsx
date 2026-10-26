import { Landmark } from 'lucide-react';
import { QrCode } from '@/components/QrCode';
import { epcPayload, formatIban } from '@/lib/epc';
import { formatEuros } from '@/lib/format';

/** The invoice fields needed (office invoice, client space, public link). */
export interface FactureQrSource {
  reference: string | null;
  typeFacture: string;
  statut: string;
  montantTTC: number;
  companyNom: string | null;
  companyIban?: string | null;
  companyBic?: string | null;
  communicationPaiement: string | null;
  lienPublicToken?: string | null;
}

/**
 * Bottom of an issued invoice (21/10): bank details + payment QR code (SEPA) while it is unpaid,
 * and a QR code that opens the invoice online. Printed with the invoice.
 */
export function FactureQrCodes({ f, showLien = true }: { f: FactureQrSource; showLien?: boolean }) {
  if (!f.reference) return null;
  const aPayer = f.statut === 'ENVOYEE' && f.typeFacture !== 'AVOIR';
  const paiement =
    aPayer && f.companyIban
      ? epcPayload({
          beneficiaire: f.companyNom ?? '',
          iban: f.companyIban,
          bic: f.companyBic,
          montant: f.montantTTC,
          libelle: f.communicationPaiement || `Facture ${f.reference}`,
        })
      : null;
  const lien = showLien && f.lienPublicToken ? `${window.location.origin}/facture/${f.lienPublicToken}` : null;
  if (!paiement && !lien && !(aPayer && f.companyIban)) return null;

  return (
    <div className="mt-6 flex flex-wrap items-start justify-between gap-6 border-t pt-4 text-xs text-slate-600 break-inside-avoid">
      {aPayer && f.companyIban && (
        <div className="flex items-start gap-3">
          {paiement && <QrCode value={paiement} size={112} label="QR code de paiement par virement" />}
          <div className="space-y-0.5">
            <p className="flex items-center gap-1.5 font-semibold text-slate-800"><Landmark className="size-3.5" /> Paiement par virement</p>
            <p>Bénéficiaire : {f.companyNom}</p>
            <p>IBAN : <span className="font-mono">{formatIban(f.companyIban)}</span></p>
            {f.companyBic && <p>BIC : <span className="font-mono">{f.companyBic}</span></p>}
            <p>Montant : {formatEuros(f.montantTTC)} · Référence : {f.communicationPaiement || `Facture ${f.reference}`}</p>
            {paiement && <p className="text-slate-500">Scannez avec votre application bancaire : le virement est prérempli.</p>}
          </div>
        </div>
      )}
      {lien && (
        <div className="flex items-start gap-3">
          <QrCode value={lien} size={84} label="QR code : voir la facture en ligne" />
          <div className="max-w-[12rem] space-y-0.5">
            <p className="font-semibold text-slate-800">Facture en ligne</p>
            <p className="text-slate-500">Scannez pour la consulter et la télécharger.</p>
          </div>
        </div>
      )}
    </div>
  );
}
