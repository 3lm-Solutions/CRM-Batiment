import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Download,
  FileText,
  FolderOpen,
  Loader2,
  Search,
} from 'lucide-react';
import api from '@/lib/api';
import { downloadSousTraitantDocument } from './download-document';
import type {
  PaginatedResponse,
  SousTraitantDocument,
} from './types';

function formatDate(value: string) {
  return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium' }).format(
    new Date(value),
  );
}

export default function SousTraitantDocumentsPage() {
  const [search, setSearch] = useState('');
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ['sous-traitant-documents', search],
    queryFn: async () => {
      const response = await api.get<PaginatedResponse<SousTraitantDocument>>(
        '/sous-traitant/documents',
        { params: { search: search.trim() || undefined, limit: 50 } },
      );
      return response.data;
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-950">Documents</h2>
        <p className="mt-1 text-sm text-slate-500">
          Consultez les documents associés aux chantiers sur lesquels vous intervenez.
        </p>
      </div>

      <div className="flex items-center gap-3 rounded-2xl border border-stone-200 bg-white px-4 py-3 shadow-sm focus-within:border-teal-300 focus-within:ring-4 focus-within:ring-teal-500/10">
        <Search size={18} className="text-slate-400" />
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Rechercher un document ou un chantier..."
          className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400"
        />
      </div>

      {error && (
        <div className="rounded-2xl border border-red-100 bg-red-50 px-5 py-4 text-sm text-red-700">
          Impossible de charger les documents.
        </div>
      )}

      {downloadError && (
        <div className="rounded-2xl border border-red-100 bg-red-50 px-5 py-4 text-sm text-red-700">
          {downloadError}
        </div>
      )}

      {isLoading ? (
        <div className="flex min-h-56 items-center justify-center text-slate-400">
          <Loader2 className="animate-spin" size={26} />
        </div>
      ) : !data?.data.length ? (
        <div className="flex min-h-64 flex-col items-center justify-center rounded-[28px] bg-white text-center shadow-sm ring-1 ring-stone-200">
          <FolderOpen size={32} className="text-slate-300" />
          <h3 className="mt-4 font-semibold text-slate-800">Aucun document disponible</h3>
          <p className="mt-1 text-sm text-slate-400">
            Les documents ajoutés aux chantiers affectés apparaîtront ici.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-[28px] bg-white shadow-sm ring-1 ring-stone-200">
          <div className="divide-y divide-slate-100">
            {data.data.map((document) => {
              const clientName = `${document.chantier.client.prenom ?? ''} ${document.chantier.client.nom}`.trim();
              return (
                <div
                  key={document.id}
                  className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center"
                >
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-teal-50 text-teal-700">
                    <FileText size={20} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-950">
                      {document.nom}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {document.type} · {document.chantier.reference} · {clientName} · {formatDate(document.createdAt)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setDownloadError(null);
                      downloadSousTraitantDocument(document).catch(() =>
                        setDownloadError('Impossible d’ouvrir ce document.'),
                      );
                    }}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:border-teal-200 hover:bg-teal-50 hover:text-teal-700"
                  >
                    <Download size={16} /> Ouvrir
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
