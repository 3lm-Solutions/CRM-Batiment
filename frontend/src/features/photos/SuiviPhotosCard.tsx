import { CheckCircle2, EyeOff } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Badge, Button, Card, CardHeader, ErrorState, Loading, Modal, Select, Textarea } from '@/components/ui';
import { errorMessage } from '@/lib/api';
import { fullName } from '@/lib/format';
import { PHOTO_STATUTS, useDecisionPhotos, usePhotosChantier, type PhotosFiltres, type PhotoStatut } from './api';
import { PhotosFrise } from './PhotosFrise';

type TacheOption = { id: number; libelle: string; checklist?: { id: number; libelle: string }[] };

/**
 * « Suivi photos » of a job site (Étape 4 of 26/10): every before / after photo sent by the
 * sous-traitants, day by day. The chef (or ADMIN / ASSISTANTE) validates them — only validated
 * photos will be shown to the client — or hides them with a reason for the sous-traitant.
 */
export function SuiviPhotosCard({ chantierId, taches, canValidate }: { chantierId: number; taches: TacheOption[]; canValidate: boolean }) {
  const [filtres, setFiltres] = useState<PhotosFiltres>({ statut: 'EN_ATTENTE' });
  const photos = usePhotosChantier(chantierId, filtres);
  const decision = useDecisionPhotos(chantierId);
  const [selection, setSelection] = useState<Set<number>>(new Set());
  const [masquer, setMasquer] = useState(false);
  const [motif, setMotif] = useState('');

  // Nothing pending on first load: show everything rather than an empty list
  const [initialise, setInitialise] = useState(false);
  useEffect(() => {
    if (initialise || !photos.data) return;
    setInitialise(true);
    if (photos.data.totaux.enAttente === 0 && filtres.statut === 'EN_ATTENTE') setFiltres((f) => ({ ...f, statut: undefined }));
  }, [initialise, photos.data, filtres.statut]);

  // A selection never keeps photos that are no longer listed
  const visibles = useMemo(() => new Set((photos.data?.data ?? []).map((p) => p.id)), [photos.data]);
  useEffect(() => setSelection((s) => new Set([...s].filter((id) => visibles.has(id)))), [visibles]);

  const tache = taches.find((t) => t.id === filtres.tacheId);
  const toggle = (id: number) => setSelection((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const toggleGroupe = (ids: number[]) =>
    setSelection((s) => {
      const n = new Set(s);
      const tous = ids.every((id) => n.has(id));
      ids.forEach((id) => (tous ? n.delete(id) : n.add(id)));
      return n;
    });
  const decider = (action: 'valider' | 'masquer', ids: number[], m?: string) =>
    decision.mutate(
      { action, ids, motif: m },
      {
        onSuccess: (r) => {
          toast.success(action === 'valider' ? `${r.modifiees} photo(s) validée(s)` : `${r.modifiees} photo(s) masquée(s)`);
          setSelection(new Set());
          setMasquer(false);
          setMotif('');
        },
        onError: (e) => toast.error(errorMessage(e)),
      },
    );

  const t = photos.data?.totaux;
  const enAttenteVisibles = (photos.data?.data ?? []).filter((p) => p.statut === 'EN_ATTENTE').map((p) => p.id);

  return (
    <Card>
      <CardHeader
        title="Suivi photos"
        description={t ? `${t.enAttente} à valider · ${t.validees} validée(s) · ${t.masquees} masquée(s) — seules les photos validées seront montrées au client` : 'Photos avant / après envoyées par les sous-traitants'}
        actions={canValidate && enAttenteVisibles.length > 0 && (
          <Button size="sm" variant="success" icon={<CheckCircle2 className="size-4" />} loading={decision.isPending && decision.variables?.action === 'valider'} onClick={() => decider('valider', enAttenteVisibles)}>
            Tout valider ({enAttenteVisibles.length})
          </Button>
        )}
      />
      <div className="grid gap-3 border-b border-slate-100 p-4 sm:grid-cols-2 lg:grid-cols-4 dark:border-slate-800">
        <Select
          aria-label="Tâche"
          placeholder="Toutes les tâches"
          options={taches.map((x) => ({ value: x.id, label: x.libelle }))}
          value={filtres.tacheId ?? ''}
          onChange={(e) => setFiltres((f) => ({ ...f, tacheId: e.target.value ? Number(e.target.value) : undefined, checklistItemId: undefined }))}
        />
        <Select
          aria-label="Sous-tâche"
          placeholder={tache?.checklist?.length ? 'Toutes les sous-tâches' : 'Sous-tâche'}
          disabled={!tache?.checklist?.length}
          options={(tache?.checklist ?? []).map((i) => ({ value: i.id, label: i.libelle }))}
          value={filtres.checklistItemId ?? ''}
          onChange={(e) => setFiltres((f) => ({ ...f, checklistItemId: e.target.value ? Number(e.target.value) : undefined }))}
        />
        <Select
          aria-label="Sous-traitant"
          placeholder="Tous les sous-traitants"
          options={(photos.data?.auteurs ?? []).map((a) => ({ value: a.id, label: fullName(a) }))}
          value={filtres.auteurId ?? ''}
          onChange={(e) => setFiltres((f) => ({ ...f, auteurId: e.target.value ? Number(e.target.value) : undefined }))}
        />
        <Select
          aria-label="Statut"
          placeholder="Tous les statuts"
          options={(Object.keys(PHOTO_STATUTS) as PhotoStatut[]).map((s) => ({ value: s, label: PHOTO_STATUTS[s].label }))}
          value={filtres.statut ?? ''}
          onChange={(e) => setFiltres((f) => ({ ...f, statut: (e.target.value || undefined) as PhotoStatut | undefined }))}
        />
      </div>

      {canValidate && selection.size > 0 && (
        <div className="sticky top-0 z-10 flex flex-wrap items-center gap-2 border-b border-slate-100 bg-brand-100/60 px-4 py-2 text-sm dark:border-slate-800 dark:bg-slate-800">
          <Badge tone="blue">{selection.size} sélectionnée(s)</Badge>
          <Button size="sm" variant="success" icon={<CheckCircle2 className="size-4" />} loading={decision.isPending && decision.variables?.action === 'valider'} onClick={() => decider('valider', [...selection])}>
            Valider
          </Button>
          <Button size="sm" variant="outline" icon={<EyeOff className="size-4" />} onClick={() => setMasquer(true)}>Masquer</Button>
          <button type="button" className="ml-auto text-xs text-slate-500 hover:underline" onClick={() => setSelection(new Set())}>Annuler la sélection</button>
        </div>
      )}

      {photos.isPending ? (
        <Loading />
      ) : photos.isError ? (
        <div className="p-4"><ErrorState error={photos.error} onRetry={() => void photos.refetch()} /></div>
      ) : (
        <PhotosFrise
          photos={photos.data.data}
          selection={canValidate ? selection : undefined}
          onToggle={canValidate ? toggle : undefined}
          onToggleGroupe={canValidate ? toggleGroupe : undefined}
          montrerAuteur
          vide={filtres.statut === 'EN_ATTENTE' ? 'Aucune photo à valider.' : 'Aucune photo pour ces filtres. Les sous-traitants envoient leurs photos avant / après depuis leur portail.'}
        />
      )}

      <Modal
        open={masquer}
        onClose={() => setMasquer(false)}
        title={`Masquer ${selection.size} photo(s)`}
        description="Elles ne seront jamais montrées au client. Le sous-traitant voit le motif dans son portail."
        footer={
          <>
            <Button variant="outline" onClick={() => setMasquer(false)}>Annuler</Button>
            <Button variant="danger" loading={decision.isPending} onClick={() => decider('masquer', [...selection], motif.trim())}>Masquer</Button>
          </>
        }
      >
        <Textarea label="Motif" rows={2} maxLength={300} value={motif} onChange={(e) => setMotif(e.target.value)} placeholder="Ex. : photo floue, mauvaise tâche…" />
      </Modal>
    </Card>
  );
}
