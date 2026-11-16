import { ExternalLink, FileText, Plus, Trash2, Upload } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button, Card, CardHeader, ConfirmDialog, Input, Modal, Tabs } from '@/components/ui';
import { errorMessage } from '@/lib/api';
import { formatDate } from '@/lib/format';
import { ACCEPTED_FILES, openFichier, useUploadFichier, validateFile } from '@/lib/files';
import { useAddDocument, useDeleteDocument, type DocumentChantier } from './api';

function AddDocumentModal({ open, onClose, chantierId }: { open: boolean; onClose: () => void; chantierId: number }) {
  const upload = useUploadFichier();
  const add = useAddDocument(chantierId);
  const [mode, setMode] = useState<'file' | 'link'>('file');
  const [nom, setNom] = useState('');
  const [type, setType] = useState('');
  const [url, setUrl] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);

  const reset = () => {
    setNom('');
    setType('');
    setUrl('');
    setFile(null);
    setFileError(null);
  };
  const close = () => {
    reset();
    onClose();
  };
  const done = () => {
    toast.success('Document ajouté');
    close();
  };
  const onError = (e: unknown) => toast.error(errorMessage(e));

  const submit = () => {
    const base = { nom: nom.trim(), type: type.trim() || 'Document' };
    if (mode === 'link') return add.mutate({ ...base, url: url.trim() }, { onSuccess: done, onError });
    if (!file) return;
    upload.mutate(
      { file, chantierId },
      { onSuccess: (f) => add.mutate({ ...base, fichierId: f.id }, { onSuccess: done, onError }), onError },
    );
  };

  const ready = nom.trim() && (mode === 'link' ? /^https?:\/\//.test(url.trim()) : file && !fileError);

  return (
    <Modal
      open={open}
      onClose={close}
      title="Ajouter un document"
      footer={
        <>
          <Button variant="outline" onClick={close}>Annuler</Button>
          <Button onClick={submit} disabled={!ready} loading={upload.isPending || add.isPending}>Ajouter</Button>
        </>
      }
    >
      <Tabs value={mode} onChange={setMode} tabs={[{ value: 'file', label: 'Fichier' }, { value: 'link', label: 'Lien' }]} />
      <div className="space-y-4">
        <Input label="Nom" required value={nom} onChange={(e) => setNom(e.target.value)} placeholder="Ex. : PV de réception" />
        <Input label="Type" value={type} onChange={(e) => setType(e.target.value)} placeholder="Plan, PV, Photo, Permis…" />
        {mode === 'file' ? (
          <Input
            label="Fichier"
            type="file"
            accept={ACCEPTED_FILES}
            hint="JPG, PNG, WebP ou PDF — 10 Mo maximum"
            error={fileError ?? undefined}
            onChange={(e) => {
              const f = e.target.files?.[0] ?? null;
              setFile(f);
              setFileError(f ? validateFile(f) : null);
              if (f && !nom) setNom(f.name.replace(/\.[^.]+$/, ''));
            }}
          />
        ) : (
          <Input label="Adresse du lien" type="url" required value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" />
        )}
      </div>
    </Modal>
  );
}

export function DocumentsCard({ chantierId, documents, canEdit }: { chantierId: number; documents: DocumentChantier[]; canEdit: boolean }) {
  const remove = useDeleteDocument(chantierId);
  const [adding, setAdding] = useState(false);
  const [deleting, setDeleting] = useState<DocumentChantier | null>(null);

  const open = (d: DocumentChantier) => {
    if (d.fichierId) void openFichier(d.fichierId);
    else if (d.url) window.open(d.url, '_blank', 'noopener');
  };

  return (
    <Card>
      <CardHeader
        title="Documents"
        description={`${documents.length} document(s)`}
        actions={canEdit && <Button size="sm" variant="outline" icon={<Plus className="size-4" />} onClick={() => setAdding(true)}>Ajouter</Button>}
      />
      <ul className="divide-y divide-slate-100 dark:divide-slate-800">
        {documents.length === 0 && <li className="px-5 py-4 text-sm text-slate-500">Aucun document.</li>}
        {documents.map((d) => (
          <li key={d.id} className="flex items-center gap-3 px-5 py-3">
            {d.fichierId ? <Upload className="size-4 shrink-0 text-slate-400" aria-hidden /> : <FileText className="size-4 shrink-0 text-slate-400" aria-hidden />}
            <button type="button" onClick={() => open(d)} className="min-w-0 flex-1 text-left">
              <p className="truncate text-sm font-medium hover:underline">{d.nom}</p>
              <p className="text-xs text-slate-500">{d.type} · {formatDate(d.createdAt)}</p>
            </button>
            <ExternalLink className="size-4 text-slate-400" aria-hidden />
            {canEdit && (
              <button type="button" onClick={() => setDeleting(d)} className="rounded p-1 text-slate-400 hover:text-red-600" aria-label={`Supprimer ${d.nom}`}>
                <Trash2 className="size-4" />
              </button>
            )}
          </li>
        ))}
      </ul>
      <AddDocumentModal open={adding} onClose={() => setAdding(false)} chantierId={chantierId} />
      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        danger
        title="Supprimer le document"
        message={`« ${deleting?.nom} » sera retiré du chantier.`}
        confirmLabel="Supprimer"
        loading={remove.isPending}
        onConfirm={() =>
          deleting && remove.mutate(deleting.id, { onSuccess: () => { toast.success('Document supprimé'); setDeleting(null); }, onError: (e) => toast.error(errorMessage(e)) })
        }
      />
    </Card>
  );
}
