import { Camera, Send, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button, Card, CardHeader, Input, Select, Textarea } from '@/components/ui';
import { errorMessage } from '@/lib/api';
import { ACCEPTED_FILES, validateFile } from '@/lib/files';
import { useEnvoyerRapport, type StTache } from './api';

const MAX_PHOTOS = 10;

/** Report from the job site: text, optional task + progress, up to 10 photos (phone camera friendly). */
export function RapportForm({ chantierId, taches, tacheInitiale }: { chantierId: number; taches: StTache[]; tacheInitiale?: number }) {
  const envoyer = useEnvoyerRapport();
  const mine = taches.filter((t) => t.affecteeAMoi);
  const [tacheId, setTacheId] = useState(tacheInitiale ? String(tacheInitiale) : '');
  const [avancement, setAvancement] = useState('');
  const [contenu, setContenu] = useState('');
  const [photos, setPhotos] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);

  useEffect(() => {
    if (tacheInitiale) setTacheId(String(tacheInitiale));
  }, [tacheInitiale]);

  // Thumbnails of the selected photos; URLs freed when the selection changes
  useEffect(() => {
    const urls = photos.map((p) => (p.type.startsWith('image/') ? URL.createObjectURL(p) : ''));
    setPreviews(urls);
    return () => urls.forEach((u) => u && URL.revokeObjectURL(u));
  }, [photos]);

  const addFiles = (files: FileList | null) => {
    if (!files) return;
    const next = [...photos];
    for (const f of Array.from(files)) {
      const err = validateFile(f);
      if (err) {
        toast.error(`${f.name} : ${err}`);
        continue;
      }
      if (next.length >= MAX_PHOTOS) {
        toast.error(`${MAX_PHOTOS} photos maximum.`);
        break;
      }
      next.push(f);
    }
    setPhotos(next);
  };

  const tache = mine.find((t) => String(t.id) === tacheId);
  const av = avancement === '' ? undefined : Number(avancement);

  const submit = () =>
    envoyer.mutate(
      { chantierId, tacheId: tacheId ? Number(tacheId) : undefined, avancement: tacheId ? av : undefined, contenu: contenu.trim(), photos },
      {
        onSuccess: () => {
          toast.success('Rapport envoyé au bureau');
          setContenu('');
          setAvancement('');
          setPhotos([]);
        },
        onError: (e) => toast.error(errorMessage(e)),
      },
    );

  return (
    <Card>
      <CardHeader title="Envoyer un rapport" description="Compte rendu et photos : le bureau valide, l’avancement est alors appliqué." />
      <div className="space-y-4 p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <Select
            label="Tâche concernée"
            placeholder="Rapport général du chantier"
            options={mine.map((t) => ({ value: t.id, label: `${t.libelle} (${t.avancement} %)` }))}
            value={tacheId}
            onChange={(e) => setTacheId(e.target.value)}
          />
          {tacheId && (
            <Input
              label="Avancement déclaré (%)"
              type="number"
              min={0}
              max={100}
              step={5}
              value={avancement}
              placeholder={tache ? String(tache.avancement) : undefined}
              onChange={(e) => setAvancement(e.target.value)}
            />
          )}
        </div>
        <Textarea label="Compte rendu" required rows={4} value={contenu} onChange={(e) => setContenu(e.target.value)} placeholder="Travaux réalisés, difficultés, ce qui reste à faire…" />
        <div>
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-slate-300 px-4 py-3 text-sm font-medium hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800">
            <Camera className="size-5 text-brand-700" aria-hidden />
            Ajouter des photos
            <input type="file" accept={ACCEPTED_FILES} capture="environment" multiple className="sr-only" onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }} />
          </label>
          <span className="ml-3 text-xs text-slate-500">{photos.length}/{MAX_PHOTOS} · JPG, PNG, WebP ou PDF, 10 Mo max.</span>
          {photos.length > 0 && (
            <ul className="mt-3 flex flex-wrap gap-2">
              {photos.map((p, i) => (
                <li key={`${p.name}-${i}`} className="relative">
                  {previews[i] ? (
                    <img src={previews[i]} alt={p.name} className="size-20 rounded-lg object-cover" />
                  ) : (
                    <span className="flex size-20 items-center justify-center rounded-lg bg-slate-100 p-1 text-center text-[10px] dark:bg-slate-800">{p.name}</span>
                  )}
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
        <div className="flex justify-end">
          <Button icon={<Send className="size-4" />} disabled={!contenu.trim() || (av !== undefined && (av < 0 || av > 100))} loading={envoyer.isPending} onClick={submit}>
            Envoyer
          </Button>
        </div>
      </div>
    </Card>
  );
}
