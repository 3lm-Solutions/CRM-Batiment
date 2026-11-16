import { Camera, Trash2 } from 'lucide-react';
import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { AuthImage } from '@/components/files/AuthImage';
import { Button, Card, CardHeader, ConfirmDialog } from '@/components/ui';
import { errorMessage } from '@/lib/api';
import { openFichier } from '@/lib/files';
import { formatDate, formatDateTime } from '@/lib/format';
import { MAX_PHOTOS_PAR_TICKET, PHOTO_TYPES, type SavPhoto, useAddSavPhotos, useDeleteSavPhoto } from './api';

/**
 * Photos of an after-sales ticket (C42 of 21/10): those the client sent from his space and
 * those the team adds (on site, before / after the repair). The client sees all of them.
 */
export function SavPhotosCard({ ticketId, photos, readOnly }: { ticketId: number; photos: SavPhoto[]; readOnly?: boolean }) {
  const add = useAddSavPhotos(ticketId);
  const del = useDeleteSavPhoto(ticketId);
  const input = useRef<HTMLInputElement>(null);
  const [removing, setRemoving] = useState<SavPhoto | null>(null);
  const restantes = MAX_PHOTOS_PAR_TICKET - photos.length;

  const pick = (list: FileList | null) => {
    const files = [...(list ?? [])];
    if (!files.length) return;
    if (files.some((f) => !PHOTO_TYPES.includes(f.type))) return toast.error('Seules les photos JPEG, PNG ou WebP sont acceptées.');
    if (files.length > restantes) return toast.error(`${restantes} photo(s) de plus au maximum (${MAX_PHOTOS_PAR_TICKET} par ticket).`);
    add.mutate(files, { onSuccess: (r) => toast.success(`${r.length} photo(s) ajoutée(s)`), onError: (e) => toast.error(errorMessage(e)) });
  };

  return (
    <Card>
      <CardHeader
        title={`Photos${photos.length ? ` (${photos.length})` : ''}`}
        description="Visibles aussi par le client dans son espace"
        actions={
          !readOnly && restantes > 0 && (
            <>
              <input ref={input} type="file" multiple accept={PHOTO_TYPES.join(',')} className="hidden" onChange={(e) => { pick(e.target.files); e.target.value = ''; }} />
              <Button size="sm" variant="outline" icon={<Camera className="size-4" />} loading={add.isPending} onClick={() => input.current?.click()}>
                Ajouter des photos
              </Button>
            </>
          )
        }
      />
      <div className="p-5">
        {photos.length === 0 ? (
          <p className="text-sm text-slate-500">Aucune photo.</p>
        ) : (
          <ul className="flex flex-wrap gap-3">
            {photos.map((p) => (
              <li key={p.id} className="group relative">
                <AuthImage path={`/fichiers/${p.id}/contenu`} alt={p.nom} className="size-24 rounded-lg" onClick={() => void openFichier(p.id)} />
                <span className="mt-1 block w-24 text-[11px] leading-tight text-slate-500" title={formatDateTime(p.createdAt)}>
                  <span className="font-medium">{p.uploadedById === null ? 'Client' : 'Équipe'}</span>
                  <span className="block">{formatDate(p.createdAt)}</span>
                </span>
                {!readOnly && (
                  <button
                    type="button"
                    aria-label={`Supprimer la photo ${p.nom}`}
                    className="absolute right-1 top-1 rounded-md bg-white/90 p-1 text-red-600 shadow-sm opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100 sm:focus:opacity-100 dark:bg-slate-900/90"
                    onClick={() => setRemoving(p)}
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
      <ConfirmDialog
        open={removing !== null}
        onClose={() => setRemoving(null)}
        title="Supprimer la photo"
        message="Elle disparaît aussi de l’espace du client."
        confirmLabel="Supprimer"
        danger
        loading={del.isPending}
        onConfirm={() =>
          removing &&
          del.mutate(removing.id, { onSuccess: () => { setRemoving(null); toast.success('Photo supprimée'); }, onError: (e) => toast.error(errorMessage(e)) })
        }
      />
    </Card>
  );
}
