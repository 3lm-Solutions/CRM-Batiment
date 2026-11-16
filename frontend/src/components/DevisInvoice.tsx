import type { Devis, LigneDevis } from '@/types';
import { formatCurrency, formatDate } from '@/lib/utils';
import { Printer, X } from 'lucide-react';

interface DevisInvoiceProps {
  devis: Devis;
  onClose: () => void;
  onPrint: () => void;
  showGeneratedDocuments?: boolean;
  onOpenFacture?: (factureId: number) => void;
  onOpenBonCommande?: () => void;
  onOpenCommandeFournisseur?: (commandeId: number) => void;
  onManualEdit?: () => void;
  onValidate?: () => Promise<void>;
  onValidateBonCommandeAndSend?: () => Promise<void>;
  validateButtonLabel?: string;
  validateConfirmMessage?: string;
  validateLoadingLabel?: string;
  validateBonCommandeLabel?: string;
  validateBonCommandeConfirmMessage?: string;
  validateBonCommandeLoadingLabel?: string;
}

function getClientName(devis: Devis) {
  if (!devis.client) return 'Client non renseigne';
  return `${devis.client.prenom ?? ''} ${devis.client.nom}`.trim() || devis.client.nom;
}

function getClientAddress(devis: Devis) {
  return devis.client?.adresseChantier || devis.client?.adresseClient || 'Adresse non renseignee';
}

function getAdvisorName(devis: Devis) {
  if (!devis.createur) return 'Conseiller CRM';
  return `${devis.createur.prenom} ${devis.createur.nom}`.trim();
}

export function getStatusLabel(statut: Devis['statut']) {
  switch (statut) {
    case 'BROUILLON':
      return 'Brouillon';
    case 'ENVOYE':
      return 'Envoye';
    case 'ACCEPTE':
      return 'Accepte';
    case 'SIGNE':
      return 'Signe conseiller';
    case 'REFUSE':
      return 'Refuse';
    case 'ANNULE':
      return 'Annule';
    case 'REVISE':
      return 'Revise';
    case 'RENVOYE':
      return 'Renvoye';
    default:
      return statut;
  }
}

export function getModeValidationLabel(mode?: Devis['modeValidation']) {
  switch (mode) {
    case 'EMAIL':
      return 'Validation email';
    case 'SIGNATURE':
      return 'Signature';
    case 'VERBAL':
      return 'Validation verbale';
    case 'AUTRE':
      return 'Validation manuelle';
    default:
      return 'A definir';
  }
}

function getLineTitle(ligne: LigneDevis) {
  return ligne.description?.trim() || ligne.prestation?.nom || 'Ligne de devis';
}

function getLineDetails(ligne: LigneDevis) {
  const details = [
    ligne.materiau?.nom ? `Materiau: ${ligne.materiau.nom}` : null,
    ligne.serviceMainOeuvre?.nom ? `Main d'oeuvre: ${ligne.serviceMainOeuvre.nom}` : null,
    ligne.dimension ? `Dimensions: ${ligne.dimension}` : null,
    ligne.couleur ? `Couleur: ${ligne.couleur}` : null,
    ligne.finition ? `Finition: ${ligne.finition}` : null,
  ].filter(Boolean);

  return details.join(' / ');
}

export function getLineCategory(ligne: LigneDevis) {
  if (ligne.prestation?.nom) return ligne.prestation.nom;
  if (ligne.materiau?.nom) return 'Fourniture';
  if (ligne.serviceMainOeuvre?.nom) return 'Main d oeuvre';
  return 'Divers';
}

export function getLineMaterials(ligne: LigneDevis) {
  const parts = [ligne.materiau?.nom, ligne.serviceMainOeuvre?.nom].filter(Boolean);
  return parts.length > 0 ? parts.join(' + ') : '—';
}

