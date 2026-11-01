import React, { useState } from 'react';
import { X, Send, CheckCircle2, Mail, MessageSquare, Copy, ExternalLink } from 'lucide-react';
import { QuoteCalculation, ClientInfo } from '../types/quote';
import { formatCurrency } from '../utils/calculations';

interface SendClientModalProps {
  isOpen: boolean;
  onClose: () => void;
  calculation: QuoteCalculation;
  clientInfo: ClientInfo;
  onSend: (email: string) => Promise<void>;
}

export const SendClientModal: React.FC<SendClientModalProps> = ({
  isOpen,
  onClose,
  calculation,
  clientInfo,
  onSend,
}) => {
  const [sendMethod, setSendMethod] = useState<'email' | 'sms' | 'link'>('email');
  const [emailTo, setEmailTo] = useState(clientInfo.email || 'client@chantier.fr');
  const [phoneTo, setPhoneTo] = useState(clientInfo.telephone || '06 12 34 56 78');
  const [isSent, setIsSent] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);

  if (!isOpen) return null;

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (sendMethod !== 'email') {
      setError("Le backend actuel prend en charge l'envoi par e-mail uniquement.");
      return;
    }
    setError(null);
    setIsSending(true);
    try {
      await onSend(emailTo);
      setIsSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "L'envoi a échoué.");
    } finally {
      setIsSending(false);
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(`https://artisandevis.pro/devis/${clientInfo.numeroDevis}`);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/40 backdrop-blur-xs animate-in fade-in">
      <div className="relative w-full max-w-lg rounded-2xl border border-stone-200 bg-white p-6 shadow-2xl space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-stone-200">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200">
              <Send className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-stone-900">
                Envoyer le devis au client
              </h3>
              <p className="text-xs text-stone-500">
                Devis validé conforme aux seuils de rentabilité
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-stone-400 hover:bg-stone-100 hover:text-stone-800 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {isSent ? (
          <div className="py-8 text-center space-y-3">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <h4 className="text-base font-bold text-stone-900">
              Devis envoyé avec succès !
            </h4>
            <p className="text-xs text-stone-600 max-w-sm mx-auto">
              Le client a reçu le document contractuel avec le lien sécurisé pour la signature électronique et le versement de l'acompte de 30%.
            </p>
            <div className="pt-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl bg-amber-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-amber-700 shadow-sm transition-colors"
              >
                Retour au tableau de bord
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSend} className="space-y-4">
            {/* Récap chiffré */}
            <div className="rounded-xl border border-stone-200 bg-stone-50/70 p-3.5 flex items-center justify-between text-xs">
              <div>
                <span className="text-stone-500">Destinataire : </span>
                <strong className="text-stone-900 font-bold">{clientInfo.nom}</strong>
              </div>
              <div>
                <span className="text-stone-500">Total TTC : </span>
                <span className="font-mono font-bold text-amber-800">
                  {formatCurrency(calculation.totalTTC)}
                </span>
              </div>
            </div>

            {/* Canal d'envoi */}
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setSendMethod('email')}
                className={`flex flex-col items-center justify-center gap-1.5 p-3 rounded-xl border text-xs font-semibold transition-all ${
                  sendMethod === 'email'
                    ? 'border-amber-600 bg-amber-50/80 text-amber-900 shadow-xs'
                    : 'border-stone-200 bg-stone-50/50 text-stone-600 hover:text-stone-900 hover:bg-stone-100'
                }`}
              >
                <Mail className="h-4 w-4 text-amber-700" />
                <span>Par Email</span>
              </button>

              <button
                type="button"
                onClick={() => setSendMethod('sms')}
                className={`flex flex-col items-center justify-center gap-1.5 p-3 rounded-xl border text-xs font-semibold transition-all ${
                  sendMethod === 'sms'
                    ? 'border-amber-600 bg-amber-50/80 text-amber-900 shadow-xs'
                    : 'border-stone-200 bg-stone-50/50 text-stone-600 hover:text-stone-900 hover:bg-stone-100'
                }`}
              >
                <MessageSquare className="h-4 w-4 text-amber-700" />
                <span>Par SMS</span>
              </button>

              <button
                type="button"
                onClick={() => setSendMethod('link')}
                className={`flex flex-col items-center justify-center gap-1.5 p-3 rounded-xl border text-xs font-semibold transition-all ${
                  sendMethod === 'link'
                    ? 'border-amber-600 bg-amber-50/80 text-amber-900 shadow-xs'
                    : 'border-stone-200 bg-stone-50/50 text-stone-600 hover:text-stone-900 hover:bg-stone-100'
                }`}
              >
                <ExternalLink className="h-4 w-4 text-amber-700" />
                <span>Lien direct</span>
              </button>
            </div>

            {/* Champs selon méthode */}
            {sendMethod === 'email' && (
              <div className="space-y-1">
                <label className="text-xs text-stone-700 font-bold">
                  Adresse email du client :
                </label>
                <input
                  type="email"
                  required
                  value={emailTo}
                  onChange={(e) => setEmailTo(e.target.value)}
                  className="w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-xs font-medium text-stone-900 focus:border-amber-600 focus:outline-none shadow-2xs"
                />
              </div>
            )}

            {sendMethod === 'sms' && (
              <div className="space-y-1">
                <label className="text-xs text-stone-700 font-bold">
                  Numéro de téléphone mobile :
                </label>
                <input
                  type="tel"
                  required
                  value={phoneTo}
                  onChange={(e) => setPhoneTo(e.target.value)}
                  className="w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-xs font-medium text-stone-900 focus:border-amber-600 focus:outline-none shadow-2xs"
                />
              </div>
            )}

            {sendMethod === 'link' && (
              <div className="space-y-2">
                <label className="text-xs text-stone-700 font-bold">
                  Lien de signature client :
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    readOnly
                    value={`https://artisandevis.pro/devis/${clientInfo.numeroDevis}`}
                    className="flex-1 rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-xs text-stone-600 focus:outline-none font-mono"
                  />
                  <button
                    type="button"
                    onClick={handleCopyLink}
                    className="rounded-xl bg-stone-100 hover:bg-stone-200 px-3 py-2 text-xs font-semibold text-stone-800 flex items-center gap-1 transition-colors border border-stone-200"
                  >
                    <Copy className="h-3.5 w-3.5" />
                    <span>{copiedLink ? 'Copié !' : 'Copier'}</span>
                  </button>
                </div>
              </div>
            )}

            {error && <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">{error}</p>}

            {/* Action buttons */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-stone-200">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl px-4 py-2 text-xs font-bold text-stone-500 hover:text-stone-800 transition-colors"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={isSending}
                className="inline-flex items-center gap-2 rounded-xl bg-amber-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-amber-700 transition-colors shadow-sm"
              >
                <Send className="h-3.5 w-3.5" />
                <span>{isSending ? 'Envoi en cours…' : "Confirmer l'envoi"}</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
