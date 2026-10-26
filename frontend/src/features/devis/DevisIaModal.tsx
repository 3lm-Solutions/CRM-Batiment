import { ArrowLeft, Camera, Eye, Lightbulb, SearchX, Sparkles, TriangleAlert, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Badge, Button, Modal, Tabs, Textarea } from '@/components/ui';
import { errorMessage } from '@/lib/api';
import { cn } from '@/lib/cn';
import { formatEuros, formatNumber, formatUnite } from '@/lib/format';
import { shrinkImage } from '@/lib/images';
import { MAX_PHOTOS_IA, useAppliquerIa, useProposerIa, useProposerPhotoIa, type AnalysePhoto, type LigneProposee, type PropositionIa } from './api';

type Mode = 'texte' | 'photo';
const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const QUALITE: Record<AnalysePhoto['qualitePhoto'], { label: string; tone: 'green' | 'amber' | 'red' }> = {
  BONNE: { label: 'Photo nette', tone: 'green' },
  MOYENNE: { label: 'Photo moyenne', tone: 'amber' },
  INSUFFISANTE: { label: 'Photo peu exploitable', tone: 'red' },
};

/** 1 to 3 photos, shrunk in the browser before sending; previews with « remove ». */
function PhotoPicker({ photos, onChange, disabled }: { photos: File[]; onChange: (p: File[]) => void; disabled?: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  const [urls, setUrls] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const u = photos.map((p) => URL.createObjectURL(p));
    setUrls(u);
    return () => u.forEach((x) => URL.revokeObjectURL(x));
  }, [photos]);

  const add = async (list: FileList | null) => {
    setError(null);
    const files = [...(list ?? [])];
    if (!files.length) return;
    if (files.some((f) => !PHOTO_TYPES.includes(f.type))) return setError('Photos JPEG, PNG ou WebP uniquement.');
    if (photos.length + files.length > MAX_PHOTOS_IA) return setError(`${MAX_PHOTOS_IA} photos au maximum.`);
    setBusy(true);
    try {
      onChange([...photos, ...(await Promise.all(files.map((f) => shrinkImage(f))))]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
        Photos du chantier <span className="font-normal text-slate-500">(1 à {MAX_PHOTOS_IA}, plusieurs angles de la même pièce)</span>
      </p>
      <div className="flex flex-wrap items-center gap-3">
        {urls.map((u, i) => (
          <div key={u} className="relative">
            <img src={u} alt={photos[i]?.name ?? 'Photo'} className="size-28 rounded-lg object-cover" />
            {!disabled && (
              <button
                type="button"
                aria-label={`Retirer ${photos[i]?.name ?? 'la photo'}`}
                className="absolute -right-1.5 -top-1.5 rounded-full bg-white p-0.5 text-slate-700 shadow ring-1 ring-slate-200 dark:bg-slate-900 dark:text-slate-200 dark:ring-slate-700"
                onClick={() => onChange(photos.filter((_, j) => j !== i))}
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>
        ))}
        {photos.length < MAX_PHOTOS_IA && (
          <>
            {/* no `capture`: on a phone the user picks the camera OR the gallery */}
            <input ref={input} type="file" multiple accept={PHOTO_TYPES.join(',')} className="hidden" onChange={(e) => { void add(e.target.files); e.target.value = ''; }} />
            <button
              type="button"
              disabled={disabled || busy}
              onClick={() => input.current?.click()}
              className="flex size-28 flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-slate-300 text-xs font-medium text-slate-600 transition hover:border-brand-700 hover:text-brand-700 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300"
            >
              <Camera className="size-6" />
              {busy ? 'Préparation…' : 'Ajouter'}
            </button>
          </>
        )}
      </div>
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      <p className="text-xs text-slate-500">Astuce : une porte, un carreau ou un mètre visible sur la photo aide l’IA à estimer la surface. Les photos ne sont pas conservées.</p>
    </div>
  );
}

/** What the AI saw on the photos, shown above the proposed lines. */
function AnalyseCard({ a }: { a: AnalysePhoto }) {
  const q = QUALITE[a.qualitePhoto];
  return (
    <div className="rounded-lg border border-violet-200 bg-violet-50 p-3 text-sm text-violet-950 dark:border-violet-900 dark:bg-violet-950/40 dark:text-violet-100">
      <p className="mb-2 flex flex-wrap items-center gap-2 font-semibold">
        <Eye className="size-4" /> Ce que l’IA voit : {a.piece}
        <Badge tone={q.tone}>{q.label}</Badge>
      </p>
      <dl className="grid gap-x-6 gap-y-1 sm:grid-cols-2">
        <div>
          <dt className="inline text-violet-700 dark:text-violet-300">Surface estimée : </dt>
          <dd className="inline font-medium">
            {a.surfaceEstimeeM2 !== null ? `≈ ${formatNumber(a.surfaceEstimeeM2)} m²` : 'non estimable'}
            {a.surfaceEstimeeM2 !== null && <span className="ml-1 text-xs font-normal">({a.objetReference ? 'approximative' : 'très approximative'}, à mesurer)</span>}
          </dd>
        </div>
        {a.etat && <div><dt className="inline text-violet-700 dark:text-violet-300">État : </dt><dd className="inline">{a.etat}</dd></div>}
        {a.elementsVisibles.length > 0 && (
          <div className="sm:col-span-2"><dt className="inline text-violet-700 dark:text-violet-300">Éléments visibles : </dt><dd className="inline">{a.elementsVisibles.join(', ')}</dd></div>
        )}
      </dl>
    </div>
  );
}

const EXEMPLE = 'Ex. : Rénovation salle de bain 8 m² — dépose de la baignoire, douche à l’italienne, faïence murale sur 2 m de haut, carrelage au sol, remplacement du WC.';

interface Row extends LigneProposee {
  garder: boolean;
  /** Text of the quantity field (kept as typed, e.g. "12," while editing) */
  saisie: string;
}

const toRows = (p: PropositionIa): Row[] => p.lignes.map((l) => ({ ...l, garder: true, saisie: String(l.quantite) }));
const qty = (r: Row) => Number(r.saisie.replace(',', '.'));
const validQty = (r: Row) => Number.isFinite(qty(r)) && qty(r) > 0 && qty(r) <= 10_000;

/**
 * Step 15 — "Proposer avec l’IA" (C37 of 21/10: « Texte » / « Photo » tabs): the technician
 * describes the job or sends 1 to 3 photos, reviews the proposed
 * catalogue lines (keep / remove / change quantity), then adds them in one go.
 * Prices shown come from the catalogue, exactly like a line added by hand.
 */
export function DevisIaModal({ devisId, description: initial, onClose }: { devisId: number; description?: string; onClose: () => void }) {
  const [mode, setMode] = useState<Mode>('texte');
  const [description, setDescription] = useState(initial ?? '');
  const [photos, setPhotos] = useState<File[]>([]);
  const [precision, setPrecision] = useState('');
  const [proposition, setProposition] = useState<PropositionIa | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const proposer = useProposerIa(devisId);
  const proposerPhoto = useProposerPhotoIa(devisId);
  const current = mode === 'texte' ? proposer : proposerPhoto;
  const appliquer = useAppliquerIa(devisId);

  const kept = rows.filter((r) => r.garder);
  const invalid = kept.some((r) => !validQty(r));
  const total = kept.reduce((sum, r) => sum + (validQty(r) ? r.prixUnitaireHT * qty(r) : 0), 0);
  const update = (i: number, patch: Partial<Row>) => setRows((list) => list.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  const show = (p: PropositionIa) => {
    setProposition(p);
    setRows(toRows(p));
  };
  const submitDescription = () => proposer.mutate(description.trim(), { onSuccess: show });
  const submitPhotos = () => proposerPhoto.mutate({ photos, description: precision }, { onSuccess: show });

  const apply = () =>
    appliquer.mutate(
      kept.map((r) => ({ prestationId: r.prestationId, quantite: qty(r) })),
      {
        onSuccess: () => {
          toast.success(`${kept.length} ligne(s) ajoutée(s) au devis`);
          onClose();
        },
        onError: (e) => toast.error(errorMessage(e)),
      },
    );

  // ── step 1: description ──
  if (!proposition) {
    return (
      <Modal
        open
        onClose={onClose}
        size="lg"
        title="Proposer les lignes avec l’IA"
        description="Décrivez les travaux ou prenez le chantier en photo : l’assistant choisit les prestations de votre catalogue et estime les quantités. Rien n’est ajouté sans votre validation."
        footer={
          <>
            <Button variant="outline" onClick={onClose}>Annuler</Button>
            {mode === 'texte' ? (
              <Button icon={<Sparkles className="size-4" />} loading={proposer.isPending} disabled={description.trim().length < 10} onClick={submitDescription}>
                Proposer les lignes
              </Button>
            ) : (
              <Button icon={<Sparkles className="size-4" />} loading={proposerPhoto.isPending} disabled={!photos.length} onClick={submitPhotos}>
                Analyser {photos.length > 1 ? `les ${photos.length} photos` : 'la photo'}
              </Button>
            )}
          </>
        }
      >
        <Tabs<Mode>
          tabs={[{ value: 'texte', label: 'Texte' }, { value: 'photo', label: 'Photo' }]}
          value={mode}
          onChange={(m) => !proposer.isPending && !proposerPhoto.isPending && setMode(m)}
        />
        {mode === 'texte' ? (
          <Textarea
            label="Description des travaux"
            rows={6}
            autoFocus
            placeholder={EXEMPLE}
            hint="Indiquez les surfaces (m²), longueurs (ml) et nombres d’éléments : les quantités seront plus justes."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={3000}
          />
        ) : (
          <div className="space-y-4">
            <PhotoPicker photos={photos} onChange={setPhotos} disabled={proposerPhoto.isPending} />
            <Textarea
              label="Précisions (facultatif)"
              rows={3}
              placeholder="Ex. : refaire toute la salle de bain, garder la baignoire ; pièce de 2,40 × 2,80 m."
              hint="Ce que la photo ne montre pas : dimensions, travaux voulus. Prioritaire sur ce que l’IA croit voir."
              value={precision}
              onChange={(e) => setPrecision(e.target.value)}
              maxLength={3000}
            />
          </div>
        )}
        {current.isPending && (
          <p className="mt-3 text-sm text-gray-500" role="status">
            {mode === 'texte' ? 'L’assistant prépare la proposition… (jusqu’à 30 secondes)' : 'L’IA analyse les photos… (jusqu’à 60 secondes)'}
          </p>
        )}
        {current.isError && <p role="alert" className="mt-3 text-sm text-red-600">{errorMessage(current.error)}</p>}
      </Modal>
    );
  }

  // ── step 2: review ──
  return (
    <Modal
      open
      onClose={onClose}
      size="xl"
      title="Vérifiez la proposition"
      description={
        <span className="flex flex-wrap items-center gap-2">
          {proposition.modeIA ? <Badge tone="violet">Proposé par l’IA</Badge> : <Badge tone="slate">Recherche par mots-clés</Badge>}
          Prix issus de votre catalogue. Décochez ce qui ne convient pas, corrigez les quantités.
        </span>
      }
      footer={
        <>
          <Button variant="ghost" icon={<ArrowLeft className="size-4" />} onClick={() => setProposition(null)} className="mr-auto">
            {proposition.analysePhoto ? 'Changer les photos' : 'Modifier la description'}
          </Button>
          <Button variant="outline" onClick={onClose}>Annuler</Button>
          <Button disabled={!kept.length || invalid} loading={appliquer.isPending} onClick={apply}>
            Ajouter {kept.length} ligne{kept.length > 1 ? 's' : ''} au devis
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {proposition.analysePhoto && <AnalyseCard a={proposition.analysePhoto} />}
        {proposition.avertissement && (
          <p className="flex items-start gap-2 rounded-lg border border-orange-200 bg-orange-50 p-3 text-sm text-orange-900 dark:border-orange-900 dark:bg-orange-950/40 dark:text-orange-200">
            <TriangleAlert className="mt-0.5 size-4 shrink-0" /> {proposition.avertissement}
          </p>
        )}

        {rows.length > 0 && (
          <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-slate-800">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:bg-slate-800/60">
                <tr>
                  <th className="w-10 px-3 py-2"><span className="sr-only">Garder</span></th>
                  <th className="px-3 py-2">Prestation</th>
                  <th className="w-36 px-3 py-2">Quantité</th>
                  <th className="px-3 py-2 text-right">P.U. HT</th>
                  <th className="px-3 py-2 text-right">Total HT</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                {rows.map((r, i) => (
                  <tr key={r.prestationId} className={cn(!r.garder && 'opacity-50')}>
                    <td className="px-3 py-3 align-top">
                      <input
                        type="checkbox"
                        className="size-4 accent-blue-600"
                        checked={r.garder}
                        onChange={(e) => update(i, { garder: e.target.checked })}
                        aria-label={`Garder ${r.nom}`}
                      />
                    </td>
                    <td className="px-3 py-3 align-top">
                      <p className="font-medium text-gray-800 dark:text-slate-100">{r.nom}</p>
                      <p className="text-xs text-gray-500">{r.categorie}</p>
                      {r.justification && <p className="mt-1 text-xs italic text-gray-500">{r.justification}</p>}
                    </td>
                    <td className="px-3 py-3 align-top">
                      <div className="flex items-center gap-1.5">
                        <input
                          inputMode="decimal"
                          className={cn(
                            'w-20 rounded-lg border px-2 py-1 text-right text-sm dark:bg-slate-900',
                            r.garder && !validQty(r) ? 'border-red-400' : 'border-gray-300 dark:border-slate-700',
                          )}
                          value={r.saisie}
                          disabled={!r.garder}
                          onChange={(e) => update(i, { saisie: e.target.value })}
                          aria-label={`Quantité ${r.nom}`}
                        />
                        <span className="text-xs text-gray-500">{formatUnite(r.unite)}</span>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-right align-top">{formatEuros(r.prixUnitaireHT)}</td>
                    <td className="whitespace-nowrap px-3 py-3 text-right align-top font-medium">{validQty(r) ? formatEuros(r.prixUnitaireHT * qty(r)) : '—'}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-gray-50 font-semibold dark:bg-slate-800/60">
                  <td colSpan={4} className="px-3 py-2 text-right">Total HT des lignes retenues</td>
                  <td className="whitespace-nowrap px-3 py-2 text-right">{formatEuros(total)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        <div className="grid gap-3 md:grid-cols-2">
          {proposition.hypotheses.length > 0 && (
            <div className="rounded-lg border border-blue-100 bg-blue-50 p-3 text-sm text-blue-900 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-200">
              <p className="mb-1 flex items-center gap-1.5 font-semibold"><Lightbulb className="size-4" /> À vérifier</p>
              <ul className="list-disc space-y-0.5 pl-5">{proposition.hypotheses.map((h) => <li key={h}>{h}</li>)}</ul>
            </div>
          )}
          {proposition.nonCouverts.length > 0 && (
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700 dark:border-slate-800 dark:bg-slate-800/40 dark:text-slate-200">
              <p className="mb-1 flex items-center gap-1.5 font-semibold"><SearchX className="size-4" /> Absent du catalogue — à ajouter à la main</p>
              <ul className="list-disc space-y-0.5 pl-5">{proposition.nonCouverts.map((n) => <li key={n}>{n}</li>)}</ul>
            </div>
          )}
        </div>
        {invalid && <p role="alert" className="text-sm text-red-600">Une quantité retenue est invalide (nombre positif, 10 000 maximum).</p>}
      </div>
    </Modal>
  );
}