export function TotalsCard({ label, value, emphasis = false }: { label: string; value: string; emphasis?: boolean }) {
  return (
    <div
      className={
        emphasis
          ? 'rounded-2xl border border-slate-300 bg-amber-50 px-4 py-3'
          : 'rounded-2xl border border-slate-200 bg-white px-4 py-3'
      }
    >
      <p className="text-[12px] font-semibold text-slate-500">{label}</p>
      <p className={emphasis ? 'mt-2 text-2xl font-bold text-slate-900' : 'mt-2 text-lg font-semibold text-slate-900'}>
        {value}
      </p>
    </div>
  );
}

export function DocumentActionButton({
  label,
  onClick,
}: {
  label: string;
  onClick?: () => void;
}) {
  if (!onClick) {
    return (
      <span className="inline-flex rounded-full border border-slate-200 px-3 py-1 text-xs font-medium text-slate-400">
        Bientot disponible
      </span>
    );
  }

  return (
    <button
      onClick={onClick}
      aria-label={label}
      className="inline-flex rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
    >
      Apercu / PDF
    </button>
  );
}

import { useState, useMemo } from 'react';
import { CGVDocument } from './documents/CGVDocument';

export function DevisInvoice({
  devis,
  onClose,
  onPrint,
  showGeneratedDocuments = false,
  onOpenFacture,
  onOpenBonCommande,
  onOpenCommandeFournisseur,
  onManualEdit,
  onValidate,
  onValidateBonCommandeAndSend,
  validateButtonLabel = 'Valider le devis',
  validateConfirmMessage = 'Confirmez-vous cette action sur ce devis ?',
  validateLoadingLabel = 'Enregistrement...',
  validateBonCommandeLabel = 'Valider le bon de commande et envoyer',
  validateBonCommandeConfirmMessage = 'Confirmez-vous la validation du bon de commande et l envoi des commandes fournisseur ?',
  validateBonCommandeLoadingLabel = 'Envoi en cours...',
}: DevisInvoiceProps) {
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSupplierConfirm, setShowSupplierConfirm] = useState(false);
  const [supplierLoading, setSupplierLoading] = useState(false);
  const [supplierError, setSupplierError] = useState<string | null>(null);
  const lignes = [...(devis.lignes ?? [])].sort((a, b) => a.ordre - b.ordre);
  const totalHT = devis.totalHT ?? 0;
  const totalTTC = devis.totalTTC ?? 0;
  const issueDate = formatDate(devis.createdAt);
  const tvaGroups = useMemo(() => {
    const groups: Record<number, number> = {};
    lignes.forEach((line) => {
      const rate = devis.tauxTVA ?? 20;
      const lineHT = line.totalHT ?? 0;
      const lineTVA = lineHT * (rate / 100);
      groups[rate] = (groups[rate] || 0) + lineTVA;
    });
    return Object.entries(groups).map(([rate, amount]) => ({
      rate: Number(rate),
      amount,
    }));
  }, [lignes, devis.tauxTVA]);
  const hasGeneratedDocuments =
    (devis.factures?.length ?? 0) > 0 ||
    Boolean(devis.bonCommande) ||
    (devis.commandesFournisseur?.length ?? 0) > 0;

  return (
    <div className="devis-print-root fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm">
      <div className="devis-print-zone flex max-h-[94vh] w-full max-w-6xl flex-col overflow-hidden rounded-[28px] bg-white shadow-2xl">
        <div className="print-hidden flex items-center justify-between border-b border-slate-200 bg-white px-5 py-4">
          <div>
            <p className="text-lg font-semibold text-slate-900">Aperçu du devis</p>
            <p className="text-sm text-slate-500">Document commercial prêt à l'impression</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onPrint}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
            >
              <Printer size={16} />
              Telecharger PDF
            </button>
            <button
              onClick={onClose}
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition hover:bg-slate-50"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Boutons d'action en bas du modal */}
        <div className="print-hidden flex flex-row justify-end gap-3 px-8 py-4 border-b border-slate-100">
          <button
            className="rounded-xl border border-slate-200 bg-white px-5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
            onClick={onManualEdit ?? onClose}
          >
            Modifier contenu
          </button>
          {onValidateBonCommandeAndSend && (
            <button
              className="rounded-xl bg-emerald-700 px-5 py-2 text-sm font-semibold text-white shadow hover:bg-emerald-800 disabled:opacity-60"
              onClick={() => setShowSupplierConfirm(true)}
              disabled={supplierLoading || loading}
            >
              {validateBonCommandeLabel}
            </button>
          )}
          {onValidate && (
            <button
              className="rounded-xl bg-[#9683EC] px-5 py-2 text-sm font-semibold text-white shadow hover:bg-[#7a6ad6] disabled:opacity-60"
              onClick={() => setShowConfirm(true)}
              disabled={loading || !['BROUILLON', 'REVISE'].includes(devis.statut)}
            >
              {validateButtonLabel}
            </button>
          )}
        </div>

        {/* Confirmation modal */}
        {showConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
            <div className="bg-white rounded-2xl shadow-xl p-8 max-w-sm w-full flex flex-col items-center">
              {/* eslint-disable no-irregular-whitespace */}
              {/*
                Confirmez-vous l’envoi de ce devis au client ?
              */}
              {/* eslint-enable no-irregular-whitespace */}
              <p className="text-base font-semibold text-slate-900 mb-4 text-center">
                {validateConfirmMessage}
              </p>
              {error && <p className="text-red-600 text-sm mb-2">{error}</p>}
              <div className="flex gap-4 mt-2">
                <button
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
                  onClick={() => setShowConfirm(false)}
                  disabled={loading}
                >
                  Annuler
                </button>
                <button
                  className="rounded-xl bg-[#9683EC] px-4 py-2 text-sm font-semibold text-white shadow hover:bg-[#7a6ad6] disabled:opacity-60"
                  onClick={async () => {
                    setLoading(true);
                    setError(null);
                    try {
                      if (onValidate) await onValidate();
                      setShowConfirm(false);
                    } catch (e: unknown) {
                      setError(e instanceof Error ? e.message : 'Erreur lors de la validation');
                    } finally {
                      setLoading(false);
                    }
                  }}
                  disabled={loading}
                >
                  {loading ? validateLoadingLabel : 'Confirmer'}
                </button>
              </div>
            </div>
          </div>
        )}

        {showSupplierConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
            <div className="bg-white rounded-2xl shadow-xl p-8 max-w-sm w-full flex flex-col items-center">
              <p className="text-base font-semibold text-slate-900 mb-4 text-center">
                {validateBonCommandeConfirmMessage}
              </p>
              {supplierError && <p className="text-red-600 text-sm mb-2">{supplierError}</p>}
              <div className="flex gap-4 mt-2">
                <button
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
                  onClick={() => setShowSupplierConfirm(false)}
                  disabled={supplierLoading}
                >
                  Annuler
                </button>
                <button
                  className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-emerald-800 disabled:opacity-60"
                  onClick={async () => {
                    setSupplierLoading(true);
                    setSupplierError(null);
                    try {
                      if (onValidateBonCommandeAndSend) {
                        await onValidateBonCommandeAndSend();
                      }
                      setShowSupplierConfirm(false);
                    } catch (e: unknown) {
                      setSupplierError(
                        e instanceof Error
                          ? e.message
                          : 'Erreur lors de la validation du bon de commande',
                      );
                    } finally {
                      setSupplierLoading(false);
                    }
                  }}
                  disabled={supplierLoading}
                >
                  {supplierLoading
                    ? validateBonCommandeLoadingLabel
                    : 'Confirmer'}
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="devis-print-scroll overflow-y-auto bg-[#f4f1eb] py-8 px-4 flex flex-col gap-6 items-center">
          
          {/* PAGE 1: PREPARATION & INTRO */}
          <div className="a4-page print-page print:shadow-none print:m-0 print:p-[12mm] bg-white text-slate-800 text-sm leading-relaxed relative flex flex-col justify-between" style={{ width: '210mm', minHeight: '297mm', padding: '15mm 20mm', boxSizing: 'border-box' }}>
            <div>
              <div className="grid grid-cols-[1fr_1fr] gap-6 border-b border-slate-200 pb-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Coordonnées entreprise</p>
                  <p className="text-base font-bold text-slate-900 mt-1">{devis.company?.nom || 'BATIFLOW'}</p>
                  <div className="text-xs text-slate-500 mt-1 space-y-0.5">
                    <p>{devis.company?.adresse}</p>
                    <p>{devis.company?.email} | {devis.company?.telephone}</p>
                    {devis.company?.siret && <p>SIRET: {devis.company.siret}</p>}
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Coordonnées prospect</p>
                  <p className="text-base font-bold text-slate-900 mt-1">{getClientName(devis)}</p>
                  <div className="text-xs text-slate-500 mt-1 space-y-0.5">
                    <p>{getClientAddress(devis)}</p>
                    {devis.client?.telephone && <p>{devis.client.telephone}</p>}
                    {devis.client?.email && <p>{devis.client.email}</p>}
                  </div>
                </div>
              </div>

              <div className="mt-12">
                <h1 className="text-xl font-bold text-slate-900 uppercase tracking-tight">
                  Devis {devis.reference} / {new Date(devis.createdAt).getFullYear()}
                </h1>
                {devis.notes && (
                  <p className="text-sm font-semibold text-slate-700 mt-1">
                    Objet: {devis.notes}
                  </p>
                )}
                <p className="text-xs font-bold text-slate-900 mt-4 uppercase tracking-wider">
                  DEVIS À L'ATTENTION DE : {getClientName(devis)}
                </p>
              </div>

              <div className="mt-8 text-slate-600 text-xs leading-6 space-y-4">
                <p>
                  Merci pour l'intérêt que vous portez à nos solutions en rénovation et aménagements professionnels.
                  Chez <strong>{devis.company?.nom || 'BATIFLOW'}</strong>, nous sommes spécialisés dans les installations
                  haut de gamme et la valorisation énergétique de vos bâtiments.
                </p>
                <p>
                  Ce devis comprend une analyse détaillée de votre demande et une estimation précise des coûts associés.
                  Nous mettons un point d'honneur à vous offrir des solutions sur mesure, durables et économiques,
                  conçues pour s'adapter parfaitement à vos besoins et à votre budget.
                </p>
                <p>
                  Notre équipe reste à votre entière disposition pour vous accompagner de la conception initiale
                  jusqu'à l'installation finale et la maintenance. N'hésitez pas à contacter votre conseiller pour
                  toute question ou précision complémentaire.
                </p>
              </div>
            </div>

            <div className="flex justify-between items-center border-t border-slate-200 pt-2 text-[10px] text-slate-400">
              <span>Réf: {devis.reference}</span>
              <span>Page 1 / 5</span>
            </div>
          </div>

          {/* PAGE 2: TABLE DES MATÉRIAUX & PRESTATIONS */}
          <div className="a4-page print-page print:shadow-none print:m-0 print:p-[12mm] bg-white text-slate-800 text-sm relative flex flex-col justify-between" style={{ width: '210mm', minHeight: '297mm', padding: '15mm 20mm', boxSizing: 'border-box' }}>
            <div>
              <div className="flex justify-between items-center border-b border-slate-200 pb-2 mb-4">
                <span className="text-[11px] text-slate-500 font-semibold uppercase">N° {devis.reference}</span>
                <span className="text-[11px] text-slate-500 font-semibold">Date: {issueDate}</span>
              </div>

              <table className="w-full border-collapse text-[11px] leading-relaxed">
                <thead>
                  <tr className="bg-slate-800 text-white uppercase text-[9px] tracking-wider">
                    <th className="px-3 py-2 text-left font-semibold rounded-l-md">Description</th>
                    <th className="px-3 py-2 text-right font-semibold">Quantité</th>
                    <th className="px-3 py-2 text-right font-semibold">Prix unitaire</th>
                    <th className="px-3 py-2 text-right font-semibold">TVA %</th>
                    <th className="px-3 py-2 text-right font-semibold">Montant TVA</th>
                    <th className="px-3 py-2 text-right font-semibold rounded-r-md">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {lignes.map((ligne, index) => {
                    const rate = devis.tauxTVA ?? 20;
                    const lineHT = ligne.totalHT ?? 0;
                    const lineTVA = lineHT * (rate / 100);
                    return (
                      <tr key={ligne.id || index}>
                        <td className="px-3 py-2.5 align-top">
                          <p className="font-bold text-slate-900">{getLineTitle(ligne)}</p>
                          <p className="text-[10px] text-slate-500 mt-0.5">{getLineDetails(ligne)}</p>
                        </td>
                        <td className="px-3 py-2.5 text-right whitespace-nowrap">{ligne.quantite} {ligne.unite}</td>
                        <td className="px-3 py-2.5 text-right">{formatCurrency(ligne.prixUnitaireVente ?? 0)}</td>
                        <td className="px-3 py-2.5 text-right">{rate}%</td>
                        <td className="px-3 py-2.5 text-right">{formatCurrency(lineTVA)}</td>
                        <td className="px-3 py-2.5 text-right font-semibold text-slate-950">{formatCurrency(lineHT)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {/* Totals Section */}
              <div className="mt-6 ml-auto w-full max-w-xs border border-slate-200 bg-slate-50 rounded-xl p-4 text-xs space-y-2">
                <div className="flex justify-between font-medium">
                  <span className="text-slate-500">Total HT</span>
                  <span className="text-slate-900">{formatCurrency(totalHT)}</span>
                </div>
                {tvaGroups.map((group) => (
                  <div key={group.rate} className="flex justify-between text-slate-600">
                    <span>TVA {group.rate}%</span>
                    <span>{formatCurrency(group.amount)}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-between items-center border-t border-slate-200 pt-2 text-[10px] text-slate-400">
              <span>Réf: {devis.reference}</span>
              <span>Page 2 / 5</span>
            </div>
          </div>

          {/* PAGE 3: TTC & SIGNATURES */}
          <div className="a4-page print-page print:shadow-none print:m-0 print:p-[12mm] bg-white text-slate-800 text-sm relative flex flex-col justify-between" style={{ width: '210mm', minHeight: '297mm', padding: '15mm 20mm', boxSizing: 'border-box' }}>
            <div>
              {/* Grand Banner Total TTC */}
              <div className="bg-slate-900 text-white rounded-2xl p-5 flex justify-between items-center">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.16em] text-slate-400">Total TTC</p>
                  <p className="text-3xl font-extrabold mt-1">{formatCurrency(totalTTC)}</p>
                </div>
                <div className="text-right">
                  <p className="text-[11px] uppercase tracking-[0.16em] text-slate-400">Montant total</p>
                  <p className="text-xl font-bold mt-1">{formatCurrency(totalTTC)}</p>
                </div>
              </div>

              <p className="mt-8 text-center text-xs italic text-slate-500">
                Les deux parties acceptent le contenu du devis et des conditions générales.
              </p>

              {/* Documents générés (Uniquement à l'écran) */}
              {showGeneratedDocuments && hasGeneratedDocuments && (
                <div className="print-hidden mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-sm font-semibold text-slate-700">Documents générés associés :</p>
                  <div className="mt-3 grid gap-3 md:grid-cols-3">
                    <div>
                      <p className="text-xs text-slate-500 font-bold uppercase">Facture</p>
                      {(devis.factures ?? []).map((f) => (
                        <button key={f.id} onClick={onOpenFacture ? () => onOpenFacture(f.id) : undefined} className="text-xs text-blue-600 block mt-1 hover:underline">
                          {f.reference} (Aperçu)
                        </button>
                      ))}
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 font-bold uppercase">Bon de commande</p>
                      {devis.bonCommande && (
                        <button onClick={onOpenBonCommande} className="text-xs text-blue-600 block mt-1 hover:underline">
                          {devis.bonCommande.reference} (Aperçu)
                        </button>
                      )}
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 font-bold uppercase">Commandes fournisseur</p>
                      {(devis.commandesFournisseur ?? []).map((c) => (
                        <button key={c.id} onClick={onOpenCommandeFournisseur ? () => onOpenCommandeFournisseur(c.id) : undefined} className="text-xs text-blue-600 block mt-1 hover:underline">
                          {c.reference} ({c.fournisseur?.nom})
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Signatures */}
              <div className="mt-12 grid grid-cols-2 gap-8">
                <div className="border border-slate-200 rounded-xl p-4 bg-slate-50">
                  <p className="text-xs font-bold uppercase text-slate-500 tracking-wider">
                    Pour {devis.company?.nom || 'BATIFLOW'}
                  </p>
                  <p className="text-[11px] text-slate-600 mt-1">{getAdvisorName(devis)}</p>
                  <div className="mt-6 h-28 flex items-center justify-center bg-white rounded-lg border border-slate-200 p-2">
                    {devis.signatureConseillerBase64 ? (
                      <img src={devis.signatureConseillerBase64} alt="Signature Conseiller" className="h-full max-h-24 object-contain" />
                    ) : (
                      <span className="text-xs text-slate-300 italic">Signature conseiller</span>
                    )}
                  </div>
                  {devis.signatureConseillerDate && (
                    <p className="text-[10px] text-slate-400 mt-2">Le {formatDate(devis.signatureConseillerDate)}</p>
                  )}
                </div>

                <div className="border border-slate-200 rounded-xl p-4 bg-slate-50">
                  <p className="text-xs font-bold uppercase text-slate-500 tracking-wider">
                    Le Client : {getClientName(devis)}
                  </p>
                  <p className="text-[11px] text-slate-600 mt-1">Bon pour accord et acceptation des CGV</p>
                  <div className="mt-6 h-28 flex items-center justify-center bg-white rounded-lg border border-slate-200 p-2">
                    {devis.signatureClientBase64 ? (
                      <img src={devis.signatureClientBase64} alt="Signature Client" className="h-full max-h-24 object-contain" />
                    ) : devis.statut === 'SIGNE' ? (
                      <span className="text-xs text-emerald-600 font-bold">ACCORD VERBAL VALIDÉ</span>
                    ) : (
                      <span className="text-xs text-slate-300 italic">Signature client</span>
                    )}
                  </div>
                  {devis.signatureClientDate && (
                    <p className="text-[10px] text-slate-400 mt-2">Le {formatDate(devis.signatureClientDate)}</p>
                  )}
                </div>
              </div>
            </div>

            <div className="flex justify-between items-center border-t border-slate-200 pt-2 text-[10px] text-slate-400">
              <span>Réf: {devis.reference}</span>
              <span>Page 3 / 5</span>
            </div>
          </div>

          {/* PAGE 4 & 5: CGV */}
          <CGVDocument
            companyNom={devis.company?.nom}
            companyEmail={devis.company?.email}
            companyTelephone={devis.company?.telephone}
            companyAdresse={devis.company?.adresse}
            companySiret={devis.company?.siret}
            pageOffset={4}
          />
        </div>
      </div>

      <style>{`
        @page {
          size: A4;
          margin: 0;
        }

        @media print {
          body * {
            visibility: hidden !important;
          }

          .devis-print-root {
            position: absolute !important;
            top: 0 !important;
            left: 0 !important;
            right: 0 !important;
            display: block !important;
            background: white !important;
            backdrop-filter: none !important;
            padding: 0 !important;
            margin: 0 !important;
          }

          .devis-print-scroll {
            overflow: visible !important;
            max-height: none !important;
            height: auto !important;
            background: white !important;
            padding: 0 !important;
            display: block !important;
          }

          .print-page {
            visibility: visible !important;
            display: flex !important;
            width: 210mm !important;
            height: 297mm !important;
            min-height: 297mm !important;
            page-break-after: always !important;
            break-after: page !important;
            box-shadow: none !important;
            border: none !important;
            margin: 0 !important;
            padding: 15mm 20mm !important;
            box-sizing: border-box !important;
          }

          .print-page * {
            visibility: visible !important;
          }

          .print-page-5 {
            page-break-after: avoid !important;
            break-after: avoid !important;
          }

          .print-hidden {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
}
