import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle,
  Camera,
  CheckCircle2,
  Download,
  FileText,
  Image as ImageIcon,
  Loader2,
  UploadCloud,
} from 'lucide-react';
import api from '@/lib/api';
import { cn } from '@/lib/utils';
import { downloadSousTraitantDocument } from './download-document';
import type {
  PaginatedResponse,
  SousTraitantChantier,
  SousTraitantDocument,
} from './types';

function getErrorMessage(error: unknown) {
  if (error && typeof error === 'object' && 'response' in error) {
    const message = (error as { response?: { data?: { message?: string | string[] } } })
      .response?.data?.message;
    if (Array.isArray(message)) return message.join(' ');
    if (typeof message === 'string') return message;
  }
  return 'L’opération a échoué.';
}

function formatDate(value: string | null) {
  if (!value) return 'Non définie';
  return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium' }).format(new Date(value));
}

export default function SousTraitantRapportsPhotosPage() {
  const queryClient = useQueryClient();
  const [chantierId, setChantierId] = useState('');
  const [reportTitle, setReportTitle] = useState('');
  const [reportContent, setReportContent] = useState('');
  const [photoTitle, setPhotoTitle] = useState('');
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [feedback, setFeedback] = useState<{ tone: 'success' | 'error'; message: string } | null>(null);

  const chantiersQuery = useQuery({
    queryKey: ['sous-traitant-chantiers', 'rapports-photos'],
    queryFn: async () => {
      const response = await api.get<PaginatedResponse<SousTraitantChantier>>(
        '/sous-traitant/chantiers',
        { params: { page: 1, limit: 100 } },
      );
      return response.data;
    },
  });

  const documentsQuery = useQuery({
    queryKey: ['sous-traitant-documents', 'rapports-photos'],
    queryFn: async () => {
      const response = await api.get<PaginatedResponse<SousTraitantDocument>>(
        '/sous-traitant/documents',
        { params: { page: 1, limit: 100 } },
      );
      return response.data;
    },
  });

  const chantiers = chantiersQuery.data?.data ?? [];
  const selectedChantier = chantiers.find((item) => item.id === Number(chantierId));
  const uploadedDocuments = useMemo(
    () =>
      (documentsQuery.data?.data ?? []).filter((item) =>
        ['RAPPORT', 'PHOTO', 'COMPTE_RENDU'].includes(item.type.toUpperCase()),
      ),
    [documentsQuery.data?.data],
  );

  const refreshDocuments = () => {
    queryClient.invalidateQueries({ queryKey: ['sous-traitant-documents'] });
    queryClient.invalidateQueries({ queryKey: ['sous-traitant-chantiers'] });
    queryClient.invalidateQueries({ queryKey: ['internal-notifications'] });
  };

  const reportMutation = useMutation({
    mutationFn: async () => {
      const response = await api.post<SousTraitantDocument>('/sous-traitant/rapports', {
        chantierId: Number(chantierId),
        titre: reportTitle,
        contenu: reportContent,
      });
      return response.data;
    },
    onSuccess: () => {
      setReportTitle('');
      setReportContent('');
      setFeedback({ tone: 'success', message: 'Le rapport a été déposé.' });
      refreshDocuments();
    },
    onError: (error) => setFeedback({ tone: 'error', message: getErrorMessage(error) }),
  });

  const photoMutation = useMutation({
    mutationFn: async () => {
      if (!photoFile) throw new Error('Aucune photo sélectionnée.');
      const formData = new FormData();
      formData.append('chantierId', chantierId);
      formData.append('titre', photoTitle);
      formData.append('file', photoFile);
      const response = await api.post<SousTraitantDocument>(
        '/sous-traitant/photos',
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } },
      );
      return response.data;
    },
    onSuccess: () => {
      setPhotoTitle('');
      setPhotoFile(null);
      setFeedback({ tone: 'success', message: 'La photographie a été déposée.' });
      refreshDocuments();
    },
    onError: (error) => setFeedback({ tone: 'error', message: getErrorMessage(error) }),
  });

  const canSubmitReport = Boolean(chantierId && reportTitle.trim().length >= 3 && reportContent.trim().length >= 10);
  const canSubmitPhoto = Boolean(chantierId && photoFile);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-950">Rapports et photos</h2>
        <p className="mt-1 text-sm text-slate-500">
          Déposez les comptes rendus et photographies liés uniquement à vos chantiers affectés.
        </p>
      </div>

      <section className="rounded-[28px] bg-white p-5 shadow-sm ring-1 ring-stone-200">
        <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          Chantier concerné
        </label>
        <select
          value={chantierId}
          onChange={(event) => { setChantierId(event.target.value); setFeedback(null); }}
          className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-teal-400 focus:ring-4 focus:ring-teal-100"
        >
          <option value="">Sélectionner un chantier</option>
          {chantiers.map((chantier) => (
            <option key={chantier.id} value={chantier.id}>
              {chantier.reference} — {chantier.adresse}
            </option>
          ))}
        </select>

        {selectedChantier ? (
          <div className="mt-4 grid gap-3 rounded-2xl bg-teal-50 p-4 text-sm text-teal-900 sm:grid-cols-3">
            <div><p className="text-xs text-teal-700">Client</p><p className="font-semibold">{selectedChantier.client.prenom} {selectedChantier.client.nom}</p></div>
            <div><p className="text-xs text-teal-700">Début intervention</p><p className="font-semibold">{formatDate(selectedChantier.taches[0]?.dateDebut ?? selectedChantier.dateDebut)}</p></div>
            <div><p className="text-xs text-teal-700">Fin prévue</p><p className="font-semibold">{formatDate(selectedChantier.taches.at(-1)?.dateFin ?? selectedChantier.dateFin)}</p></div>
          </div>
        ) : null}
      </section>

      {feedback ? (
        <div className={cn(
          'flex items-start gap-3 rounded-2xl border px-5 py-4 text-sm font-medium',
          feedback.tone === 'success'
            ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
            : 'border-red-200 bg-red-50 text-red-700',
        )}>
          {feedback.tone === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
          {feedback.message}
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="rounded-[28px] bg-white p-5 shadow-sm ring-1 ring-stone-200">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-teal-50 text-teal-700"><FileText size={21} /></div>
            <div><h3 className="font-bold text-slate-950">Nouveau rapport</h3><p className="text-xs text-slate-500">Compte rendu d’intervention enregistré en fichier Markdown.</p></div>
          </div>

          <div className="mt-5 space-y-4">
            <input
              value={reportTitle}
              onChange={(event) => setReportTitle(event.target.value)}
              placeholder="Titre du rapport"
              maxLength={140}
              className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-teal-400 focus:ring-4 focus:ring-teal-100"
            />
            <textarea
              value={reportContent}
              onChange={(event) => setReportContent(event.target.value)}
              placeholder="Travaux réalisés, difficultés, décisions et actions restantes..."
              className="min-h-52 w-full resize-y rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-teal-400 focus:ring-4 focus:ring-teal-100"
            />
            <button
              type="button"
              disabled={!canSubmitReport || reportMutation.isPending}
              onClick={() => reportMutation.mutate()}
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-teal-700 px-4 py-3 text-sm font-semibold text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {reportMutation.isPending ? <Loader2 size={17} className="animate-spin" /> : <UploadCloud size={17} />}
              Déposer le rapport
            </button>
          </div>
        </section>

        <section className="rounded-[28px] bg-white p-5 shadow-sm ring-1 ring-stone-200">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-teal-50 text-teal-700"><Camera size={21} /></div>
            <div><h3 className="font-bold text-slate-950">Nouvelle photographie</h3><p className="text-xs text-slate-500">Formats JPG, PNG ou WEBP. Taille maximale : 10 Mo.</p></div>
          </div>

          <div className="mt-5 space-y-4">
            <input
              value={photoTitle}
              onChange={(event) => setPhotoTitle(event.target.value)}
              placeholder="Légende ou titre de la photo"
              maxLength={140}
              className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-teal-400 focus:ring-4 focus:ring-teal-100"
            />
            <label className="flex min-h-52 cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 px-5 text-center transition hover:border-teal-300 hover:bg-teal-50">
              <ImageIcon size={32} className="text-teal-600" />
              <span className="mt-3 text-sm font-semibold text-slate-700">{photoFile?.name || 'Choisir une photographie'}</span>
              <span className="mt-1 text-xs text-slate-400">Cliquez pour sélectionner le fichier</span>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(event) => setPhotoFile(event.target.files?.[0] ?? null)}
              />
            </label>
            <button
              type="button"
              disabled={!canSubmitPhoto || photoMutation.isPending}
              onClick={() => photoMutation.mutate()}
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-teal-700 px-4 py-3 text-sm font-semibold text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {photoMutation.isPending ? <Loader2 size={17} className="animate-spin" /> : <UploadCloud size={17} />}
              Déposer la photo
            </button>
          </div>
        </section>
      </div>

      <section className="overflow-hidden rounded-[28px] bg-white shadow-sm ring-1 ring-stone-200">
        <div className="border-b border-slate-100 px-5 py-4">
          <h3 className="font-bold text-slate-950">Historique des dépôts</h3>
          <p className="mt-1 text-xs text-slate-500">Rapports et photographies accessibles sur vos chantiers.</p>
        </div>
        {documentsQuery.isLoading ? (
          <div className="flex min-h-40 items-center justify-center"><Loader2 size={24} className="animate-spin text-slate-400" /></div>
        ) : uploadedDocuments.length === 0 ? (
          <div className="px-5 py-12 text-center text-sm text-slate-500">Aucun rapport ou photo déposé.</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {uploadedDocuments.map((document) => (
              <div key={document.id} className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-teal-50 text-teal-700">
                  {document.type === 'PHOTO' ? <ImageIcon size={18} /> : <FileText size={18} />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-950">{document.nom}</p>
                  <p className="mt-1 text-xs text-slate-500">{document.type} · {document.chantier.reference} · {formatDate(document.createdAt)}</p>
                </div>
                <button
                  type="button"
                  onClick={() => downloadSousTraitantDocument(document).catch((error) => setFeedback({ tone: 'error', message: getErrorMessage(error) }))}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:border-teal-200 hover:bg-teal-50 hover:text-teal-700"
                >
                  <Download size={16} /> Télécharger
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
