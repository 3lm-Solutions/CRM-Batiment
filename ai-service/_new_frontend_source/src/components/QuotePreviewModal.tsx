import React, { useRef, useState, useEffect } from 'react';
import { X, Printer, Download, CheckCircle, ShieldCheck, PenTool, RotateCcw } from 'lucide-react';
import { QuoteCalculation, ClientInfo } from '../types/quote';
import { flattenQuoteToLines, formatCurrency } from '../utils/calculations';

interface QuotePreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  calculation: QuoteCalculation;
  clientInfo: ClientInfo;
  onUpdateClientInfo: (info: ClientInfo) => void;
}

export const QuotePreviewModal: React.FC<QuotePreviewModalProps> = ({
  isOpen,
  onClose,
  calculation,
  clientInfo,
  onUpdateClientInfo,
}) => {
  const [isSigning, setIsSigning] = useState(false);
  const [signatureData, setSignatureData] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isDrawingRef = useRef(false);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  // Lignes plates du devis générées par aplatissement
  const flatLines = flattenQuoteToLines(calculation, calculation.tauxTVA);
  const acompte30 = calculation.totalTTC * 0.3;
  const solde70 = calculation.totalTTC - acompte30;

  // Signature canvas handlers
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    isDrawingRef.current = true;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const x = 'touches' in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = 'touches' in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top;
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const x = 'touches' in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = 'touches' in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top;
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#0f172a';
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;
    if (canvasRef.current) {
      setSignatureData(canvasRef.current.toDataURL());
    }
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    }
    setSignatureData(null);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-stone-900/50 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-4xl my-auto rounded-2xl border border-stone-300 bg-white shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Barre d'action supérieure */}
        <div className="no-print flex items-center justify-between border-b border-stone-200 bg-stone-50 px-6 py-3 shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-800 bg-amber-100/70 px-2 py-0.5 rounded border border-amber-200">
              Aperçu Contractuel Officiel
            </span>
            <span className="text-xs text-stone-500 hidden sm:inline font-medium">
              Structure légale BTP prête pour émission client & impression PDF
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 rounded-lg border border-stone-300 bg-white px-3.5 py-1.5 text-xs font-bold text-stone-800 hover:bg-stone-100 hover:text-stone-950 transition-colors shadow-2xs"
            >
              <Printer className="h-3.5 w-3.5 text-stone-600" />
              <span>Imprimer / PDF</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-stone-400 hover:bg-stone-200/60 hover:text-stone-800 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Corps du devis imprimable (Feuille A4 format standard français) */}
        <div className="p-6 md:p-10 overflow-y-auto bg-white text-slate-900 select-text">
          {/* En-tête Entreprise & Numéro de devis */}
          <div className="flex flex-col sm:flex-row justify-between items-start gap-6 border-b border-slate-300 pb-6">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl font-bold tracking-tight text-slate-950">
                  ARTISAN & COMPAGNIE
                </span>
                <span className="text-[10px] font-bold bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded border border-amber-300">
                  RGE QUALIBAT
                </span>
              </div>
              <p className="text-xs text-slate-600 mt-1">
                Rénovation de l'Habitat & Travaux Tous Corps d'État
              </p>
              <p className="text-xs text-slate-500">
                14 bis avenue des Métiers, 75011 Paris · Tél : 01 42 68 00 12
              </p>
              <p className="text-[11px] text-slate-500">
                SIRET 842 190 321 00019 · RCS Paris · TVA FR 45 842190321
              </p>
              <p className="text-[11px] text-emerald-700 font-semibold mt-1">
                Garantie Décennale AXA Pro n° DX-883921-A
              </p>
            </div>

            {/* Bloc référence devis */}
            <div className="sm:text-right bg-slate-50 p-4 rounded-xl border border-slate-200 min-w-56">
              <span className="text-xs font-bold uppercase tracking-wider text-amber-600 block">
                DEVIS N° {clientInfo.numeroDevis}
              </span>
              <p className="text-xs text-slate-700 mt-1">
                Date : <strong>{clientInfo.dateEmission}</strong>
              </p>
              <p className="text-xs text-slate-700">
                Validité : <strong>{clientInfo.validiteMois} mois</strong>
              </p>
              <p className="text-[11px] text-slate-500 mt-1">
                Conseiller : Marc Laurent
              </p>
            </div>
          </div>

          {/* Coordonnées Client & Chantier */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 my-6">
            <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                Client destinataire :
              </span>
              <div className="space-y-1">
                <input
                  type="text"
                  value={clientInfo.nom}
                  onChange={(e) => onUpdateClientInfo({ ...clientInfo, nom: e.target.value })}
                  placeholder="Nom du client"
                  className="font-bold text-sm text-slate-900 bg-transparent border-b border-dashed border-slate-300 w-full focus:outline-none focus:border-amber-500"
                />
                <input
                  type="text"
                  value={clientInfo.adresse}
                  onChange={(e) => onUpdateClientInfo({ ...clientInfo, adresse: e.target.value })}
                  placeholder="Adresse"
                  className="text-xs text-slate-700 bg-transparent border-b border-dashed border-slate-300 w-full focus:outline-none focus:border-amber-500"
                />
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={clientInfo.codePostal}
                    onChange={(e) => onUpdateClientInfo({ ...clientInfo, codePostal: e.target.value })}
                    placeholder="Code Postal"
                    className="text-xs text-slate-700 bg-transparent border-b border-dashed border-slate-300 w-20 focus:outline-none focus:border-amber-500"
                  />
                  <input
                    type="text"
                    value={clientInfo.ville}
                    onChange={(e) => onUpdateClientInfo({ ...clientInfo, ville: e.target.value })}
                    placeholder="Ville"
                    className="text-xs text-slate-700 bg-transparent border-b border-dashed border-slate-300 flex-1 focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                Lieu d'exécution des travaux :
              </span>
              <input
                type="text"
                value={clientInfo.lieuChantier}
                onChange={(e) => onUpdateClientInfo({ ...clientInfo, lieuChantier: e.target.value })}
                placeholder="Adresse du chantier si différente"
                className="text-xs text-slate-800 font-medium bg-transparent border-b border-dashed border-slate-300 w-full focus:outline-none focus:border-amber-500 mt-1"
              />
              <p className="text-[11px] text-slate-500 mt-2">
                Conformité : Respect des normes DTU applicables et règles professionnelles du bâtiment.
              </p>
            </div>
          </div>

          {/* Tableau des composants facturés : une ligne = matériau ou main-d'œuvre. */}
          <div className="overflow-x-auto my-6">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b-2 border-slate-900 bg-slate-100 text-slate-800">
                  <th className="py-2.5 px-3 font-bold uppercase tracking-wider text-[11px]">Réf</th>
                  <th className="py-2.5 px-3 font-bold uppercase tracking-wider text-[11px]">Composant facturé</th>
                  <th className="py-2.5 px-3 font-bold uppercase tracking-wider text-[11px] text-right">Quantité</th>
                  <th className="py-2.5 px-3 font-bold uppercase tracking-wider text-[11px] text-right">P.U. HT</th>
                  <th className="py-2.5 px-3 font-bold uppercase tracking-wider text-[11px] text-right">TVA %</th>
                  <th className="py-2.5 px-3 font-bold uppercase tracking-wider text-[11px] text-right">Montant TVA</th>
                  <th className="py-2.5 px-3 font-bold uppercase tracking-wider text-[11px] text-right">Total HT</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {flatLines.map((line, idx) => (
                  <tr key={line.id} className="hover:bg-slate-50/80">
                    <td className="py-3 px-3 font-mono text-slate-500 text-[11px]">
                      {String(idx + 1).padStart(2, '0')}
                    </td>
                    <td className="py-3 px-3">
                      <span className="font-semibold text-slate-950 block">
                        {line.description}
                      </span>
                      <span className="text-[11px] text-slate-500">
                        Catégorie : {line.categorie}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-medium text-slate-900 whitespace-nowrap">
                      {line.quantite} {line.unite}
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-slate-800 whitespace-nowrap">
                      {formatCurrency(line.prixUnitaireHT)}
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-slate-600 whitespace-nowrap">
                      {line.tauxTVA}%
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-slate-700 whitespace-nowrap">
                      {formatCurrency(line.montantTVA)}
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-bold text-slate-950 whitespace-nowrap">
                      {formatCurrency(line.totalHT)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Récapitulatif financier global */}
          <div className="flex flex-col sm:flex-row justify-between items-start gap-6 border-t border-slate-300 pt-6">
            {/* Modalités de paiement */}
            <div className="space-y-2 text-xs text-slate-600 max-w-sm">
              <span className="font-bold text-slate-900 uppercase tracking-wider text-[11px] block">
                Conditions de règlement :
              </span>
              <ul className="space-y-1 text-[11px]">
                <li>• Acompte de 30% à la signature du devis : <strong>{formatCurrency(acompte30)}</strong></li>
                <li>• Solde de 70% à l'achèvement des travaux : <strong>{formatCurrency(solde70)}</strong></li>
                <li>• Mode de règlement : Virement bancaire ou Chèque à l'ordre de Artisan & Cie.</li>
                <li>• Durée estimée du chantier : 5 jours ouvrés à compter du démarrage.</li>
              </ul>
            </div>

            {/* Totaux financiers */}
            <div className="w-full sm:w-72 bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
              <div className="flex justify-between text-xs text-slate-700">
                <span>Total Général HT :</span>
                <span className="font-mono font-semibold text-slate-950">
                  {formatCurrency(calculation.totalVenteHT)}
                </span>
              </div>
              <div className="flex justify-between text-xs text-slate-700 pb-2 border-b border-slate-200">
                <span>Total TVA ({calculation.tauxTVA}%) :</span>
                <span className="font-mono font-semibold text-slate-950">
                  {formatCurrency(calculation.montantTVA)}
                </span>
              </div>
              <div className="flex justify-between items-center text-sm font-bold text-slate-950 pt-1">
                <span>TOTAL TTC :</span>
                <span className="font-mono text-xl text-amber-600">
                  {formatCurrency(calculation.totalTTC)}
                </span>
              </div>
            </div>
          </div>

          {/* Bloc Signature Client */}
          <div className="mt-8 pt-6 border-t border-slate-300 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="text-xs text-slate-500 space-y-1">
              <span className="font-bold text-slate-900 block">
                Pour l'entreprise Artisan & Cie
              </span>
              <p>Fait à Paris, le {clientInfo.dateEmission}</p>
              <div className="h-16 flex items-center text-slate-400 italic text-[11px]">
                Signature & Cachet de l'entreprise apposés
              </div>
            </div>

            <div className="border border-slate-300 rounded-xl p-3 bg-slate-50">
              <div className="flex justify-between items-center mb-1.5">
                <span className="text-xs font-bold text-slate-900">
                  Bon pour accord et commande — Signature du client
                </span>
                {signatureData && (
                  <button
                    type="button"
                    onClick={clearSignature}
                    className="no-print inline-flex items-center gap-1 text-[11px] text-slate-500 hover:text-rose-600"
                  >
                    <RotateCcw className="h-3 w-3" />
                    <span>Effacer</span>
                  </button>
                )}
              </div>

              {/* Canvas interactif de signature électronique */}
              <div className="relative rounded border border-slate-300 bg-white overflow-hidden h-24 cursor-crosshair">
                <canvas
                  ref={canvasRef}
                  width={340}
                  height={96}
                  onMouseDown={startDrawing}
                  onMouseMove={draw}
                  onMouseUp={stopDrawing}
                  onMouseLeave={stopDrawing}
                  onTouchStart={startDrawing}
                  onTouchMove={draw}
                  onTouchEnd={stopDrawing}
                  className="w-full h-full"
                />
                {!signatureData && (
                  <span className="no-print pointer-events-none absolute inset-0 flex items-center justify-center text-slate-400 text-xs italic">
                    Signez ici (souris ou doigt)
                  </span>
                )}
              </div>
              <p className="text-[10px] text-slate-500 mt-1">
                Mention manuscrite "Lu et approuvé, bon pour accord"
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
