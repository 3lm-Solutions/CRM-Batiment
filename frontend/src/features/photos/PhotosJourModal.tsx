import { Camera, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button, Input, Modal, Select, Textarea } from '@/components/ui';
import { errorMessage } from '@/lib/api';
import { cn } from '@/lib/cn';
import { shrinkImage } from '@/lib/images';
import { MAX_PHOTOS_ENVOI, PHOTO_MOMENTS, useEnvoyerPhotos, type PhotoMoment } from './api';

const IMAGES = 'image/jpeg,image/png,image/webp';
const aujourdhui = () => new Date().toISOString().slice(0, 10);
const ilYa = (jours: number) => new Date(Date.now() - jours * 86_400_000).toISOString().slice(0, 10);

/**
 * « Photos du jour » of a task (Étape 3 of 26/10): before or after, optionally for one sub-task.
 * Photos are shrunk on the phone before upload (faster on a site connection).
 */
export function PhotosJourModal({
  open,
  onClose,
  tache,
}: {
  open: boolean;
  onClose: () => void;
  tache: { id: number; libelle: string; checklist?: { id: number; libelle: string }[] } | null;
}) {
  const envoyer = useEnvoyerPhotos();
  const [moment, setMoment] = useState<PhotoMoment>('AVANT');
  const [sousTache, setSousTache] = useState('');
  const [date, setDate] = useState(aujourdhui());
  const [commentaire, setCommentaire] = useState('');
  const [photos, setPhotos] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [preparation, setPreparation] = useState(false);

  useEffect(() => {
    if (!open) return;
    setMoment('AVANT');
    setSousTache('');
    setDate(aujourdhui());
    setCommentaire('');
    setPhotos([]);
  }, [open, tache?.id]);

  useEffect(() => {
    const urls = photos.map((p) => URL.createObjectURL(p));
    setPreviews(urls);
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, [photos]);

  const ajouter = async (files: FileList | null) => {
    if (!files?.length) return;
    const choisis = Array.from(files).filter((f) => {
      const ok = IMAGES.split(',').includes(f.type);
      if (!ok) toast.error(`${f.name} : seules les photos sont acceptées (JPG, PNG, WebP).`);
      return ok;
    });
    const place = MAX_PHOTOS_ENVOI - photos.length;
    if (choisis.length > place) toast.error(`${MAX_PHOTOS_ENVOI} photos au maximum par envoi.`);
    setPreparation(true);
    try {
      const reduites = await Promise.all(choisis.slice(0, Math.max(place, 0)).map((f) => shrinkImage(f)));
      setPhotos((ps) => [...ps, ...reduites]);
    } finally {
      setPreparation(false);
    }
  };

  const checklist = tache?.checklist ?? [];

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={`Photos — ${(tache?.libelle ?? '').replace(/^[\s\-–—•·*]+/, '')}`}
      description="Le chef de chantier valide les photos avant qu’elles soient montrées au client."
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Annuler</Button>
          <Button
            disabled={!tache || photos.length === 0 || preparation}
            loading={envoyer.isPending}
            onClick={() =>
              tache &&
              envoyer.mutate(
                { tacheId: tache.id, checklistItemId: sousTache ? Number(sousTache) : undefined, moment, date, commentaire: commentaire.trim() || undefined, photos },
                {
                  onSuccess: (r) => {
                    toast.success(`${r.length} photo(s) « ${PHOTO_MOMENTS[moment].toLowerCase()} » envoyée(s)`);
                    onClose();
                  },
                  onError: (e) => toast.error(errorMessage(e)),
                },
              )
            }
          >
            Envoyer {photos.length > 0 ? `(${photos.length})` : ''}
          </Button>
        </>
      }
    >
      <div className="space-y-6">
        {/* 27/10: two well-separated choices (they touched each other on a phone, wrong one tapped) */}
        <fieldset>
          <legend className="mb-2 text-sm font-medium text-slate-700 dark:text-slate-300">Moment de la photo</legend>
          <div role="radiogroup" aria-label="Moment de la photo" className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
            {(Object.keys(PHOTO_MOMENTS) as PhotoMoment[]).map((m) => {
              const actif = moment === m;
              return (
                <button
                  key={m}
                  type="button"
                  role="radio"
                  aria-checked={actif}
                  onClick={() => setMoment(m)}
                  className={cn(
                    'flex min-h-16 items-center gap-3 rounded-xl border-2 px-4 py-3 text-left transition focus-visible:outline-offset-4',
                    actif
                      ? 'border-brand-700 bg-brand-100/60 text-brand-900 dark:border-blue-400 dark:bg-slate-800 dark:text-blue-200'
                      : 'border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800/60',
                  )}
                >
                  <span className={cn('flex size-5 shrink-0 items-center justify-center rounded-full border-2', actif ? 'border-brand-700 dark:border-blue-300' : 'border-slate-300')} aria-hidden>
                    {actif && <span className="size-2.5 rounded-full bg-brand-700 dark:bg-blue-300" />}
                  </span>
                  <span>
                    <span className="block text-sm font-semibold">{m === 'AVANT' ? 'Avant les travaux' : 'Après les travaux'}</span>
                    <span className="block text-xs text-slate-500">{m === 'AVANT' ? 'État de départ' : 'Travail terminé'}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </fieldset>
        <div className="grid gap-4 sm:grid-cols-2">
          {checklist.length > 0 && (
            <Select label="Sous-tâche" placeholder="Toute la tâche" options={checklist.map((i) => ({ value: i.id, label: i.libelle }))} value={sousTache} onChange={(e) => setSousTache(e.target.value)} />
          )}
          <Input label="Jour" type="date" min={ilYa(60)} max={aujourdhui()} value={date} onChange={(e) => setDate(e.target.value || aujourdhui())} />
        </div>
        <Textarea label="Commentaire" rows={2} maxLength={500} value={commentaire} onChange={(e) => setCommentaire(e.target.value)} placeholder="Facultatif" />
        <div>
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-slate-300 px-4 py-3 text-sm font-medium hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800">
            <Camera className="size-5 text-brand-700" aria-hidden />
            {preparation ? 'Préparation…' : 'Prendre ou choisir des photos'}
            <input type="file" accept={IMAGES} capture="environment" multiple className="sr-only" onChange={(e) => { void ajouter(e.target.files); e.target.value = ''; }} />
          </label>
          <span className="ml-3 text-xs text-slate-500">{photos.length}/{MAX_PHOTOS_ENVOI}</span>
          {photos.length > 0 && (
            <ul className="mt-3 flex flex-wrap gap-2">
              {photos.map((p, i) => (
                <li key={`${p.name}-${i}`} className="relative">
                  {previews[i] && <img src={previews[i]} alt={p.name} className="size-20 rounded-lg object-cover" />}
                  <button
                    type="button"
                    onClick={() => setPhotos((ps) => ps.filter((_, j) => j !== i))}
                    className="absolute -right-1.5 -top-1.5 rounded-full bg-slate-900 p-0.5 text-white"
                    aria-label={`Retirer ${p.name}`}
                  >
                    <X className="size-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Modal>
  );
}
