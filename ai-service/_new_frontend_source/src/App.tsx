import { useEffect, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { Header } from './components/Header';
import { QuotePreviewModal } from './components/QuotePreviewModal';
import { DraftsDrawer } from './components/DraftsDrawer';
import { SendClientModal } from './components/SendClientModal';
import { FacturierLayout } from './components/layouts/FacturierLayout';
import { calculateQuote } from './utils/calculations';
import { ClientInfo, PrestationOccurrence, SavedDraft } from './types/quote';
import { api, ApiSession, sessionToPrestations } from './api';

const INITIAL_CLIENT: ClientInfo = {
  nom: 'M. Jean-Paul DUPONT', civilite: 'M.', adresse: '28 rue des Acacias',
  codePostal: '75017', ville: 'Paris', telephone: '06 44 21 89 00', email: 'jp.dupont@email.fr',
  numeroDevis: '—', dateEmission: new Date().toLocaleDateString('fr-FR'), validiteMois: 1,
  lieuChantier: '28 rue des Acacias, 75017 Paris (Appartement 2e étage)',
};

export default function App() {
  const [prestations, setPrestations] = useState<PrestationOccurrence[]>([]);
  const [session, setSession] = useState<ApiSession | null>(null);
  const [tauxMarge, setTauxMarge] = useState(30);
  const [tauxTVA, setTauxTVA] = useState(20);
  const [clientInfo, setClientInfo] = useState<ClientInfo>(INITIAL_CLIENT);
  const [isLoading, setIsLoading] = useState(false);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [drafts, setDrafts] = useState<SavedDraft[]>([]);
  const [isDraftsOpen, setIsDraftsOpen] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isSendModalOpen, setIsSendModalOpen] = useState(false);
  const [toast, setToast] = useState<{ text: string; type: 'success' | 'info' } | null>(null);
  const recalcTimer = useRef<number | null>(null);

  const showToast = (text: string, type: 'success' | 'info' = 'success') => {
    setToast({ text, type });
    window.setTimeout(() => setToast(null), 3500);
  };
  const applySession = (next: ApiSession) => {
    setSession(next);
    setPrestations(sessionToPrestations(next));
    setTauxMarge(Math.round((next.taux_marge ?? 0.3) * 100));
    setTauxTVA(next.tva_pourcent ?? 20);
    setClientInfo((previous) => ({ ...previous, numeroDevis: `DEV-${next.devis_id}` }));
  };
  const quantities = (items = prestations) => items.map((item) => ({ uid: item.id, quantite_ouvrage: item.quantiteOuvrage }));
  const couts = (items = prestations) => items.map((item) => ({ uid: item.id, cout_unitaire_manuel: item.coutUnitaireManuel ?? null }));
  const recalculate = async (margin = tauxMarge, items = prestations) => {
    if (!session) return;
    const next = await api<ApiSession>(`/api/devis/${session.devis_id}/recalculer`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ taux_marge: margin / 100, quantites: quantities(items), couts: couts(items), remise_ht: 0 }),
    });
    applySession(next);
  };
  const scheduleRecalculate = (margin: number, items: PrestationOccurrence[]) => {
    if (recalcTimer.current) window.clearTimeout(recalcTimer.current);
    recalcTimer.current = window.setTimeout(() => recalculate(margin, items).catch((error) => showToast(error.message, 'info')), 300);
  };

  useEffect(() => {
    try { setDrafts(JSON.parse(localStorage.getItem('artisan_devis_drafts') || '[]')); } catch { /* cache navigateur invalide */ }
    return () => { if (recalcTimer.current) window.clearTimeout(recalcTimer.current); };
  }, []);

  const generate = async (description: string) => {
    setIsLoading(true);
    try {
      const next = await api<ApiSession>('/api/devis/generer', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description, company_id: 1, client_id: 1, createur_id: 1 }),
      });
      applySession(next);
      showToast(`${next.occurrences.length} prestation${next.occurrences.length > 1 ? 's' : ''} générée${next.occurrences.length > 1 ? 's' : ''}.`);
    } catch (error) { showToast(`Génération impossible : ${(error as Error).message}`, 'info'); }
    finally { setIsLoading(false); }
  };
  const updateMargin = (value: number) => { setTauxMarge(value); scheduleRecalculate(value, prestations); };
  const updateQuantity = (id: string, value: number | null) => {
    const next = prestations.map((item) => item.id === id ? { ...item, quantiteOuvrage: value } : item);
    setPrestations(next); scheduleRecalculate(tauxMarge, next);
  };
  const updateCout = (id: string, value: number | null) => {
    const next = prestations.map((item) => item.id === id ? { ...item, coutUnitaireManuel: value } : item);
    setPrestations(next); scheduleRecalculate(tauxMarge, next);
  };
  const toggleOption = async (id: string, optionId: string) => {
    if (!session) return;
    const item = prestations.find((entry) => entry.id === id);
    if (!item) return;
    const options = item.options.filter((option) => option.active !== (option.id === optionId)).map((option) => option.nom);
    try {
      const next = await api<ApiSession>(`/api/devis/${session.devis_id}/options`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid: id, options, taux_marge: tauxMarge / 100, quantites: quantities(), couts: couts() }),
      });
      applySession(next);
    } catch (error) { showToast((error as Error).message, 'info'); }
  };
  const deleteOccurrence = async (id: string) => {
    if (!session) return;
    try { applySession(await api<ApiSession>(`/api/devis/${session.devis_id}/occurrences/${encodeURIComponent(id)}?taux_marge=${tauxMarge / 100}`, { method: 'DELETE' })); }
    catch (error) { showToast((error as Error).message, 'info'); }
  };
  const addPrestation = async (prestationId: number) => {
    if (!session) return;
    try {
      applySession(await api<ApiSession>(`/api/devis/${session.devis_id}/ajouter`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prestation_id: prestationId, taux_marge: tauxMarge / 100, quantites: quantities(), couts: couts() }),
      }));
    } catch (error) { showToast((error as Error).message, 'info'); }
  };
  const saveDraft = async () => {
    if (!session) return;
    setIsSavingDraft(true);
    try { await api(`/api/devis/${session.devis_id}/enregistrer`, { method: 'POST' }); showToast('Brouillon enregistré.'); }
    catch (error) { showToast((error as Error).message, 'info'); }
    finally { setIsSavingDraft(false); }
  };
  const sendQuote = async (email: string) => {
    if (!session) return;
    await api(`/api/devis/${session.devis_id}/envoyer`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email_client: email }),
    });
    setSession(null); setPrestations([]); showToast('Devis envoyé au client.');
  };
  const reset = () => { setSession(null); setPrestations([]); setTauxMarge(30); setClientInfo(INITIAL_CLIENT); };
  const calculation = calculateQuote(prestations, tauxMarge, tauxTVA);

  return <div className="min-h-screen bg-[#f8f9fa] text-stone-900 flex flex-col font-sans">
    <Header onReset={reset} onOpenDrafts={() => setIsDraftsOpen(true)} onOpenPreview={() => setIsPreviewOpen(true)} draftsCount={drafts.length} hasActiveQuote={prestations.length > 0} />
    {toast && <div className="fixed top-20 right-6 z-50 flex items-center gap-2.5 rounded-xl border border-stone-200 bg-white px-4 py-3 text-xs font-bold text-stone-900 shadow-xl">{toast.type === 'success' ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <AlertCircle className="h-4 w-4 text-amber-600" />}<span>{toast.text}</span></div>}
    <main className="flex-1 max-w-[1560px] mx-auto w-full px-4 md:px-8 py-6"><FacturierLayout onGenerateFromText={generate} isLoading={isLoading} activePrestationsCount={prestations.length} calculation={calculation} tauxMarge={tauxMarge} tauxTVA={tauxTVA} clientInfo={clientInfo} onUpdateClientInfo={setClientInfo} onUpdateTauxMarge={updateMargin} onUpdateQuantite={updateQuantity} onUpdateCout={updateCout} onToggleOption={toggleOption} onDeleteOccurrence={deleteOccurrence} onAddPrestation={addPrestation} onChangeTauxTVA={setTauxTVA} onSendToClient={() => setIsSendModalOpen(true)} onSaveDraft={saveDraft} onOpenPreview={() => setIsPreviewOpen(true)} isSavingDraft={isSavingDraft} /></main>
    <QuotePreviewModal isOpen={isPreviewOpen} onClose={() => setIsPreviewOpen(false)} calculation={calculation} clientInfo={clientInfo} onUpdateClientInfo={setClientInfo} />
    <DraftsDrawer isOpen={isDraftsOpen} onClose={() => setIsDraftsOpen(false)} drafts={drafts} onLoadDraft={() => showToast('Les brouillons se rechargent depuis le backend.', 'info')} onDeleteDraft={() => showToast('La suppression de brouillon n’est pas disponible.', 'info')} />
    <SendClientModal isOpen={isSendModalOpen} onClose={() => setIsSendModalOpen(false)} calculation={calculation} clientInfo={clientInfo} onSend={sendQuote} />
  </div>;
}
